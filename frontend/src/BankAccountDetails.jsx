import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    AccountBalance, AccountBalanceWallet, ArrowBack, 
    CalendarToday, Description, GetApp, Storefront,
    Search, FilterList
} from '@mui/icons-material';

const API = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankAccountDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [searchQuery, setSearchQuery] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (dateRange.from) params.from_date = dateRange.from;
        if (dateRange.to) params.to_date = dateRange.to;

        axios.get(`${API}/api/finance/accounts/${id}/ledger/`, { params, withCredentials: true })
            .then(r => {
                setData(r.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id, dateRange]);

    useEffect(() => {
        load();
    }, [load]);

    const handleExport = () => {
        if (!data || !data.transactions) return;
        let csv = "Date,Description,Type,Branch,Amount\n";
        data.transactions.forEach(t => {
            csv += `${t.date},"${t.description}",${t.flow_type},${t.branch_name},${t.amount}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ledger_${data.account_name}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const filteredTransactions = data?.transactions?.filter(t => 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toString().includes(searchQuery)
    ) || [];

    if (loading && !data) return (
        <div className="h-screen flex items-center justify-center bg-gray-50" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            <div className="text-center space-y-4">
                <div className="w-10 h-10 border-4 border-orange-100 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest">Hydrating Ledger Details…</p>
            </div>
        </div>
    );

    if (!data) return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-red-500 font-black text-sm uppercase tracking-widest">Account Registry Error</p>
            </div>
            <button onClick={() => navigate('/finance/accounts')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest">
                <ArrowBack sx={{ fontSize: 16 }} /> Return to Accounts
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50" style={{ fontFamily: "'Google Sans', 'Segoe UI', sans-serif" }}>
            
            {/* ══════════════ ELITE STICKY HEADER ══════════════ */}
            <div className="bg-white border-b border-gray-300 px-8 h-16 flex items-center justify-between shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/finance/accounts')} 
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-300 text-gray-400 hover:text-primary hover:border-primary/30 transition-all group">
                        <ArrowBack sx={{ fontSize: 20 }} />
                    </button>
                    <div className="h-8 w-px bg-gray-200" />
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center shadow-inner">
                            <AccountBalanceWallet className="text-primary" sx={{ fontSize: 20 }} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">{data.account_name}</h1>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none tracking-tighter italic">{data.bank_name || 'Physical Liquidity Source'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300 shadow-sm">
                        <div className="flex items-center gap-2">
                            <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} 
                                className="bg-transparent text-[10px] font-black text-gray-600 focus:outline-none p-0 border-none focus:ring-0 w-24" />
                            <span className="text-[9px] font-black text-gray-300 uppercase">to</span>
                            <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} 
                                className="bg-transparent text-[10px] font-black text-gray-600 focus:outline-none p-0 border-none focus:ring-0 w-24" />
                        </div>
                        <button onClick={load} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary transition-all">Filter</button>
                    </div>
                    <button onClick={handleExport} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-300 text-gray-400 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
                        <GetApp sx={{ fontSize: 18 }} />
                    </button>
                </div>
            </div>

            {/* ══════════════ WORKSPACE ══════════════ */}
            <div className="flex-1 overflow-y-auto px-12 py-10 no-scrollbar space-y-10">
                
                {/* Visual Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {[
                        { label: 'Initial Opening Balance', val: data.opening_balance, Icon: AccountBalance, color: 'text-gray-900' },
                        { label: 'Net Liquidity (Ledger)', val: data.current_balance, Icon: AccountBalanceWallet, color: 'text-primary' },
                        { label: 'Transaction Density', val: data.transactions?.length || 0, Icon: Description, color: 'text-gray-900', isCount: true },
                    ].map((s, i) => (
                        <div key={i} className="bg-white border border-gray-300 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 z-10 relative">{s.label}</p>
                            <h3 className={`text-2xl font-black ${s.color} tracking-tighter leading-none z-10 relative`}>
                                {s.isCount ? s.val : `Rs ${fmtK(s.val)}`}
                            </h3>
                            <s.Icon className="absolute -bottom-6 -right-6 text-gray-50 group-hover:text-primary/5 transition-colors duration-500" sx={{ fontSize: 130 }} />
                        </div>
                    ))}
                </div>

                {/* Ledger Workspace */}
                <div className="max-w-7xl mx-auto bg-white border border-gray-300 rounded-[40px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.04)] flex flex-col min-h-[500px]">
                    
                    {/* Workspace Controls */}
                    <div className="px-10 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_emerald]" />
                           <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Transaction Ledger Flow</h2>
                        </div>
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-white rounded-2xl border border-gray-200 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 transition-all w-72">
                            <Search className="text-gray-300" sx={{ fontSize: 16 }} />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Query description or ID…" className="text-[11px] font-bold bg-transparent outline-none w-full placeholder:text-gray-300" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-gray-50/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Temporal Node</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Event Specification</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Logic Pair (Branch)</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Settlement Vector</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Magnitude</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredTransactions.length > 0 ? filteredTransactions.map((t, i) => (
                                    <tr key={t.id} className="hover:bg-primary/[0.015] transition-colors group">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-primary transition-colors" />
                                                <span className="text-[11px] font-bold text-gray-600">{t.date}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-black text-gray-800 tracking-tight leading-tight group-hover:text-primary transition-colors">{t.description}</span>
                                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-1">TX-GENESIS: #{t.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-2.5">
                                                <Storefront sx={{ fontSize: 13 }} className="text-gray-300 group-hover:text-primary/40 transition-colors" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{t.branch_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${t.flow_type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {t.flow_type === 'IN' ? 'Credit / Liquid In' : 'Debit / Liquid Out'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className={`text-base font-black tracking-tighter ${t.flow_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.flow_type === 'IN' ? '+' : '-'} Rs {fmtK(t.amount)}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-32 text-center">
                                            <div className="flex flex-col items-center justify-center opacity-10 grayscale group-hover:grayscale-0 transition-all duration-700">
                                                <Description sx={{ fontSize: 80 }} />
                                                <p className="text-[12px] font-black uppercase tracking-[0.5em] mt-6">Void Transaction Space</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Auxiliary Footer Data */}
                <div className="max-w-7xl mx-auto flex justify-end gap-2 text-[10px] font-black text-gray-300 uppercase tracking-widest pb-10">
                   <span>Secure Finance Core</span>
                   <span className="opacity-20">•</span>
                   <span>Audit Log Verified</span>
                </div>
            </div>
        </div>
    );
}
