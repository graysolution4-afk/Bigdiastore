import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

export function CustomerLoginPage() {
  const { signInWithGoogle, loginCustomer } = useAuth();
  const { notify } = useStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginCustomer(email, password);
      notify('Welcome back to Diamond Store.', 'success');
      navigate('/account');
    } catch (err: any) {
      notify(err?.message || 'Sign in failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      notify('Signed in with Google.', 'success');
      navigate('/account');
    } catch (err: any) {
      notify(err?.message || 'Google sign-in failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="border border-neutral-200 p-8 bg-white">
        <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">Client Portal</p>
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-6">Sign In</h1>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 border border-[#111111] text-xs font-semibold uppercase tracking-widest hover:bg-[#F5F5F5] transition-colors mb-6"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-neutral-400 mb-6">
          <div className="flex-1 h-px bg-neutral-200" />
          <span>OR EMAIL</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex justify-between mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-[#9E7C16] hover:underline">
                Forgot password?
              </Link>
            </div>
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
            disabled={loading}
            className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest hover:bg-[#9E7C16] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-neutral-600 text-center mt-6">
          New to Diamond Store?{' '}
          <Link to="/register" className="text-[#111111] font-semibold underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

export function CustomerRegisterPage() {
  const { registerCustomer, signInWithGoogle } = useAuth();
  const { notify } = useStore();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerCustomer({ fullName, email, phone, password });
      notify('Account created. Welcome to Diamond Store.', 'success');
      navigate('/account');
    } catch (err: any) {
      notify(err?.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="border border-neutral-200 p-8 bg-white">
        <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">Join Diamond Store</p>
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-6">Create Account</h1>

        <button
          type="button"
          onClick={async () => {
            await signInWithGoogle();
            navigate('/account');
          }}
          className="w-full py-3 border border-[#111111] text-xs font-semibold uppercase tracking-widest hover:bg-[#F5F5F5] transition-colors mb-6"
        >
          Sign Up with Google
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
              Password (min 6 characters)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest hover:bg-[#9E7C16] transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-neutral-600 text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#111111] font-semibold underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export function ForgotPasswordPage() {
  const { notify } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch('/api/customer-auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await resp.json();
      notify(json?.message || 'Verification instructions issued.', 'info');
      setStep('reset');
    } catch {
      notify('Unable to process password reset request.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch('/api/customer-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error);
      notify('Password updated. You can now sign in.', 'success');
      navigate('/login');
    } catch (err: any) {
      notify(err?.message || 'Reset failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="border border-neutral-200 p-8 bg-white">
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-4">Reset Password</h1>
        {step === 'request' ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-neutral-600">
              Enter your registered email address to receive a verification code.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest"
            >
              Send Reset Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-character reset code"
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm font-mono uppercase"
            />
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest"
            >
              Update Password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
