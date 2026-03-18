import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CalendarToday, Close,
  TrendingUp, AccountBalanceWallet, HourglassBottom,
  ErrorOutline, FilterListOff, Schedule, FileDownload,
  Storefront, Add, Edit, Visibility, AssignmentReturn
} from '@mui/icons-material';

const API  = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LIMIT = 15;

const STATUS_MAP = {
  PENDING:   { label: 'Pending',   tw: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-400'   },
  PROCESSED: { label: 'Processed', tw: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-400' },
  CANCELLED: { label: 'Cancelled', tw: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-400' },
};

const QUICK = [
  { key: 'today',     label: 'Today'      },
  { key: 'yesterday', label: 'Yesterday'  },
  { key: 'week',      label: 'This Week'  },
  { key: 'month',     label: 'This Month' },
  { key: '',          label: 'All Time'   },
];

function Badge({ status }) {
  const m = STATUS_MAP[status?.toUpperCase()] || STATUS_MAP.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${m.tw}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── View Drawer ───────────────────────────────────────────────────────────────
function ViewDrawer({ returnId, onClose, onStatusChanged }) {
  const [ret, setRet]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  const load = () => {
    setLoading(true); setError('');
    axios.get(`${API}/api/sales/returns/${returnId}/`, { withCredentials: true })
      .then(r => setRet(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [returnId]);

  const changeStatus = async (s) => {
    if (!window.confirm(`Change status to ${s}?`)) return;
    setBusy(true);
    try {
      await axios.patch(`${API}/api/sales/returns/${returnId}/status/`, { status: s }, { withCredentials: true });
      onStatusChanged(); load();
    } catch (e) { alert(e.response?.data?.error || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[900]" />
      <div className="fixed top-0 right-0 bottom-0 w-[520px] bg-white z-[901] shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-gray-300 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-1">Sales Return</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">{ret ? `#${ret.id}` : '…'}</h2>
              {ret && <Badge status={ret.status} />}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-400">
            <Close sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && <p className="text-center text-gray-300 font-black text-[10px] uppercase tracking-widest py-10">Loading…</p>}
          {error   && <p className="text-red-500 font-bold text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
          {ret && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[['Date', ret.created_at], ['Branch', ret.branch], ['Customer', ret.customer], ['Items', ret.items?.length || 0]].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-2xl p-3.5">
                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] mb-1">{l}</p>
                    <p className="font-black text-gray-800 text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3">Returned Items</p>
                <div className="space-y-1.5">
                  {ret.items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 hover:bg-orange-50 transition-colors">
                      <div>
                        <p className="font-black text-gray-800 text-[12px]">{item.product_name}</p>
                        <p className="text-[9px] text-gray-400 font-bold">qty {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-gray-900 text-sm">Rs {fmtK(item.line_total)}</p>
                        <p className="text-[9px] text-gray-400">@ Rs {fmtK(item.unit_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                {[
                  { l: 'Total Amount',  v: `Rs ${fmtK(ret.net_total)}`,  c: 'text-gray-900' },
                  { l: 'Refunded',      v: `Rs ${fmtK(ret.refunded)}`,   c: 'text-emerald-600' },
                  { l: 'Balance Due',   v: `Rs ${fmtK(ret.balance_remaining)}`, c: ret.balance_remaining > 0 ? 'text-red-500' : 'text-gray-300' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="flex justify-between text-[11px]">
                    <span className="text-gray-400 font-bold">{l}</span>
                    <span className={`font-black ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
              {ret.status?.toUpperCase() === 'PENDING' && (
                <div className="border border-gray-300 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3">Change Status</p>
                  <div className="flex gap-2 flex-wrap">
                    <button disabled={busy} onClick={() => changeStatus('PROCESSED')}
                      className="px-4 py-1.5 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                      Process Return
                    </button>
                  </div>
                  <p className="text-[8px] text-gray-300 font-bold mt-2">Processing increases stock levels.</p>
                </div>
              )}
              {ret.status?.toUpperCase() === 'PROCESSED' && (
                <div className="border border-red-100 bg-red-50/30 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] mb-3">Critical Actions</p>
                  <button disabled={busy} onClick={() => changeStatus('CANCELLED')}
                    className="px-4 py-1.5 rounded-xl border border-red-100 bg-white text-red-600 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-50">
                    Cancel Return
                  </button>
                  <p className="text-[8px] text-red-300 font-bold mt-2">Cancellation reverses stock increase.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function SalesReturns() {
  const navigate = useNavigate();

  const [returns, setReturns]   = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);

  const [branchId, setBranchId] = useState('all');
  const [quick, setQuick]       = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [viewId, setViewId]     = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/sales/form-data/`, { withCredentials: true })
      .then(r => setBranches(r.data.branches || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (pg = 1) => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ page: pg, limit: LIMIT });
      if (branchId !== 'all') p.append('branch_id', branchId);
      if (quick)   p.append('quick', quick);
      else { if (dateFrom) p.append('date_from', dateFrom); if (dateTo) p.append('date_to', dateTo); }
      const r = await axios.get(`${API}/api/sales/returns/?${p}`, { withCredentials: true });
      setReturns(r.data.returns || []);
      setTotal(r.data.total  || 0);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [branchId, quick, dateFrom, dateTo]);

  useEffect(() => { setPage(1); load(1); }, [branchId, quick, dateFrom, dateTo]);
  useEffect(() => { if (page > 1) load(page); }, [page]);

  const handleQuick = (k) => { setQuick(k); setDateFrom(''); setDateTo(''); };
  const totalPages  = Math.ceil(total / LIMIT) || 1;

  const toN = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  const exportCSV = () => {
    const headers = ["Return #", "Date", "Customer", "Branch", "Total", "Refunded", "Remaining", "Status"];
    const rows = returns.map(o => [
      `#${o.id}`,
      o.created_at,
      o.customer,
      o.branch,
      fmtK(o.net_total),
      fmtK(o.refunded),
      fmtK(o.balance_remaining),
      o.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sales_Returns_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalNet  = returns.reduce((s, o) => s + toN(o.net_total), 0);
  const totalPaid = returns.reduce((s, o) => s + toN(o.refunded), 0);
  const totalBal  = returns.reduce((s, o) => s + toN(o.balance_remaining), 0);
  const cntProc   = returns.filter(o => o.status?.toUpperCase() === 'PROCESSED').length;
  const cntPend   = returns.filter(o => o.status?.toUpperCase() === 'PENDING').length;

  const SkeletonRow = () => (
    <tr className="border-b border-gray-50 animate-pulse">
      {[40, 80, 100, 120, 90, 90, 90, 90, 60].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3 bg-gray-100 rounded-full" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300" style={{ fontFamily: 'var(--font-google-sans, Google Sans, sans-serif)', background: '#F8FAFC' }}>

      {/* ── PAGE HEADER ── */}
      <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center">
            <AssignmentReturn sx={{ fontSize: 18, color: '#EA5E28' }} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">
              Sales Returns
            </h1>
            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-none">
              Stock Reversal & Refunds
            </span>
          </div>
        </div>

        <div className="flex justify-center h-full">
          <div className="flex gap-8 h-full items-center">
            {[{ id: 'all', name: 'All' }, ...branches].map(b => {
              const active = branchId === b.id;
              return (
                <button key={b.id} onClick={() => setBranchId(b.id)}
                  className={`group relative flex items-center gap-2.5 h-16 transition-all`}>
                  <Storefront sx={{ fontSize: 16 }} className={active ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {b.name}
                  </span>
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in zoom-in-y duration-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button onClick={() => navigate('/sales/returns/new')}
            className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:shadow-[0_15px_40px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2">
            <Add sx={{ fontSize: 16 }} /> New Return
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">

        {/* KPI Strip */}
        <div className="grid grid-cols-4 bg-white border-b border-gray-300 divide-x divide-gray-300 shrink-0 h-20">
          {[
            { l: 'Return volume',    v: `${cntProc} Processed | ${cntPend} Pend`, s: 'Return lifecycle' },
            { l: 'Total Returns',    v: `Rs ${fmtK(totalNet)}`,    s: 'Gross return value',   c: 'text-gray-900' },
            { l: 'Refunds Issued',   v: `Rs ${fmtK(totalPaid)}`,   s: 'Cash/Bank outflows',   c: 'text-emerald-500' },
            { l: 'Pending Refunds',  v: `Rs ${fmtK(totalBal)}`,    s: 'Outstanding credit',   c: totalBal > 0 ? 'text-red-500' : 'text-gray-300' },
          ].map((k, i) => (
            <div key={i} className="px-8 flex flex-col justify-center gap-0.5 hover:bg-gray-50/50 transition-colors">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{k.l}</p>
              <p className={`text-xl font-black tracking-tighter leading-none ${k.c || 'text-gray-900'}`}>{k.v}</p>
              <p className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter mt-1">{k.s}</p>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="h-14 px-8 border-b border-gray-300/80 flex items-center justify-between bg-gray-50/30 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex bg-white p-1 rounded-xl border border-gray-300 shadow-sm gap-0.5">
              {QUICK.map(q => {
                const active = quick === q.key && !dateFrom && !dateTo;
                return (
                  <button key={q.key} onClick={() => handleQuick(q.key)}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${active ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>
                    {q.label}
                  </button>
                );
              })}
            </div>
            <div className="h-4 w-[1px] bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-xl shadow-sm">
                <CalendarToday sx={{ fontSize: 12 }} className="text-gray-300" />
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setQuick(''); }} className="text-[10px] font-black text-gray-600 outline-none p-0 bg-transparent" />
              </div>
              <span className="text-[10px] font-black text-gray-300">to</span>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-xl shadow-sm">
                <CalendarToday sx={{ fontSize: 12 }} className="text-gray-300" />
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setQuick(''); }} className="text-[10px] font-black text-gray-600 outline-none p-0 bg-transparent" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={exportCSV} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-300 text-gray-400 hover:text-emerald-600 transition-all">
                <FileDownload sx={{ fontSize: 18 }} />
             </button>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{total} Returns</span>
          </div>
        </div>

        {error && (
          <div className="m-8 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-red-500 font-bold text-sm flex items-center gap-2">
            <ErrorOutline sx={{ fontSize: 16 }} /> {error}
          </div>
        )}

        <div className="bg-white flex flex-col">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="bg-gray-50/50 border-b border-gray-300">
                {[
                  { label: '#', align: 'left', w: 'w-16' },
                  { label: 'Date', align: 'left', w: 'w-24' },
                  { label: 'Party Name', align: 'left', w: 'w-48' },
                  { label: 'Branch', align: 'left', w: 'w-32' },
                  { label: 'Total', align: 'right', w: 'w-32' },
                  { label: 'Refunded', align: 'right', w: 'w-32' },
                  { label: 'Remaining', align: 'right', w: 'w-32' },
                  { label: 'Status', align: 'center', w: 'w-24' },
                  { label: 'Actions', align: 'center', w: 'w-20' },
                ].map(({ label, align, w }) => (
                  <th key={label} className={`px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest ${w}`} style={{ textAlign: align }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-20 text-center">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">No returns found</p>
                  </td>
                </tr>
              ) : returns.map((o) => (
                  <tr key={o.id} className="group border-b border-gray-300 transition-all hover:bg-orange-50/20">
                    <td className="px-4 py-2.5 text-[11px] font-black text-primary">#{o.id}</td>
                    <td className="px-4 py-2.5 text-[11px] font-black text-gray-700">
                      <div className="flex items-center gap-1 text-gray-500">
                        <Schedule sx={{ fontSize: 11, color: '#D1D5DB' }} />
                        <span className="font-bold">{o.created_at}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-black text-gray-900">{o.customer}</td>
                    <td className="px-4 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-tighter">{o.branch}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] font-black text-gray-900">Rs {fmtK(o.net_total)}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] font-black text-emerald-600">Rs {fmtK(o.refunded)}</td>
                    <td className="px-4 py-2.5 text-right text-[11px] font-black text-red-500">Rs {fmtK(o.balance_remaining)}</td>
                    <td className="px-4 py-2.5 text-center"><Badge status={o.status} /></td>
                    <td className="px-4 py-2.5 flex items-center justify-center gap-2">
                      {o.status?.toUpperCase() !== 'CANCELLED' && (
                        <button onClick={() => navigate(`/sales/returns/edit/${o.id}`)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-400 hover:text-primary transition-all shadow-sm">
                          <Edit sx={{ fontSize: 14 }} />
                        </button>
                      )}
                      <button onClick={() => setViewId(o.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-400 hover:text-blue-500 transition-all shadow-sm">
                        <Visibility sx={{ fontSize: 14 }} />
                      </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>

          {!loading && returns.length > 0 && (
            <div className="px-8 py-3 border-t border-gray-300 bg-white flex items-center justify-between">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} Records
                </p>
                <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-400 hover:text-primary transition-all disabled:opacity-30">
                        <ChevronLeft sx={{ fontSize: 18 }} />
                    </button>
                    <div className="flex items-center px-4 h-8 bg-gray-50 rounded-xl border border-gray-300 mx-2 text-[10px] font-black">
                         <span className="text-primary">{page}</span>
                         <span className="text-gray-300 mx-1">/</span>
                         <span className="text-gray-400">{totalPages}</span>
                    </div>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-400 hover:text-primary transition-all disabled:opacity-30">
                        <ChevronRight sx={{ fontSize: 18 }} />
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>

      {viewId && (
        <ViewDrawer returnId={viewId} onClose={() => setViewId(null)} onStatusChanged={() => load(page)} />
      )}
    </div>
  );
}
