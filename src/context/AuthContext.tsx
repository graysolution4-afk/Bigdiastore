import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { AdminRole, UserProfile } from '../types/store';

interface ServerSessionUser {
  uid: string;
  email: string;
  fullName: string;
  kind: 'admin' | 'customer';
  role?: AdminRole;
  token: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  customerProfile: UserProfile | null;
  serverSession: ServerSessionUser | null;
  authReady: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  activeEmail: string | null;
  activeUid: string | null;
  activeName: string | null;
  signInWithGoogle: () => Promise<{ isAdmin: boolean; email: string | null }>;
  registerCustomer: (input: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  loginCustomer: (email: string, password: string) => Promise<void>;
  initFirstSuperAdmin: (input: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  logoutAll: () => Promise<void>;
  updateCustomerProfile: (patch: Partial<UserProfile>) => Promise<void>;
  getBearerToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SERVER_SESSION_KEY = 'diamond_store_session_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [customerProfile, setCustomerProfile] = useState<UserProfile | null>(null);
  const [serverSession, setServerSession] = useState<ServerSessionUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(SERVER_SESSION_KEY);
      return raw ? (JSON.parse(raw) as ServerSessionUser) : null;
    } catch {
      return null;
    }
  });
  const [firestoreAdminRole, setFirestoreAdminRole] = useState<AdminRole | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const persistServerSession = (sess: ServerSessionUser | null) => {
    setServerSession(sess);
    try {
      if (sess) {
        sessionStorage.setItem(SERVER_SESSION_KEY, JSON.stringify(sess));
      } else {
        sessionStorage.removeItem(SERVER_SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          // Check admin record
          const isBootstrap =
            user.email?.toLowerCase() === 'graysolution4@gmail.com' && user.emailVerified;
          if (isBootstrap) {
            setFirestoreAdminRole('super_admin');
          } else {
            const adminSnap = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
            if (adminSnap && adminSnap.exists() && adminSnap.data()?.active === true) {
              setFirestoreAdminRole(adminSnap.data()?.role as AdminRole);
            } else {
              setFirestoreAdminRole(null);
            }
          }

          // Sync or create customer profile
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setCustomerProfile({ id: userSnap.id, ...userSnap.data() } as UserProfile);
          } else {
            const payload = {
              uid: user.uid,
              fullName: user.displayName || user.email?.split('@')[0] || 'Diamond Client',
              email: user.email || '',
              phone: user.phoneNumber || '',
              defaultState: 'Lagos',
              defaultCity: '',
              defaultAddress: '',
              status: 'active' as const,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, payload);
            setCustomerProfile({ id: user.uid, ...payload } as UserProfile);
          }
        } catch (err) {
          console.error('Auth profile sync warning:', err);
        }
      } else {
        setCustomerProfile(null);
        setFirestoreAdminRole(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{
    isAdmin: boolean;
    email: string | null;
  }> => {
    googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const user = cred.user;
    setFirebaseUser(user);

    const isBootstrap =
      user.email?.toLowerCase() === 'graysolution4@gmail.com' && user.emailVerified;
    if (isBootstrap) {
      setFirestoreAdminRole('super_admin');
      return { isAdmin: true, email: user.email };
    }

    const adminSnap = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
    if (adminSnap && adminSnap.exists() && adminSnap.data()?.active === true) {
      setFirestoreAdminRole(adminSnap.data()?.role as AdminRole);
      return { isAdmin: true, email: user.email };
    }

    setFirestoreAdminRole(null);
    return { isAdmin: false, email: user.email };
  }, []);

  const registerCustomer = useCallback(
    async (input: { fullName: string; email: string; phone?: string; password: string }) => {
      // 1. Register in Express scrypt vault
      const resp = await fetch('/api/customer-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || 'Registration failed.');
      }

      // 2. Also attempt Firebase Email/Password auth if enabled in Firebase Console
      try {
        const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
        await updateProfile(cred.user, { displayName: input.fullName });
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone || '',
          defaultState: 'Lagos',
          defaultCity: '',
          defaultAddress: '',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // If Firebase Email/Password provider isn't enabled in console yet, use verified server session seamlessly
        persistServerSession({
          uid: json.user.uid,
          email: json.user.email,
          fullName: json.user.fullName,
          kind: 'customer',
          token: json.token,
        });
      }
    },
    []
  );

  const loginCustomer = useCallback(async (email: string, password: string) => {
    // Try server auth first
    const resp = await fetch('/api/customer-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await resp.json().catch(() => ({}));

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (resp.ok && json?.token) {
        persistServerSession({
          uid: json.user.uid,
          email: json.user.email,
          fullName: json.user.fullName,
          kind: 'customer',
          token: json.token,
        });
      }
      return;
    } catch {
      if (!resp.ok) {
        throw new Error(json?.error || 'Invalid email or password.');
      }
      persistServerSession({
        uid: json.user.uid,
        email: json.user.email,
        fullName: json.user.fullName,
        kind: 'customer',
        token: json.token,
      });
    }
  }, []);

  const initFirstSuperAdmin = useCallback(
    async (input: { fullName: string; email: string; password: string; confirmPassword: string }) => {
      const resp = await fetch('/api/admin-auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || 'Super Admin setup failed.');
      }
      persistServerSession({
        uid: json.admin.id,
        email: json.admin.email,
        fullName: json.admin.fullName,
        kind: 'admin',
        role: json.admin.role,
        token: json.token,
      });
    },
    []
  );

  const loginAdmin = useCallback(async (email: string, password: string) => {
    const resp = await fetch('/api/admin-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(json?.error || 'Invalid administrator credentials.');
    }
    persistServerSession({
      uid: json.admin.id,
      email: json.admin.email,
      fullName: json.admin.fullName,
      kind: 'admin',
      role: json.admin.role,
      token: json.token,
    });
  }, []);

  const logoutAll = useCallback(async () => {
    persistServerSession(null);
    setCustomerProfile(null);
    setFirestoreAdminRole(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const updateCustomerProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!firebaseUser) {
        if (serverSession) {
          persistServerSession({
            ...serverSession,
            fullName: patch.fullName || serverSession.fullName,
          });
        }
        return;
      }
      const userRef = doc(db, 'users', firebaseUser.uid);
      try {
        await updateDoc(userRef, {
          fullName: patch.fullName ?? customerProfile?.fullName ?? '',
          phone: patch.phone ?? customerProfile?.phone ?? '',
          defaultState: patch.defaultState ?? customerProfile?.defaultState ?? 'Lagos',
          defaultCity: patch.defaultCity ?? customerProfile?.defaultCity ?? '',
          defaultAddress: patch.defaultAddress ?? customerProfile?.defaultAddress ?? '',
          updatedAt: serverTimestamp(),
        });
        setCustomerProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
    },
    [firebaseUser, customerProfile, serverSession]
  );

  const getBearerToken = useCallback(async (): Promise<string | null> => {
    if (serverSession?.token) return serverSession.token;
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  }, [serverSession]);

  const adminRole: AdminRole | null =
    firestoreAdminRole || (serverSession?.kind === 'admin' ? serverSession.role || 'super_admin' : null);

  const isAdmin = Boolean(adminRole);
  const isSignedIn = Boolean(firebaseUser || serverSession);
  const activeEmail = firebaseUser?.email || serverSession?.email || null;
  const activeUid = firebaseUser?.uid || serverSession?.uid || null;
  const activeName =
    customerProfile?.fullName || firebaseUser?.displayName || serverSession?.fullName || null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        customerProfile,
        serverSession,
        authReady,
        isSignedIn,
        isAdmin,
        adminRole,
        activeEmail,
        activeUid,
        activeName,
        signInWithGoogle,
        registerCustomer,
        loginCustomer,
        initFirstSuperAdmin,
        loginAdmin,
        logoutAll,
        updateCustomerProfile,
        getBearerToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
