import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const BACKEND_URL = 'http://localhost:8000';

const fmt = (n) => `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

const STATUS_BADGE = {
  collected: { bg: '#F0FDF4', color: '#16A34A', dot: '#22C55E' },
  pending:   { bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
  upcoming:  { bg: '#FFFBF5', color: '#D97706', dot: '#F59E0B' },
};

export default function BusinessLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ledger/business/${id}/`, { credentials: 'include' });
        const json = await res.json();
        if (res.ok) setData(json);
        else setError(json.error || 'Failed to load business ledger.');
      } catch (err) { 
        console.error('Ledger Detail Error:', err);
        setError('Cannot connect to server.'); 
      }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading ledger detail...</div>;
  if (error) return <div style={{ padding: '40px', color: '#DC2626' }}>{error}</div>;

  const { business, entries } = data;

  const th = { padding: '12px 14px', fontSize: '11.5px', fontWeight: '700', color: '#6B7280', textAlign: 'left', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', background: '#F9FAFB' };
  const td = { padding: '14px', fontSize: '13.5px', color: '#374151', borderBottom: '1px solid #F3F4F6' };

  return (
    <div style={{ padding: '36px 32px' }}>
      <button 
        onClick={() => navigate('/ledger')}
        style={{ background: 'none', border: 'none', color: '#EA5E28', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', marginBottom: '24px', padding: 0 }}
      >
        <ArrowBackIcon style={{ fontSize: '18px' }} /> Back to Global Ledger
      </button>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#111827' }}>{business.name}</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6B7280' }}>Business Code: <b>{business.code}</b></p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Setup Fee</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>{fmt(business.down_payment)}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Monthly Fee</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>{business.is_lifetime ? 'Lifetime Access' : fmt(business.monthly_fee)}</p>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Installment / Item</th>
              <th style={th}>Due Date</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
              <th style={th}>Paid On</th>
              <th style={th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const statusBadge = STATUS_BADGE[e.status];
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ ...td, fontWeight: '700' }}>{e.label}</td>
                  <td style={{ ...td, color: '#6B7280' }}>
                    {new Date(e.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: '700' }}>{fmt(e.amount)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', background: statusBadge.bg, color: statusBadge.color, borderRadius: '20px', fontSize: '11.5px', fontWeight: '700' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusBadge.dot }} />
                      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#6B7280' }}>
                    {e.paid_on ? new Date(e.paid_on).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td style={{ ...td, color: '#9CA3AF', fontSize: '12px' }}>{e.notes || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
