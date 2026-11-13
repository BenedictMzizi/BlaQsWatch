
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PlatformRoute() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function verifyPlatformAccess() {
      try {
        const {
          data,
          error: accessError
        } = await supabase.rpc('stockwise_is_platform_admin');

        if (accessError) throw accessError;

        if (mounted) {
          setAuthorized(data === true);
        }
      } catch (err) {
        console.error('Platform authorization failed:', err);

        if (mounted) {
          setError(
            'Unable to verify platform administrator access. Please try again.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    verifyPlatformAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="auth-loading" role="status">
        Verifying platform access...
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="form-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}