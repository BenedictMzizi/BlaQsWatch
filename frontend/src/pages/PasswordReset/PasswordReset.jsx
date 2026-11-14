import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function PasswordReset() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );

    const authError =
      params.get('error_description') ||
      hash.get('error_description') ||
      params.get('error') ||
      hash.get('error');

    if (authError) {
      setError(authError.replace(/\+/g, ' '));
      setStatus('error');
      return undefined;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' && session) {
        setStatus('ready');
        setError('');
      }
    });

    // Supabase may already have processed the recovery link before
    // this component subscribes to auth state changes.
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setStatus('error');
        return;
      }

      if (session && hash.get('type') === 'recovery') {
        setStatus('ready');
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) {
        throw updateError;
      }

      // End the recovery session so the employee can sign in
      // normally using the new password.
      await supabase.auth.signOut();

      navigate('/login', {
        replace: true,
        state: {
          passwordUpdated: true
        }
      });
    } catch (err) {
      setError(err.message || 'Unable to update your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" style={{ width: '100%' }}>
        <div className="login-card">
          <div className="brand-mark">
            <span>BW</span>
          </div>

          <p className="eyebrow">BLAQSWATCH SECURITY</p>

          {status === 'verifying' && (
            <>
              <h2>Verifying reset link</h2>
              <p className="muted">
                Please wait while we verify your password-reset link.
              </p>
            </>
          )}

          {status === 'ready' && (
            <>
              <h2>Set a new password</h2>
              <p className="muted">
                Choose a new password for your BlaQsWatch account.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-password">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary full"
                  disabled={saving}
                >
                  {saving ? 'Updating password...' : 'Update password'}
                </button>
              </form>
            </>
          )}

          {status === 'error' && (
            <>
              <h2>Reset link unavailable</h2>
              <p className="form-error" role="alert">
                {error ||
                  'This password-reset link is invalid or has expired.'}
              </p>
              <p className="muted">
                Return to login and request another password-reset email.
              </p>
              <Link to="/login" className="btn btn-primary full">
                Back to login
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}