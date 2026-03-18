import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Box, TextField, Button, Typography, CircularProgress } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import PaymentIcon from '@mui/icons-material/Payment';

const BACKEND_URL = 'http://localhost:8000';

const fmt = (n) => `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

const TYPE_BADGE = {
  setup:   { bg: '#F0F9FF', color: '#0EA5E9', label: 'Setup Fee' },
  monthly: { bg: '#F0FDF4', color: '#22C55E', label: 'Monthly'   },
};

const STATUS_BADGE = {
  collected: { bg: '#F0FDF4', color: '#16A34A', dot: '#22C55E' },
  upcoming:  { bg: '#FFFBF5', color: '#D97706', dot: '#F59E0B' },
  pending:   { bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
};

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px 24px', borderTop: `3px solid ${accent}` }}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#111827' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>{sub}</p>}
    </div>
  );
}

const Spinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite', display: 'inline' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
    <circle style={{ opacity: .2 }} cx="12" cy="12" r="10" stroke="#EA5E28" strokeWidth="4" />
    <path style={{ opacity: .8 }} fill="#EA5E28" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default function Ledger() {
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');   // 'all' | 'collected' | 'pending' | 'upcoming'
  const [search,  setSearch]  = useState('');

  // Payment Modal State
  const [payModal, setPayModal] = useState({ open: false, entry: null });
  const [payForm, setPayForm] = useState({ amount: '', notes: '' });
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ledger/`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error || 'Failed to load ledger.');
    } catch (err) { 
      console.error('Global Ledger Error:', err);
      setError('Cannot connect to server.'); 
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenPay = (entry) => {
    setPayModal({ open: true, entry });
    setPayForm({ amount: entry.amount, notes: '' });
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPaySubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ledger/record/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: payModal.entry.business_id,
          payment_type: payModal.entry.type,
          subscription_month: payModal.entry.month_key,
          amount: payForm.amount,
          notes: payForm.notes
        })
      });
      if (res.ok) {
        setPayModal({ open: false, entry: null });
        fetchData(); // Refresh list
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to record payment');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setPaySubmitting(false);
    }
  };

  const entries = data?.entries || [];
  const summary = data?.summary || {};

  const visible = entries.filter(e => {
    const matchStatus = filter === 'all' || e.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || e.business_name.toLowerCase().includes(q) || e.business_code.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const th = { padding: '10px 14px', fontSize: '11.5px', fontWeight: '700', color: '#6B7280', textAlign: 'left', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#F9FAFB', whiteSpace: 'nowrap' };
  const td = { padding: '13px 14px', fontSize: '13.5px', color: '#374151', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '36px 32px', minHeight: '100vh' }}>

      {/* Page title */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827' }}>Ledger</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9CA3AF' }}>Subscription and setup fee collection records</p>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#DC2626', fontSize: '13.5px' }}>{error}</div>}

      {/* Summary cards */}
      {!loading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <SummaryCard
            label="Total Collected"
            value={fmt(summary.total_collected || 0)}
            sub={`${summary.entry_count || 0} payments received`}
            accent="#22C55E"
          />
          <SummaryCard
            label="Upcoming (Next Month)"
            value={fmt(summary.total_upcoming || 0)}
            sub="From active monthly subscriptions"
            accent="#F59E0B"
          />
          <SummaryCard
            label="Total Revenue"
            value={fmt((summary.total_collected || 0) + (summary.total_upcoming || 0))}
            sub="Collected + upcoming"
            accent="#EA5E28"
          />
        </div>
      )}

      {/* Filters + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['all', 'collected', 'pending', 'upcoming'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '7px 16px', borderRadius: '20px', border: '1px solid', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              background: filter === f ? '#EA5E28' : '#fff',
              borderColor: filter === f ? '#EA5E28' : '#E5E7EB',
              color: filter === f ? '#fff' : '#6B7280',
            }}>
            {f === 'all' ? 'All' : f === 'collected' ? '✓ Collected' : f === 'pending' ? '⚠ Pending' : '⏳ Upcoming'}
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by business name or code…"
          style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: '9px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#111827', minWidth: '240px' }}
          onFocus={e => e.target.style.borderColor = '#EA5E28'}
          onBlur={e => e.target.style.borderColor = '#E5E7EB'}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#9CA3AF' }}>
            <Spinner /> Loading ledger…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#9CA3AF', fontSize: '14px' }}>No entries found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Business</th>
                  <th style={th}>Type</th>
                  <th style={th}>Description</th>
                  <th style={th}>Due Date</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e, i) => {
                  const typeBadge   = TYPE_BADGE[e.type]   || TYPE_BADGE.setup;
                  const statusBadge = STATUS_BADGE[e.status] || STATUS_BADGE.upcoming;
                  return (
                    <tr key={e.id}
                      style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', opacity: e.status === 'upcoming' ? 0.65 : 1 }}
                      onMouseEnter={ev => ev.currentTarget.style.background = '#FFF5F0'}
                      onMouseLeave={ev => ev.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA'}>
                      <td style={{ ...td, color: '#9CA3AF', fontSize: '12px', width: '36px' }}>{i + 1}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: '#111827', cursor: 'pointer' }} onClick={() => navigate(`/businesses/${e.business_id}/ledger`)}>
                              {e.business_name}
                            </div>
                            <code style={{ fontSize: '11.5px', color: '#9CA3AF' }}>{e.business_code}</code>
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        <span style={{ padding: '2px 9px', background: typeBadge.bg, color: typeBadge.color, borderRadius: '20px', fontSize: '11.5px', fontWeight: '700' }}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td style={{ ...td, color: '#6B7280' }}>{e.label}</td>
                      <td style={{ ...td, color: '#6B7280', fontSize: '13px' }}>
                        {new Date(e.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: '700', color: '#111827' }}>
                        {fmt(e.amount)}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', background: statusBadge.bg, color: statusBadge.color, borderRadius: '20px', fontSize: '11.5px', fontWeight: '700' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusBadge.dot, display: 'inline-block' }} />
                          {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                           {e.status === 'pending' && (
                             <button onClick={() => handleOpenPay(e)} title="Receive Payment" style={{ background: '#EA5E28', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}>
                               <PaymentIcon style={{ fontSize: '14px' }} /> Pay
                             </button>
                           )}
                           <button onClick={() => navigate(`/businesses/${e.business_id}/ledger`)} title="View Detail" style={{ background: '#F3F4F6', color: '#4B5563', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer' }}>
                             <HistoryIcon style={{ fontSize: '18px' }} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal open={payModal.open} onClose={() => !paySubmitting && setPayModal({ open: false, entry: null })}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 400, bgcolor: 'background.paper', borderRadius: '24px', boxShadow: 24, p: 4, outline: 'none'
        }}>
          <Typography variant="h6" fontWeight="800" gutterBottom>Receive Payment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Recording payment for <b>{payModal.entry?.business_name}</b> - {payModal.entry?.label}
          </Typography>

          <form onSubmit={handlePaySubmit}>
            <TextField
              fullWidth label="Amount" type="number" margin="normal"
              value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
              required disabled={paySubmitting}
              slotProps={{ input: { startAdornment: <span style={{ marginRight: 8, color: '#9CA3AF' }}>PKR</span> } }}
            />
            <TextField
              fullWidth label="Notes" multiline rows={2} margin="normal"
              value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
              placeholder="Check no, reference, etc." disabled={paySubmitting}
            />

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button fullWidth onClick={() => setPayModal({ open: false, entry: null })} disabled={paySubmitting}>Cancel</Button>
              <Button fullWidth variant="contained" type="submit" disabled={paySubmitting}
                sx={{ bgcolor: '#EA5E28', '&:hover': { bgcolor: '#D95221' }, fontWeight: '700', borderRadius: '12px' }}>
                {paySubmitting ? <CircularProgress size={20} color="inherit" /> : 'Confirm Payment'}
              </Button>
            </Box>
          </form>
        </Box>
      </Modal>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
