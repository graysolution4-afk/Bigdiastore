import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

export function AdminLoginPage() {
  const { isAdmin, authReady, initFirstSuperAdmin, loginAdmin, signInWithGoogle } = useAuth();
  const { notify } = useStore();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [initialized, setInitialized] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch('/api/admin-auth/status');
        const json = await resp.json();
        setInitialized(Boolean(json?.initialized));
      } catch {
        setInitialized(true);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (authReady && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleInitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      notify('Passwords do not match.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await initFirstSuperAdmin({ fullName, email, password, confirmPassword });
      notify('Super Administrator account initialized.', 'success');
      navigate('/admin');
    } catch (err: any) {
      notify(err?.message || 'Failed to initialize Super Administrator.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginAdmin(email, password);
      notify('Administrator session authenticated.', 'success');
      navigate('/admin');
    } catch (err: any) {
      notify(err?.message || 'Invalid administrator credentials.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAdmin = async () => {
    setSubmitting(true);
    try {
      const res = await signInWithGoogle();
      if (res.isAdmin) {
        notify('Administrator Google session authenticated.', 'success');
        navigate('/admin');
      } else {
        notify(
          `The Google account ${res.email || ''} is not authorized as a store administrator.`,
          'error'
        );
      }
    } catch (err: any) {
      notify(err?.message || 'Google authentication failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#111111] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-[#D4AF37]/40 p-8 sm:p-10">
        <div className="text-center border-b border-neutral-200 pb-6 mb-6">
          <p className="font-display text-2xl font-semibold tracking-[0.16em] text-[#111111]">
            DIAMOND STORE
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-[#9E7C16] mt-1">
            {checking
              ? 'Verifying Security State'
              : !initialized
              ? 'First-Time Super Admin Setup'
              : 'Administrator Access'}
          </p>
        </div>

        {checking ? (
          <div className="py-10 text-center text-sm text-neutral-500">Checking initialization status...</div>
        ) : (
          <div className="space-y-5">
            {!initialized ? (
              <form onSubmit={handleInitSubmit} className="space-y-4">
                <div className="p-3 bg-[#F5F5F5] border border-neutral-200 text-xs text-neutral-700 flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#9E7C16] shrink-0 mt-0.5" />
                  <span>
                    Create the primary Super Administrator password account, or sign in directly with your authorized Google account below.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest hover:bg-[#9E7C16] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Initializing...' : 'Create Super Administrator'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest hover:bg-[#9E7C16] transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" /> Sign In to Dashboard
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <div className="flex-1 h-px bg-neutral-200" />
              <span>OR SIGN IN WITH GOOGLE</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleAdmin}
              disabled={submitting}
              className="w-full py-3 border border-[#111111] text-xs font-semibold uppercase tracking-widest hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
            >
              Continue with Google
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-neutral-200 text-center">
          <Link to="/" className="text-xs text-neutral-500 hover:text-[#111111] underline">
            Return to Public Storefront
          </Link>
        </div>
      </div>
    </main>
  );
}
