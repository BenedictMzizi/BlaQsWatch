
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WrenchScrewdriverIcon,
  CubeIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');

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

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary full"
            disabled={loading}
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
