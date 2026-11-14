
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState(
    'Verifying your invitation with Supabase...'
  );

  useEffect(() => {
    let mounted = true;

    const getAuthError = () => {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(
        window.location.hash.replace(/^#/, '')
      );

      return (
        params.get('error_description') ||
        hash.get('error_description') ||
        params.get('error') ||
        hash.get('error')
      );
    };

    const authError = getAuthError();

    if (authError) {
      setStatus('error');
      setMessage(decodeURIComponent(authError.replace(/\+/g, ' ')));
      return undefined;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        if (session) {
          setStatus('success');
          setMessage('Your invitation has been verified.');

          navigate('/', { replace: true });
        } else {
          setStatus('error');
          setMessage(
            'We could not establish your session. Your invitation may have expired or already been used.'
          );
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <main className="login-page">
      <section className="login-panel" style={{ width: '100%' }}>
        <div
          className="login-card"
          role="status"
          aria-live="polite"
          style={{ textAlign: 'center' }}
        >
          {status === 'loading' && (
            <>
              <div className="brand-mark">
                <span>BW</span>
              </div>

              <p className="eyebrow">BLAQSWATCH SECURITY</p>
              <h2>Verifying your invitation</h2>

              <p className="muted">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <p className="eyebrow">INVITATION VERIFIED</p>
              <h2>Welcome to BlaQsWatch</h2>
              <p className="muted">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="eyebrow">AUTHENTICATION ISSUE</p>
              <h2>Unable to verify invitation</h2>

              <p className="form-error" role="alert">
                {message}
              </p>

              <p className="muted">
                Please return to the login page or request a new invitation
                from your administrator.
              </p>

              <Link to="/login" className="btn btn-primary full">
                Go to login
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
