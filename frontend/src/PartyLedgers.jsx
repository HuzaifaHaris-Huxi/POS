import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    People, Storefront, Visibility, Search,
    Person, LocalShipping, Add, FilterList,
    TrendingUp, AccountBalanceWallet, ReceiptLong,
    ChevronLeft, ChevronRight, Business, Assessment
} from '@mui/icons-material';

const API = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PartyLedgers() {
    const navigate = useNavigate();
    const [parties, setParties] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branchId, setBranchId] = useState('all');
    const [partyType, setPartyType] = useState('customer'); // customer or vendor
    const [searchQuery, setSearchQuery] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchId !== 'all') params.append('branch_id', branchId);
            params.append('type', partyType);
            if (searchQuery) params.append('search', searchQuery);
            
            const r = await axios.get(`${API}/api/finance/parties/?${params.toString()}`, { withCredentials: true });
            setParties(r.data.parties || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [branchId, partyType, searchQuery]);

    useEffect(() => {
        axios.get(`${API}/api/branches/`, { withCredentials: true })
            .then(r => setBranches(r.data || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // KPI Aggregations
    const totalExposure = parties.reduce((acc, p) => acc + Math.abs(p.cached_balance), 0);
    const solventCount = parties.filter(p => p.cached_balance >= 0).length;
    const liabilityCount = parties.length - solventCount;
    const isCx = partyType === 'customer';

    const SkeletonRow = () => (
        <tr className="border-b border-gray-50 animate-pulse">
            {[100, 200, 150, 120, 140].map((w, i) => (
                <td key={i} className="px-10 py-6">
                    <div className="h-3 bg-gray-100 rounded-full" style={{ width: w }} />
                </td>
            ))}
        </tr>
    );

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFC] animate-in fade-in duration-500" style={{ fontFamily: 'var(--font-google-sans, Google Sans, sans-serif)' }}>
            
            {/* ─── ELITE HEADER (3-Column) ─── */}
            <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0 z-50 shadow-sm relative">
                {/* Left: Identity */}
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner">
                        <Assessment sx={{ fontSize: 20, color: '#EA5E28' }} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">Party Ledgers</h1>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-none">Financial Registry & Exposure</span>
                    </div>
                </div>

                {/* Mid: Branch Under-line Tabs */}
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

                {/* Right: Toggle Actions */}
                <div className="flex items-center justify-end gap-2">
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200 shadow-inner">
                        {[
                            { k: 'all',      l: 'All',      i: Business },
                            { k: 'customer', l: 'Customers', i: Person },
                            { k: 'vendor',   l: 'Vendors',   i: LocalShipping }
                        ].map(t => (
                            <button key={t.k} onClick={() => setPartyType(t.k)}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${partyType === t.k ? 'bg-gray-900 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                                <t.i sx={{ fontSize: 14 }} />
                                {t.l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
                
                {/* ── KPI STRIP (Adaptive) ── */}
                <div className="grid grid-cols-4 bg-white border-b border-gray-300 divide-x divide-gray-300 shrink-0 h-20 shadow-sm relative z-40">
                    {[
                        { l: 'Network Magnitude', v: `${parties.length} Entities`, s: `Registered ${partyType}s`, i: People },
                        { l: 'Solvency Pulse',    v: `${solventCount} Solvent`,    s: isCx ? 'Net Receivables' : 'Advance Credits', c: 'text-emerald-600' },
                        { l: 'Exposure Risk',     v: `${liabilityCount} Active`,   s: isCx ? 'Credits Extended' : 'Payable Dues', c: 'text-rose-500' },
                        { l: 'Aggregate Flow',    v: `Rs ${fmtK(totalExposure)}`,  s: 'Total Volume Index', i: AccountBalanceWallet, c: 'text-gray-900' },
                    ].map((k, i) => (
                        <div key={i} className="px-8 flex flex-col justify-center gap-0.5 hover:bg-gray-50/50 transition-colors group">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{k.l}</p>
                            <p className={`text-xl font-black tracking-tighter leading-none ${k.c || 'text-gray-900'}`}>{k.v}</p>
                            <p className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter mt-1">{k.s}</p>
                        </div>
                    ))}
                </div>

                {/* ── FILTER PROTOCOL ── */}
                <div className="h-14 px-8 border-b border-gray-300/80 flex items-center justify-between bg-white shrink-0 shadow-sm relative z-30">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-primary/30 focus-within:bg-white transition-all w-96 shadow-sm">
                            <Search className="text-gray-300" sx={{ fontSize: 16 }} />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder={`Global index search for ${partyType}s…`} className="text-[11px] font-bold bg-transparent outline-none w-full placeholder:text-gray-300" />
                        </div>
                        <div className="flex items-center gap-2">
                            <FilterList sx={{ fontSize: 14 }} className="text-gray-300" />
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Active Filter Priority</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {parties.length} records processed
                    </div>
                </div>

                {/* ── WORKSPACE ── */}
                <div className="px-12 py-10 max-w-screen-2xl mx-auto">
                    <div className="bg-white border border-gray-300 rounded-[40px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.04)] ring-1 ring-gray-200/50">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 backdrop-blur-md border-b border-gray-300">
                                    {[
                                        { l: 'Protocol Status', w: 'w-40' },
                                        { l: isCx ? 'Customer Identity' : 'Vendor Identity' },
                                        { l: 'Branch Node', w: 'w-48' },
                                        { l: isCx ? 'Receivable flow' : 'Payable flow', align: 'right', w: 'w-48' },
                                        { l: 'Registry Actions', align: 'center', w: 'w-48' },
                                    ].map((h, i) => (
                                        <th key={i} className={`px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ${h.w}`} style={{ textAlign: h.align }}>
                                            {h.l}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                                ) : parties.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-40 text-center">
                                            <div className="flex flex-col items-center gap-6 opacity-20 filter grayscale">
                                                <People sx={{ fontSize: 80 }} />
                                                <div>
                                                    <p className="text-[12px] font-black uppercase tracking-[0.5em]">Zero Entry Registry</p>
                                                    <p className="text-[10px] font-bold mt-2 lowercase italic">No matches found within current filter parity.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : parties.map(p => {
                                    const isDr = p.cached_balance >= 0;
                                    return (
                                        <tr key={p.id} className="hover:bg-primary/[0.01] transition-all duration-300 group">
                                            <td className="px-10 py-6">
                                                <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${isDr ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isDr ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
                                                    {isDr ? 'Solvent' : 'Liability'}
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[15px] font-black text-gray-900 tracking-tight leading-none group-hover:text-primary transition-colors">{p.display_name}</span>
                                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity">{p.phone || 'Registry Encrypted'}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-3">
                                                    <Business sx={{ fontSize: 13 }} className="text-gray-200 group-hover:text-primary transition-colors duration-500 opacity-50" />
                                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">{p.branch_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[17px] font-black tracking-tighter ${isDr ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        Rs {fmtK(Math.abs(p.cached_balance))}
                                                        <span className="text-[9px] ml-1.5 uppercase opacity-30">{isDr ? 'DR' : 'CR'}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 text-center">
                                                <button onClick={() => navigate(`/finance/ledger/view/${p.id}`)}
                                                    className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:shadow-[0_10px_30px_rgba(234,94,40,0.3)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 mx-auto shadow-lg">
                                                    <Visibility sx={{ fontSize: 14 }} /> Detail View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="max-w-screen-2xl mx-auto px-12 flex justify-between items-center opacity-30">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Financial Identity Framework v4.2</div>
                    <div className="h-px bg-gray-300/30 flex-1 mx-8" />
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Node Secure · {new Date().getFullYear()}</div>
                </div>
            </div>
        </div>
    );
}
