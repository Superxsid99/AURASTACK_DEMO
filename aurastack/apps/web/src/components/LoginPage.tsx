import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  onFirstLogin: (email: string, password: string, name?: string) => Promise<string>;
  onRequestReset: (email: string) => Promise<string>;
  onConfirmReset: (token: string, newPassword: string) => Promise<string>;
  loading?: boolean;
  error?: string | null;
};

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  onFirstLogin,
  onRequestReset,
  onConfirmReset,
  loading = false,
  error = null
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'first_login' | 'request_reset' | 'confirm_reset'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [firstLoginName, setFirstLoginName] = useState('');
  const [firstLoginPassword, setFirstLoginPassword] = useState('');
  const [firstLoginConfirmPassword, setFirstLoginConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setMessage(null);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'FIRST_LOGIN_REQUIRED') {
        setMode('first_login');
        setResetEmail(email.trim());
        return;
      }
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleFirstLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalLoading(true);
    setLocalError(null);
    setMessage(null);
    if (firstLoginPassword !== firstLoginConfirmPassword) {
      setLocalLoading(false);
      setLocalError('Passwords do not match');
      return;
    }
    try {
      const result = await onFirstLogin(
        resetEmail.trim(),
        firstLoginPassword,
        firstLoginName.trim() || undefined
      );
      setMessage(result);
      setMode('login');
      setPassword('');
      setFirstLoginPassword('');
      setFirstLoginConfirmPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to complete first-time setup');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleRequestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalLoading(true);
    setLocalError(null);
    setMessage(null);
    try {
      const text = await onRequestReset(resetEmail.trim());
      setMessage(text);
      setMode('confirm_reset');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to request reset');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleConfirmReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalLoading(true);
    setLocalError(null);
    setMessage(null);
    try {
      const text = await onConfirmReset(resetToken.trim(), newPassword);
      setMessage(text);
      setMode('login');
      setResetToken('');
      setNewPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-outline bg-card p-6 shadow-lg shadow-black/25">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide uppercase">AuraStack Login</h1>
            <p className="text-xs text-on-surface-variant">
              Secure access for workflows, inbox, and case operations
            </p>
          </div>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Work Email</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Password</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="current-password"
              />
            </div>
            {error ? (
              <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                {message}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setMode('request_reset');
                setResetEmail(email);
                setLocalError(null);
                setMessage(null);
              }}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="w-full text-xs text-on-surface-variant underline-offset-2 hover:underline"
              onClick={() => {
                setMode('first_login');
                setResetEmail(email.trim());
                setLocalError(null);
                setMessage('First-time setup: set your password to activate this account.');
              }}
            >
              First-time user? Set password
            </button>
          </form>
        ) : null}

        {mode === 'request_reset' ? (
          <form onSubmit={handleRequestReset} className="space-y-3">
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              className="hidden"
              aria-hidden
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              className="hidden"
              aria-hidden
            />
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Account Email</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="email"
                placeholder="name@company.com"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                required
              />
            </div>
            {localError ? (
              <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
                {localError}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                {message}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={localLoading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
            >
              {localLoading ? 'Submitting...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-on-surface-variant underline-offset-2 hover:underline"
              onClick={() => setMode('login')}
            >
              Back to login
            </button>
            <button
              type="button"
              className="w-full text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setMode('first_login');
                setLocalError(null);
                setMessage('You can skip reset and complete first-time setup directly.');
              }}
            >
              First-time user? Set password directly
            </button>
          </form>
        ) : null}

        {mode === 'first_login' ? (
          <form onSubmit={handleFirstLogin} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Email</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Name (Optional)</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="text"
                value={firstLoginName}
                onChange={(event) => setFirstLoginName(event.target.value)}
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Set Password</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="password"
                value={firstLoginPassword}
                onChange={(event) => setFirstLoginPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Confirm Password</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="password"
                value={firstLoginConfirmPassword}
                onChange={(event) => setFirstLoginConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            {localError ? (
              <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">{localError}</div>
            ) : null}
            <button
              type="submit"
              disabled={localLoading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
            >
              {localLoading ? 'Setting up...' : 'Complete First-Time Setup'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-on-surface-variant underline-offset-2 hover:underline"
              onClick={() => setMode('login')}
            >
              Back to login
            </button>
          </form>
        ) : null}

        {mode === 'confirm_reset' ? (
          <form onSubmit={handleConfirmReset} className="space-y-3" autoComplete="off">
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              className="hidden"
              aria-hidden
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              className="hidden"
              aria-hidden
            />
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">Reset Token</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="password"
                placeholder="Paste reset token"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                name="aurastack_reset_token"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-on-surface-variant">New Password</label>
              <input
                className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                name="aurastack_new_password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {localError ? (
              <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
                {localError}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                {message}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={localLoading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
            >
              {localLoading ? 'Updating...' : 'Reset Password'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-on-surface-variant underline-offset-2 hover:underline"
              onClick={() => setMode('login')}
            >
              Back to login
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
};
