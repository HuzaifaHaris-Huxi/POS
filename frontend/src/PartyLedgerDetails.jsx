import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowBack, CalendarToday, Description, GetApp, 
    People, Search, AccountBalanceWallet, TrendingUp, TrendingDown,
    ReceiptLong, ErrorOutline, Schedule, Assessment, Storefront
} from '@mui/icons-material';

const API = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PartyLedgerDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [searchQuery, setSearchQuery] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        const params = branchId !== 'all' ? `?branch_id=${branchId}` : '';
        axios.get(`${API}/api/finance/parties/${id}/ledger/${params}`, { withCredentials: true })
            .then(r => {
                setData(r.data);
                setLoading(false);
            })
            .catch(e => {
                setError(e.response?.data?.error || 'Failed to connect to the registry engine.');
                setLoading(false);
            });
    }, [id, branchId]);

    useEffect(() => {
        axios.get(`${API}/api/branches/`, { withCredentials: true })
            .then(r => setBranches(r.data || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleExport = () => {
        if (!data || !data.transactions) return;
        let csv = "Date,Type,Reference,Debit,Credit,Description\n";
        data.transactions.forEach(t => {
            csv += `${t.date},${t.type},"${t.reference}",${t.debit},${t.credit},"${t.description}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ledger_${data.party.display_name}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const fromDateObj = dateRange.from ? new Date(dateRange.from) : null;
    const toDateObj = dateRange.to ? new Date(dateRange.to) : null;

    // 1. Opening Balance Logic (as before)
    const showOpening = branchId === 'all' || Number(branchId) === data?.party?.branch_id;
    const initialOpeningBalance = showOpening ? (data?.party?.opening_balance || 0) : 0;

    // 2. Historical Balance calculation (before the filtered range)
    const historicalTransactions = (data?.transactions || []).filter(t => {
        if (!fromDateObj) return false;
        return new Date(t.date) < fromDateObj;
    });

    const historicalDebit = historicalTransactions.reduce((acc, t) => acc + t.debit, 0);
    const historicalCredit = historicalTransactions.reduce((acc, t) => acc + t.credit, 0);
    const bfBalance = initialOpeningBalance + historicalDebit - historicalCredit;

    // 3. Current range filtering
    const filteredTransactions = (data?.transactions || []).filter(t => {
        const date = new Date(t.date);
        const matchesDate = (!fromDateObj || date >= fromDateObj) && (!toDateObj || date <= toDateObj);
        
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.type.toLowerCase().includes(searchQuery.toLowerCase());
                            
        return matchesDate && matchesSearch;
    });

    // 4. Period Totals
    const currentDebit = filteredTransactions.reduce((acc, t) => acc + t.debit, 0);
    const currentCredit = filteredTransactions.reduce((acc, t) => acc + t.credit, 0);

    // 5. Running Balance
    let runningBalance = bfBalance;
    const ledgerWithRunningBalance = filteredTransactions.map(t => {
        runningBalance += (t.debit - t.credit);
        return { ...t, runningBalance };
    });

    if (loading && !data) return (
        <div className="h-screen flex items-center justify-center bg-[#F8FAFC]" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Synchronizing Ledger Protocol…</p>
            </div>
        </div>
    );

    if (error || !data) return (
        <div className="h-screen flex flex-col items-center justify-center gap-6 bg-[#F8FAFC]" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
                <div className="p-6 bg-red-50 rounded-[32px] border border-red-100 shadow-sm mb-2">
                    <ErrorOutline sx={{ fontSize: 48, color: '#EF4444' }} />
                </div>
                <div>
                   <h2 className="text-[11px] font-black text-red-500 uppercase tracking-[0.3em] mb-2">Access Synchronization Failure</h2>
                   <p className="text-[13px] font-bold text-gray-400 leading-relaxed px-10">
                       {error || "The registry core could not locate the requested entity or scope."}
                   </p>
                </div>
            </div>
            <button onClick={() => navigate('/finance/ledger')} className="px-8 py-3.5 rounded-2xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2">
                <ArrowBack sx={{ fontSize: 16 }} /> Back to Registry
            </button>
        </div>
    );

    const isVendor = data.party.type === 'VENDOR';

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFC] animate-in fade-in duration-500" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            
            {/* ─── ELITE HEADER (Matches Sales style) ─── */}
            <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0 z-50 shadow-sm">
                <div className="flex items-center gap-5">
                    <button onClick={() => navigate('/finance/ledger')} 
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-400 hover:text-primary hover:border-primary/20 transition-all">
                        <ArrowBack sx={{ fontSize: 18 }} />
                    </button>
                    <div className="h-6 w-px bg-gray-200" />
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1 capitalize">
                            {data.party.display_name}
                        </h1>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-none">
                            {data.party.type} Profile · {data.party.phone || 'No Contact'}
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
                                    <Storefront sx={{ fontSize: 18 }} className={active ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} />
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
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

                <div className="flex items-center justify-end gap-3">
                    <div className="flex bg-gray-50/50 p-1 rounded-xl border border-gray-200 shadow-inner">
                        <div className="flex items-center gap-2 px-2">
                            <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} 
                                className="bg-transparent text-[10px] font-black text-gray-600 focus:outline-none p-0 border-none focus:ring-0 w-24" />
                            <span className="text-[9px] font-black text-gray-300 uppercase">to</span>
                            <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} 
                                className="bg-transparent text-[10px] font-black text-gray-600 focus:outline-none p-0 border-none focus:ring-0 w-24" />
                        </div>
                    </div>
                    <button onClick={handleExport} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-300 text-gray-400 hover:text-emerald-500 hover:border-emerald-200 transition-all shadow-sm">
                        <GetApp sx={{ fontSize: 18 }} />
                    </button>
                </div>
            </div>

            {/* ─── SCROLLABLE BODY ─── */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
                
                {/* ── KPI STRIP ── */}
                <div className="grid grid-cols-3 bg-white border-b border-gray-300 divide-x divide-gray-300 shrink-0 h-28 shadow-sm relative z-40 mt-4">
                    {[
                        { label: 'Total Debits (Dr)', v: `Rs ${fmtK(currentDebit)}`, s: 'Current Period Flow', c: 'text-gray-900' },
                        { label: 'Total Credits (Cr)', v: `Rs ${fmtK(currentCredit)}`, s: 'Current Period adjustments', c: 'text-rose-500' },
                        { label: 'Balance Dues (Dr/Cr)', v: `Rs ${fmtK(Math.abs(runningBalance))}`, s: 'Final Net Exposure', c: runningBalance >= 0 ? 'text-emerald-500' : 'text-red-500', sub: runningBalance >= 0 ? 'DR' : 'CR' },
                    ].map((k, i) => (
                        <div key={i} className="px-10 flex flex-col justify-center gap-1.5 hover:bg-gray-50/50 transition-colors group">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none text-center">{k.label}</p>
                            <div className="flex items-baseline justify-center gap-2">
                                <p className={`text-2xl font-black tracking-tighter leading-none ${k.c || 'text-gray-900'}`}>{k.v}</p>
                                {k.sub && <span className="text-[12px] font-black text-gray-300 opacity-50 group-hover:opacity-100 transition-opacity">{k.sub}</span>}
                            </div>
                            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter mt-1 text-center">{k.s}</p>
                        </div>
                    ))}
                </div>

                <div className="px-12 py-4 max-w-screen-2xl mx-auto space-y-10">
                    
                    <div className="bg-white border border-gray-300 rounded-none overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.04)] flex flex-col min-h-[500px]">
                        
                        {/* Table Controls */}
                        <div className="px-10 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                            <div className="flex items-center gap-4">
                               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                               <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Partner Transaction Fabric</h2>
                            </div>
                            <div className="flex items-center gap-6 px-5 py-2.5 bg-white rounded-2xl border border-gray-200 focus-within:border-primary/30 transition-all w-[360px] shadow-sm">
                                <Search className="text-gray-300" sx={{ fontSize: 16 }} />
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Index by ref, entity or classification…" className="text-[11px] font-bold bg-transparent outline-none w-full placeholder:text-gray-300" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-30">
                                    <tr className="bg-gray-50/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] w-28">Date</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">Reference</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Product / Note</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right w-24">Qty</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right w-28">Rate/Amt</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right w-32">Debit (Dr)</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right w-32">Credit (Cr)</th>
                                        <th className="px-8 py-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right w-32">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {dateRange.from ? (
                                        <tr className="bg-gray-50/20 border-b border-gray-100">
                                            <td className="px-8 py-3 italic text-[11px] font-bold text-gray-400 text-center" colSpan={7}>Balance Brought Forward (B/F)</td>
                                            <td className="px-8 py-3 text-right">
                                                <span className="text-[13px] font-black text-gray-500 tracking-tight">
                                                    Rs {fmtK(Math.abs(bfBalance))} 
                                                    <span className="text-[9px] ml-1.5 opacity-40 uppercase">{bfBalance >= 0 ? 'DR' : 'CR'}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ) : (
                                        showOpening && (
                                            <tr className="bg-gray-50/20">
                                                <td className="px-8 py-2 italic text-[11px] font-bold text-gray-300 text-center" colSpan={7}>Baseline Opening Position</td>
                                                <td className="px-8 py-2 text-right">
                                                    <span className="text-[12px] font-black text-gray-400 tracking-tight">
                                                        Rs {fmtK(Math.abs(data.party.opening_balance))} 
                                                        <span className="text-[9px] ml-1 opacity-40">{data.party.opening_balance >= 0 ? 'DR' : 'CR'}</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                    {ledgerWithRunningBalance.length > 0 ? ledgerWithRunningBalance.map((t, i) => (
                                        <tr key={t.id || i} className="hover:bg-primary/[0.01] transition-colors group">
                                            <td className="px-8 py-6">
                                                <span className="text-[11px] font-black tracking-tight text-gray-400 uppercase">
                                                    {(() => {
                                                        const d = new Date(t.date);
                                                        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                        return `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`;
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">{t.reference}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-[13px] font-black text-gray-800 tracking-tight leading-none opacity-80 group-hover:opacity-100 transition-opacity">{t.description}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {t.qty !== null ? (
                                                    <span className="text-[11px] font-black text-gray-500">{t.qty} <span className="opacity-50 lowercase">{t.uom}</span></span>
                                                ) : <span className="text-gray-100">—</span>}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {t.rate !== null ? (
                                                    <span className="text-[11px] font-black text-gray-500">{fmtK(t.rate)}</span>
                                                ) : <span className="text-gray-100">—</span>}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {t.debit > 0 ? (
                                                    <span className="text-[14px] font-black text-emerald-600 tracking-tighter">{fmtK(t.debit)}</span>
                                                ) : (
                                                    <span className="text-gray-100">—</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {t.credit > 0 ? (
                                                    <span className="text-[14px] font-black text-rose-600 tracking-tighter">{fmtK(t.credit)}</span>
                                                ) : (
                                                    <span className="text-gray-100">—</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className={`text-[15px] font-black tracking-tighter ${t.runningBalance >= 0 ? 'text-gray-900' : 'text-rose-800 underline decoration-rose-200 decoration-2 underline-offset-4'}`}>
                                                    {fmtK(Math.abs(t.runningBalance))}
                                                    <span className="text-[9px] ml-1.5 uppercase opacity-30 group-hover:opacity-100 transition-opacity">{t.runningBalance >= 0 ? 'DR' : 'CR'}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="8" className="px-8 py-40 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-10 filter grayscale group-hover:grayscale-0 transition-all duration-1000">
                                                    <ReceiptLong sx={{ fontSize: 100 }} />
                                                    <p className="text-[12px] font-black uppercase tracking-[0.5em] mt-8">Zero Protocol Activity Detected</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center opacity-40">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 border border-gray-300 rounded-full flex items-center justify-center text-[10px] font-black text-gray-300">SEC</div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none italic">Verified Digital Audit Path · Transaction Log Secured</span>
                        </div>
                        <div className="text-[8px] font-bold text-gray-300 uppercase tracking-widest text-right">
                            Engine Version 4.0.0-LE <br/> Generated {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
