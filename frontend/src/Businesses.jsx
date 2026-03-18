import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';

const BACKEND_URL = 'http://localhost:8000';

/* ── Spinner ── */
const Spinner = ({ size = 15 }) => (
  <svg style={{ animation: 'spin 1s linear infinite', display: 'inline' }} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 24 24">
    <circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/* ── Delete Confirmation Modal ── */
function DeleteConfirm({ business, onCancel, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/businesses/${business.id}/delete/`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (res.ok) onDeleted();
      else setError(data.error || 'Delete failed.');
    } catch { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 32px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '20px' }}>🗑</div>
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#111827' }}>Delete Business?</h3>
        <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#4B5563' }}>
          You are about to permanently delete <strong>{business.name}</strong>{' '}
          (<code style={{ background: '#F3F4F6', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>{business.code}</code>).
        </p>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#EF4444', fontWeight: '500' }}>This action cannot be undone.</p>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', color: '#DC2626', fontSize: '13px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 18px', background: '#F3F4F6', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>Cancel</button>
          <button onClick={handleDelete} disabled={loading}
            style={{ padding: '9px 18px', background: '#EF4444', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13.5px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px', opacity: loading ? 0.7 : 1 }}>
            {loading ? <><Spinner /> Deleting…</> : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses,   setBusinesses]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchBusinesses = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${BACKEND_URL}/api/businesses/`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setBusinesses(data.businesses);
      else setError(data.error || 'Failed to load.');
    } catch { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBusinesses(); }, []);


  const th = { padding: '10px 14px', fontSize: '11.5px', fontWeight: '700', color: '#6B7280', textAlign: 'left', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#F9FAFB', whiteSpace: 'nowrap' };
  const td = { padding: '12px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '36px 32px', minHeight: '100vh', fontFamily: '"Google Sans", system-ui, sans-serif' }}>

      {deleteTarget && (
        <DeleteConfirm
          business={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchBusinesses(); }}
        />
      )}

      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827' }}>Businesses</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9CA3AF' }}>
              {loading ? 'Loading…' : `${businesses.length} registered`}
            </p>
          </div>
          <button onClick={() => navigate('/businesses/new')}
            style={{ padding: '9px 18px', background: '#EA5E28', color: '#fff', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,94,40,0.22)', transition: 'all 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#d45420'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EA5E28'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            + New Business
          </button>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#DC2626', fontSize: '13.5px' }}>{error}</div>}

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Spinner size={18} /> Loading businesses…
            </div>
          ) : businesses.length === 0 ? (
            <div style={{ padding: '72px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🏢</div>
              <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#374151' }}>No businesses yet</p>
              <p style={{ margin: '0 0 20px', color: '#9CA3AF', fontSize: '13.5px' }}>Create your first business to get started.</p>
              <button onClick={() => navigate('/businesses/new')}
                style={{ padding: '9px 20px', background: '#EA5E28', color: '#fff', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Create Business
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>Business</th>
                    <th style={th}>Code</th>
                    <th style={th}>NTN</th>
                    <th style={th}>Phone</th>
                    <th style={th}>Email</th>
                    <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b, i) => (
                    <tr key={b.id}
                      style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF5F0'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA'}>
                      <td style={{ ...td, color: '#9CA3AF', fontSize: '12.5px', width: '36px' }}>{i + 1}</td>
                      <td style={td}>
                        <div style={{ fontWeight: '700', color: '#111827' }}>{b.name}</div>
                        {b.legal_name && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{b.legal_name}</div>}
                      </td>
                      <td style={td}>
                        <code style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '5px', fontSize: '12.5px', fontWeight: '700', color: '#4B5563' }}>{b.code}</code>
                      </td>
                      <td style={{ ...td, fontSize: '13px', color: '#6B7280' }}>{b.ntn || '—'}</td>
                      <td style={{ ...td, fontSize: '13px', color: '#6B7280' }}>{b.phone || '—'}</td>
                      <td style={{ ...td, fontSize: '13px', color: '#6B7280' }}>{b.email || '—'}</td>
                      <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Tooltip title="View Ledger" arrow>
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/businesses/${b.id}/ledger`)}
                            sx={{ color: '#EA5E28', '&:hover': { background: '#FFF5F0' }, mr: 0.5 }}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Business" arrow>
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/businesses/${b.id}/edit`, { state: { business: b } })}
                            sx={{ color: '#0EA5E9', '&:hover': { background: '#E0F2FE' }, mr: 0.5 }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Business" arrow>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteTarget(b)}
                            sx={{ color: '#EF4444', '&:hover': { background: '#FEE2E2' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
