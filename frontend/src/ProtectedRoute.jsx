import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = 'http://localhost:8000';

/**
 * Wraps a route with session authentication + role check.
 * Props:
 *   requireSuperuser (bool) — if true, non-superusers are logged out and redirected.
 *   children — the page to render when authorized.
 */
export default function ProtectedRoute({ requireSuperuser = false, children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'denied'

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${BACKEND_URL}/api/me/`, { credentials: 'include' });
        if (!res.ok) {
          // Not authenticated → go to login
          setStatus('denied');
          navigate('/login', { replace: true });
          return;
        }
        const data = await res.json();
        const user = data.user;

        if (requireSuperuser && !user.is_superuser) {
          // Wrong role → log out + go to login
          await fetch(`${BACKEND_URL}/api/logout/`, { method: 'POST', credentials: 'include' });
          setStatus('denied');
          navigate('/login', { replace: true });
          return;
        }

        setStatus('ok');
      } catch {
        setStatus('denied');
        navigate('/login', { replace: true });
      }
    })();
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
          <svg style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: .2 }} cx="12" cy="12" r="10" stroke="#EA5E28" strokeWidth="4" />
            <path style={{ opacity: .8 }} fill="#EA5E28" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p style={{ margin: 0, fontSize: '14px' }}>Verifying session…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === 'denied') return null;
  return children;
}
