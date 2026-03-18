import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingBag, Storefront, PersonOutline, Add, Edit, Visibility,
    ChevronLeft, ChevronRight, CalendarToday, Close,
    TrendingUp, TrendingDown, AccountBalanceWallet, HourglassBottom,
    ErrorOutline, FilterListOff, Schedule, LocalShipping, Payment,
    FileDownloadOutlined, SearchOutlined, EventOutlined
} from '@mui/icons-material';

const API = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LIMIT = 18; 

const STATUS_MAP = {
    PENDING: { label: 'Pending', tw: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-400' },
    RECEIVED: { label: 'Received', tw: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-400' },
    CANCELLED: { label: 'Cancelled', tw: 'bg-zinc-100 text-zinc-400 border-zinc-200', dot: 'bg-zinc-300' },
};

function Badge({ status }) {
    const m = STATUS_MAP[status?.toUpperCase()] || STATUS_MAP.PENDING;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${m.tw}`}>
            {m.label}
        </span>
    );
}

//  View Drawer (Flat Thin Style) 
function ViewDrawer({ orderId, onClose, onStatusChanged }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true); setError('');
        axios.get(`${API}/api/purchase/${orderId}/`, { withCredentials: true })
            .then(r => setOrder(r.data))
            .catch(e => setError(e.response?.data?.error || 'Failed to load.'))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [orderId]);

    const changeStatus = async (s) => {
        if (!window.confirm(`Confirm status change to ${s.toUpperCase()}?`)) return;
        setBusy(true);
        try {
            await axios.patch(`${API}/api/purchase/${orderId}/status/`, { status: s }, { withCredentials: true });
            onStatusChanged(); load();
        } catch (e) { alert(e.response?.data?.error || 'Failed.'); }
        finally { setBusy(false); }
    };

    return (
        <>
            <div onClick={onClose} className="fixed inset-0 bg-black/5 z-[900]" />
            <div className="fixed top-0 right-0 bottom-0 w-[450px] bg-white z-[901] flex flex-col border-l border-gray-300/60 animate-in slide-in-from-right duration-200 shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-300/60 flex items-center justify-between shrink-0">
                    <div>
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Acquisition Record</p>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-gray-900 tracking-tight">#{order ? order.id : ''}</h2>
                            {order && <Badge status={order.status} />}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-900 transition-colors">
                        <Close sx={{ fontSize: 18 }} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                    {loading && <p className="text-center text-gray-300 font-bold text-[9px] uppercase tracking-widest py-10 leading-none">Syncing...</p>}
                    {order && (
                        <>
                            <div className="grid grid-cols-2 gap-1 border border-gray-300/60 rounded-xl overflow-hidden shadow-sm">
                                {[
                                    ['Date', order.date || order.created_at?.split(' ')[0]],
                                    ['Branch', order.branch || 'Main'],
                                    ['Vendor', order.vendor_name],
                                    ['Items', order.items?.length || 0]
                                ].map(([l, v]) => (
                                    <div key={l} className="bg-white p-3 border-b border-r border-gray-300/40 last:border-b-0">
                                        <p className="text-[7px] font-black text-gray-300 uppercase tracking-widest mb-1">{l}</p>
                                        <p className="font-bold text-gray-800 text-[11px] truncate leading-none">{v}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">Item Detail</p>
                                <div className="border border-gray-300/60 rounded-xl overflow-hidden divide-y divide-gray-300/40 shadow-sm">
                                    {order.items?.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800 text-[11px] leading-tight">{item.product_name}</p>
                                                <p className="text-[8px] text-gray-400 font-bold uppercase">{item.quantity} {item.uom_code} @ Rs {fmtK(item.unit_price)}</p>
                                            </div>
                                            <p className="font-black text-gray-900 text-[11px] ml-4">Rs {fmtK(item.quantity * item.unit_price)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-300/60 space-y-2">
                                {[
                                    { l: 'Base Subtotal', v: order.total_cost },
                                    { l: 'Discount Apply', v: -(order.total_cost * order.discount_percent / 100), c: 'text-red-500' },
                                    { l: 'Tax Module', v: (order.total_cost * order.tax_percent / 100) },
                                    { l: 'Extra Overhead', v: order.expenses?.reduce((s, e) => s + e.amount, 0) || 0 },
                                ].map(({ l, v, c }) => (
                                    <div key={l} className="flex justify-between text-[10px] font-bold">
                                        <span className="text-gray-400 uppercase tracking-tighter">{l}</span>
                                        <span className={c || 'text-gray-700'}>Rs {fmtK(Math.abs(v))}</span>
                                    </div>
                                ))}
                                <div className="pt-3 border-t border-gray-300/60 flex justify-between items-end">
                                    <span className="font-black text-primary uppercase tracking-widest text-[9px]">Net Settlement</span>
                                    <span className="font-black text-gray-900 text-xl tracking-tighter leading-none">Rs {fmtK(order.net_total)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-black text-gray-400 mt-2 uppercase">
                                    <span>Cleared: Rs {fmtK(order.paid)}</span>
                                    <span className={order.balance_due > 0 ? 'text-red-400' : ''}>Balance: Rs {fmtK(order.balance_due)}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-300/60">
                                <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-3">Record Lifecycle</p>
                                <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                                    {['pending', 'received', 'cancelled'].map(s => (
                                        <button key={s} disabled={busy || order.status === s} onClick={() => changeStatus(s)}
                                            className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${order.status === s ? 'bg-white text-primary shadow-sm border border-orange-100' : 'text-gray-400 hover:text-gray-600'}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

//  MAIN (Edge-to-Edge List View) 
export default function PurchaseOrders() {
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [branchId, setBranchId] = useState('all');
    const [statusFilter, setStatusFilter] = useState('');
    const [viewId, setViewId] = useState(null);

    // Advanced Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Summary Stats
    const [stats, setStats] = useState({ pending: 0, received: 0, totalNet: 0, totalPaid: 0, totalDue: 0 });

    useEffect(() => {
        axios.get(`${API}/api/purchase/form-data/`, { withCredentials: true })
            .then(r => setBranches(r.data.branches || []))
            .catch(() => { });
    }, []);

    const load = useCallback(async (pg = 1) => {
        setLoading(true); setError('');
        try {
            const offset = (pg - 1) * LIMIT;
            const p = new URLSearchParams({ offset, limit: LIMIT });
            if (branchId !== 'all') p.append('branch_id', branchId);
            if (statusFilter) p.append('status', statusFilter);
            if (fromDate) p.append('from_date', fromDate);
            if (toDate) p.append('to_date', toDate);

            const r = await axios.get(`${API}/api/purchase/?${p}`, { withCredentials: true });
            const data = r.data.orders || [];
            setOrders(data);
            setTotal(r.data.count || 0);

            // Calc summary stats from the full list (ideally backend provides this, but we'll do client-side if data is small or use current page)
            const pnd = data.filter(x => x.status === 'pending').length;
            const rcv = data.filter(x => x.status === 'received').length;
            const net = data.reduce((s, o) => s + toN(o.net_total), 0);
            const paid = data.reduce((s, o) => s + toN(o.paid), 0);
            const due = data.reduce((s, o) => s + toN(o.balance), 0);
            setStats({ pending: pnd, received: rcv, totalNet: net, totalPaid: paid, totalDue: due });

        } catch (e) { setError('Sync error.'); }
        finally { setLoading(false); }
    }, [branchId, statusFilter, fromDate, toDate]);

    useEffect(() => { setPage(1); load(1); }, [branchId, statusFilter, fromDate, toDate]);
    useEffect(() => { if (page > 1) load(page); }, [page]);

    const setQuickFilter = (type) => {
        const now = new Date();
        let start = new Date();
        if (type === 'today') {
            setFromDate(now.toISOString().split('T')[0]);
            setToDate(now.toISOString().split('T')[0]);
        } else if (type === 'week') {
            start.setDate(now.getDate() - 7);
            setFromDate(start.toISOString().split('T')[0]);
            setToDate(now.toISOString().split('T')[0]);
        } else if (type === 'month') {
            start.setMonth(now.getMonth() - 1);
            setFromDate(start.toISOString().split('T')[0]);
            setToDate(now.toISOString().split('T')[0]);
        } else {
            setFromDate(''); setToDate('');
        }
    };

    const handleExport = () => {
        if (!orders.length) return;
        const headers = ["#", "Date", "Vendor", "Branch", "Net Total", "Paid", "Balance", "Status"];
        const rows = orders.map(o => [
            `#${o.id}`, o.date, o.vendor, o.branch,
            o.net_total, o.paid, o.balance, o.status
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PO_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toN = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const totalPages = Math.ceil(total / LIMIT) || 1;

    // KPI Summary
    const pageNet = orders?.reduce((s, o) => s + toN(o.net_total), 0) || 0;
    const pageBal = orders?.reduce((s, o) => s + toN(o.balance), 0) || 0;

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden animate-in fade-in duration-200" style={{ fontFamily: "'Google Sans', sans-serif" }}>

            {/* HEADER (3-Column Grid Elite) */}
            <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0">
                {/* Left Column: Page Identity */}
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="text-primary" sx={{ fontSize: 18 }} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">
                           Purchases
                        </h1>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-none">Acquisition Lifecycle</span>
                    </div>
                </div>

                {/* Center Column: Branch Selection Tabs */}
                <div className="flex justify-center h-full">
                    <div className="flex gap-8 h-full items-center">
                        {[{ id: 'all', name: 'All' }, ...branches].map(b => (
                            <button key={b.id} onClick={() => setBranchId(b.id)}
                                className={`group relative flex items-center gap-2.5 h-16 transition-all`}>
                                <Storefront sx={{ fontSize: 16 }} className={branchId === b.id ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${branchId === b.id ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                                    {b.name}
                                </span>
                                {branchId === b.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in zoom-in-y duration-300" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Column: Premium Action */}
                <div className="flex items-center justify-end">
                    <button onClick={() => navigate('/purchase/new')}
                        className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:shadow-[0_15px_40px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2">
                        <Add sx={{ fontSize: 16 }} /> New Order
                    </button>
                </div>
            </div>

            {/* KPI BAR (Neo-Minimalist Dashboard) */}
            <div className="grid grid-cols-4 border-b border-gray-300 h-20 shrink-0 divide-x divide-gray-300 bg-white">
                {[
                    { l: 'Record Flow', v: `${stats.pending} Pending | ${stats.received} Rcv`, s: 'Lifecycle volume' },
                    { l: 'Aggregate Cost', v: `Rs ${fmtK(stats.totalNet)}`, s: 'Total net value' },
                    { l: 'Liquidity Out', v: `Rs ${fmtK(stats.totalPaid)}`, s: 'Settled amount', c: 'text-emerald-500' },
                    { l: 'Pending Dues', v: `Rs ${fmtK(stats.totalDue)}`, s: 'Outstanding credit', c: stats.totalDue > 0 ? 'text-red-500' : 'text-gray-400' },
                ].map((k, i) => (
                    <div key={i} className="px-8 py-4 flex flex-col justify-center gap-1 hover:bg-gray-50/50 transition-colors">
                        <p className="text-[8px] font-black text-gray-900 uppercase tracking-widest leading-none">{k.l}</p>
                        <p className={`text-lg font-black tracking-tighter leading-none ${k.c || 'text-gray-900'}`}>{k.v}</p>
                        <p className="text-[7px] font-bold text-gray-300 uppercase tracking-tighter">{k.s}</p>
                    </div>
                ))}
            </div>

            {/* FILTER BAR (Advanced Power-User Tool) */}
            <div className="h-14 px-6 border-b border-gray-300/80 flex items-center justify-between bg-gray-50/30 shrink-0">
                <div className="flex items-center gap-6">
                    {/* Date Presets */}
                    <div className="flex bg-white p-1 rounded-xl border border-gray-300 shadow-sm gap-0.5">
                        {['all', 'today', 'week', 'month'].map(t => (
                            <button key={t} onClick={() => setQuickFilter(t)} 
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${(t === 'all' && !fromDate) || (t === 'today' && fromDate === new Date().toISOString().split('T')[0]) ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="h-4 w-[1px] bg-gray-200" />

                    {/* Custom Range */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-xl shadow-sm">
                            <CalendarToday sx={{ fontSize: 12 }} className="text-gray-300" />
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-[10px] font-black text-gray-600 outline-none p-0" />
                        </div>
                        <span className="text-[10px] font-black text-gray-300">to</span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-xl shadow-sm">
                            <CalendarToday sx={{ fontSize: 12 }} className="text-gray-300" />
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-[10px] font-black text-gray-600 outline-none p-0" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Toggle */}
                    <div className="flex bg-white p-1 rounded-xl border border-gray-300 shadow-sm gap-0.5">
                        {['', 'pending', 'received'].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)} 
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${statusFilter === s ? 'bg-orange-50 text-primary border border-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}>
                                {s || 'All States'}
                            </button>
                        ))}
                    </div>

                    <div className="h-4 w-[1px] bg-gray-200" />

                    <button onClick={handleExport} className="h-9 w-9 flex items-center justify-center bg-white border border-gray-300 rounded-xl text-gray-400 hover:text-emerald-500 hover:border-emerald-100 hover:bg-emerald-50 transition-all shadow-sm">
                        <FileDownloadOutlined sx={{ fontSize: 18 }} />
                    </button>
                </div>
            </div>

            {/* TABLE (Edge-to-Edge) */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <table className="w-full text-left truncate">
                    <thead className="sticky top-0 bg-white z-10 border-b border-gray-300">
                        <tr>
                            {[
                                { l: '#', w: '70px' },
                                { l: 'Order Date', w: '140px' },
                                { l: 'Party Name', w: '250px' },
                                { l: 'Branch', w: '150px' },
                                { l: 'Net Total', w: '130px', a: 'text-right' },
                                { l: 'Paid', w: '130px', a: 'text-right' },
                                { l: 'Remaining', w: '130px', a: 'text-right' },
                                { l: 'Status', w: '110px', a: 'text-center' },
                                { l: 'Actions', w: '90px', a: 'text-right' }
                            ].map(h => (
                                <th key={h.l} className={`px-6 py-4 text-[10px] font-black text-gray-300 uppercase tracking-widest ${h.a || ''}`} style={{ width: h.w }}>{h.l}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300/60 leading-none">
                        {loading ? (
                             [...Array(12)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={8} className="px-6 py-4 h-[52px]"></td>
                                </tr>
                             ))
                        ) : orders.map(o => (
                            <tr key={o.id} className="group hover:bg-orange-50/5 transition-colors cursor-pointer border-b border-gray-300/60 last:border-0" onClick={() => setViewId(o.id)}>
                                <td className="px-6 py-4 text-[12px] font-black text-gray-300">#{o.id}</td>
                                <td className="px-6 py-4">
                                   <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                                     <EventOutlined sx={{ fontSize: 13, opacity: 0.3 }} />
                                     {o.date}
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-300/60 flex items-center justify-center text-gray-400">
                                            <PersonOutline sx={{ fontSize: 14 }} />
                                        </div>
                                        <p className="text-[12px] font-black text-gray-800 tracking-tight leading-none">{o.vendor}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <Storefront sx={{ fontSize: 12, opacity: 0.5 }} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{o.branch || 'Main'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-[12px] font-black text-gray-900">Rs {fmtK(o.net_total)}</td>
                                <td className="px-6 py-4 text-right text-[12px] font-black text-emerald-500">Rs {fmtK(o.paid)}</td>
                                <td className="px-6 py-4 text-right text-[12px] font-black text-red-400">Rs {fmtK(o.balance)}</td>
                                <td className="px-6 py-4 text-center"><Badge status={o.status} /></td>
                                <td className="px-6 py-4 text-right pr-6">
                                    <div className="flex justify-end gap-1.5">
                                        <button onClick={(e) => { e.stopPropagation(); setViewId(o.id); }} className="h-8 w-8 flex items-center justify-center bg-white border border-gray-300/60 rounded-lg text-gray-300 hover:text-emerald-500 transition-all shadow-sm"><Visibility sx={{ fontSize: 15 }} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase/edit/${o.id}`); }} className="h-8 w-8 flex items-center justify-center bg-white border border-gray-300/60 rounded-lg text-gray-300 hover:text-primary transition-all shadow-sm"><Edit sx={{ fontSize: 15 }} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && orders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-10">
                        <ShoppingBag sx={{ fontSize: 60 }} />
                        <p className="font-black uppercase tracking-[0.5em] text-xs mt-4">Empty History</p>
                    </div>
                )}
            </div>

            {/* FOOTER PAGINATION (Flush) */}
            {!loading && total > 0 && (
                <div className="h-14 border-t border-gray-300 flex items-center justify-between px-6 shrink-0 bg-white shadow-[0_-4px_20px_0_rgba(0,0,0,0.02)]">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">Record Stack: {orders.length} / {total}</p>
                    <div className="flex items-center gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-9 px-3 border border-gray-300 rounded-xl text-gray-400 hover:text-primary disabled:opacity-30 transition-all"><ChevronLeft sx={{ fontSize: 18 }} /></button>
                        <span className="text-[10px] font-black text-gray-400 mx-5 tracking-widest">{page} / {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-9 px-3 border border-gray-300 rounded-xl text-gray-400 hover:text-primary disabled:opacity-30 transition-all"><ChevronRight sx={{ fontSize: 18 }} /></button>
                    </div>
                </div>
            )}

            {viewId && <ViewDrawer orderId={viewId} onClose={() => setViewId(null)} onStatusChanged={() => load(page)} />}
        </div>
    );
}
