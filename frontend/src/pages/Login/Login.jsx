
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  WrenchScrewdriverIcon,
  CubeIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const passwordUpdated = location.state?.passwordUpdated === true;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setResetError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Check your environment variables.');
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

      if (signInError) {
        throw signInError;
      }

      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login failed:', err);

      if (err.message === 'Invalid login credentials') {
        setError('Incorrect email or password.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please confirm your email address before signing in.');
      } else {
        setError(err.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    setError('');
    setResetMessage('');
    setResetError('');

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setResetError('Enter your email address first.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setResetError('Enter a valid email address.');
      return;
    }

    if (!isSupabaseConfigured) {
      setResetError(
        'Supabase is not configured. Check your environment variables.'
      );
      return;
    }

    setResetLoading(true);

    try {
      const { error: resetRequestError } =
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`
        });

      if (resetRequestError) {
        throw resetRequestError;
      }

      setResetMessage(
        'If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder.'
      );
    } catch (err) {
      console.error('Password reset request failed:', err);
      setResetError(
        err.message || 'Unable to send the reset email. Please try again.'
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark">
          <WrenchScrewdriverIcon />
        </div>

        <p className="eyebrow">INVENTORY CONTROL, SIMPLIFIED</p>
        <h1>BlaQsWatch</h1>

        <p className="login-intro">
          One place to manage every product, every movement and every part
          that keeps your business moving.
        </p>

        <div className="login-features">
          <span>
            <CubeIcon /> Multi-category stock control
          </span>
          <span>
            <WrenchScrewdriverIcon /> Automotive fitment tracking
          </span>
          <span>
            <ShieldCheckIcon /> Clear stock movement history
          </span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-mark">
            <WrenchScrewdriverIcon /> BlaQsWatch
          </div>

          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your workspace</h2>

          <p className="muted">
            Sign in using your registered account credentials.
          </p>

          {passwordUpdated && (
            <p className="form-success" role="status">
              Your password has been updated. Sign in using your new password.
            </p>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResetMessage('');
                setResetError('');
              }}
              placeholder="Enter your email"
              autoComplete="username"
              required
              disabled={loading || resetLoading}
            />
          </label>

          <label>
            Password
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={loading || resetLoading}
                style={{
                  width: '100%',
                  paddingRight: '46px'
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                disabled={loading || resetLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '5px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted, #999)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? (
                  <EyeSlashIcon style={{ width: '21px', height: '21px' }} />
                ) : (
                  <EyeIcon style={{ width: '21px', height: '21px' }} />
                )}
              </button>
            </div>
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '-8px'
            }}
          >
            <button
              type="button"
              onClick={requestPasswordReset}
              disabled={loading || resetLoading}
              style={{
                border: 0,
                padding: '4px 0',
                background: 'transparent',
                color: 'var(--accent-color, #d6ad55)',
                font: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: loading || resetLoading ? 'not-allowed' : 'pointer',
                opacity: loading || resetLoading ? 0.6 : 1
              }}
            >
              {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
            </button>
          </div>

          {resetError && (
            <p className="form-error" role="alert">
              {resetError}
            </p>
          )}

          {resetMessage && (
            <p className="form-success" role="status">
              {resetMessage}
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary full"
            disabled={loading || resetLoading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading && <span>→</span>}
          </button>

          <div className="demo-hint">
            <strong>Secure access</strong>
            <span>
              Your account is authenticated securely through Supabase.
              Only registered users can access the workspace.
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}
