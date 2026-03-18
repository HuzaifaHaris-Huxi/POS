import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    AccountBalance, Storefront, Add, Visibility, Edit,
    AccountBalanceWallet, Search
} from '@mui/icons-material';

const API = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankAccounts() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branchId, setBranchId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const p = branchId !== 'all' ? `?branch_id=${branchId}` : '';
            const r = await axios.get(`${API}/api/finance/accounts/${p}`, { withCredentials: true });
            setAccounts(r.data.accounts || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        axios.get(`${API}/api/branches/`, { withCredentials: true })
            .then(r => setBranches(r.data || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filteredAccounts = accounts.filter(acc => 
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (acc.bank_name && acc.bank_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (acc.account_number && acc.account_number.includes(searchQuery))
    );

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden animate-in fade-in duration-300 no-scrollbar" style={{ fontFamily: "'Google Sans', 'Segoe UI', sans-serif" }}>
            
            {/* ══════════════ ELITE STICKY HEADER ══════════════ */}
            <div className="bg-white border-b border-gray-300 px-8 h-16 flex items-center justify-between shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center shadow-inner">
                            <AccountBalanceWallet className="text-primary" sx={{ fontSize: 20 }} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">Bank Accounts</h1>
                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none tracking-tighter">Financial Infrastructure</p>
                        </div>
                    </div>
                </div>

                <div className="flex h-full items-center">
                    <div className="flex gap-10 h-full">
                        {[{ id: 'all', name: 'All' }, ...branches].map(b => (
                            <button key={b.id} onClick={() => setBranchId(b.id)} 
                                className={`group relative flex items-center gap-2.5 h-16 transition-all`}>
                                <Storefront sx={{ fontSize: 16 }} className={branchId === b.id ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} />
                                <span className={`text-[11px] font-black uppercase tracking-widest ${branchId === b.id ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                                    {b.name}
                                </span>
                                {branchId === b.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in zoom-in-y duration-300" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-300 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 transition-all w-64 shadow-sm">
                        <Search className="text-gray-300" sx={{ fontSize: 16 }} />
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Identify account…" className="text-[11px] font-bold bg-transparent outline-none w-full placeholder:text-gray-300" />
                    </div>
                    <button onClick={() => navigate('/finance/accounts/new')} className="px-6 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-premium hover:bg-primary transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0">
                        <Add sx={{ fontSize: 18 }} /> Create Account
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-12 py-10 no-scrollbar">
                {loading ? (
                    <div className="space-y-4 animate-pulse max-w-7xl mx-auto">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-20 bg-white rounded-3xl border border-gray-200 shadow-sm" />
                        ))}
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-40">
                         <AccountBalance sx={{ fontSize: 100 }} />
                         <p className="text-xl font-black uppercase tracking-[1em] mt-8 leading-none">Silent Vaults</p>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto bg-white border border-gray-300 rounded-[40px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.04)]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Strategy Type</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Account Identifier</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Logical Branch</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Inception Valor</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Current Liquidity</th>
                                    <th className="px-10 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Control Vector</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredAccounts.map(acc => (
                                    <tr key={acc.id} className="hover:bg-primary/[0.015] transition-colors group">
                                        <td className="px-10 py-6">
                                            <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full border ${acc.account_type === 'CASH' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {acc.account_type === 'CASH' ? 'Physical Asset' : 'Digital Node'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-black text-gray-900 tracking-tight leading-none mb-1.5 group-hover:text-primary transition-colors">{acc.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{acc.bank_name || 'Liquid Cash'}</span>
                                                    {acc.account_number && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                                                            <span className="text-[9px] font-black text-primary tracking-tighter">{acc.account_number}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-2.5">
                                                <Storefront sx={{ fontSize: 13 }} className="text-gray-300 group-hover:text-primary transition-colors duration-500 opacity-40" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{acc.branch_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className="text-[11px] font-black text-gray-300">Rs {fmtK(acc.opening_balance)}</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className="text-base font-black text-gray-900 tracking-tighter group-hover:text-primary transition-colors">Rs {fmtK(acc.current_balance)}</span>
                                        </td>
                                        <td className="px-10 py-6 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2.5 translate-x-3 group-hover:translate-x-0 transition-all opacity-0 group-hover:opacity-100 duration-300">
                                                <button onClick={() => navigate(`/finance/accounts/view/${acc.id}`)} className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-gray-900 hover:text-white hover:border-gray-900 hover:shadow-lg transition-all">
                                                    <Visibility sx={{ fontSize: 16 }} />
                                                </button>
                                                <button onClick={() => navigate(`/finance/accounts/edit/${acc.id}`)} className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all">
                                                    <Edit sx={{ fontSize: 16 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            <div className="px-12 py-4 bg-white border-t border-gray-100 flex justify-between items-center text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-4">
                    <span>Active Branches: {branches.length}</span>
                    <span className="opacity-10">|</span>
                    <span>Total Nodes: {accounts.length}</span>
                </div>
                <div>Sync Engine Active</div>
            </div>
        </div>
    );
}
