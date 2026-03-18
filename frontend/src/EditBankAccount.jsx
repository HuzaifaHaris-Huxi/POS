import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    AccountBalance, Close, Storefront, ArrowForward, 
    AdminPanelSettings, AccountBalanceWallet 
} from '@mui/icons-material';

const API = 'http://localhost:8000';

export default function EditBankAccount() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', 
        bank_name: '', 
        account_number: '', 
        branch_id: '', 
        opening_balance: '0', 
        account_type: 'BANK',
        is_active: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [bRes, aRes] = await Promise.all([
                    axios.get(`${API}/api/branches/`, { withCredentials: true }),
                    axios.get(`${API}/api/finance/accounts/${id}/`, { withCredentials: true })
                ]);
                setBranches(bRes.data || []);
                setForm(aRes.data);
                setLoading(false);
            } catch (err) {
                alert("Failed to load account data.");
                navigate('/finance/accounts');
            }
        };
        fetchData();
    }, [id]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.branch_id) {
            alert("Branch association is mandatory.");
            return;
        }
        setSaving(true);
        try {
            await axios.post(`${API}/api/finance/accounts/${id}/update/`, form, { withCredentials: true });
            navigate('/finance/accounts');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update account.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-gray-50/30">
            <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-2xl" />
                <div className="h-2 w-24 bg-gray-200 rounded-full" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFC]" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            
            {/* ══════════════ ELITE STICKY HEADER ══════════════ */}
            <div className="bg-white border-b border-gray-300 px-8 h-16 flex items-center justify-between shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/finance/accounts')} 
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-300 text-gray-400 hover:text-primary hover:border-primary/30 transition-all group">
                        <Close sx={{ fontSize: 20 }} />
                    </button>
                    <div className="h-8 w-px bg-gray-200" />
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center shadow-inner">
                            <AccountBalanceWallet className="text-primary" sx={{ fontSize: 20 }} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">Modify Source</h1>
                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none tracking-tighter truncate max-w-[200px]">{form.name}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Modification Mode</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12">
                <div className="w-full max-w-4xl bg-white rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.06)] border border-gray-100 flex flex-col md:flex-row overflow-hidden min-h-[600px]">
                    
                    {/* Left Panel: Context */}
                    <div className="w-full md:w-[300px] bg-gray-900 p-12 flex flex-col justify-between relative overflow-hidden shrink-0">
                        <div className="relative z-10">
                            <AdminPanelSettings className="text-primary mb-6" sx={{ fontSize: 32 }} />
                            <h2 className="text-2xl font-black text-white tracking-tight leading-[1.1] mb-4">Updating Finance Source</h2>
                            <p className="text-[11px] font-medium text-gray-400 leading-relaxed">Modify your bank account details while maintaining consistency across your financial records and branch pairing.</p>
                        </div>

                        <div className="relative z-10 space-y-6 pt-12">
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                    <Storefront sx={{ fontSize: 16, color: '#F97316' }} />
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Strict Branch Pairing</p>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                    <AccountBalance sx={{ fontSize: 16, color: '#F97316' }} />
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Ledger Ready Sync</p>
                             </div>
                        </div>

                        {/* Abstract Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2" />
                    </div>

                    {/* Right Panel: Form */}
                    <form onSubmit={submit} className="flex-1 p-8 lg:p-12 scroll-py-12">
                        <div className="space-y-6">
                            
                            {/* Account Type Selector */}
                            <div className="flex gap-2 p-1.5 bg-gray-50 rounded-[22px] border border-gray-100 transition-all">
                                {['BANK', 'CASH'].map(t => (
                                    <button key={t} type="button" onClick={() => setForm({ ...form, account_type: t })}
                                        className={`flex-1 py-3 rounded-[18px] text-[10px] font-bold tracking-widest uppercase transition-all ${form.account_type === t ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>
                                        {t === 'BANK' ? 'Banking' : 'Cash Box'}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] pl-2">Display Name</label>
                                    <input required placeholder="e.g. HBL Corporate Account" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} 
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-[18px] text-[12px] font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] pl-2">Bank / Institution</label>
                                        <input placeholder="HBL, UBL, etc." value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} 
                                            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-[18px] text-[12px] font-bold text-gray-900 focus:outline-none transition-all focus:border-primary/30" />
                                    </div>
                                    <div className="space-y-2 relative">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] pl-2">Assigned Branch</label>
                                        <select required value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-[18px] text-[12px] font-bold text-gray-900 focus:outline-none appearance-none cursor-pointer focus:border-primary/30">
                                            <option value="">Select Branch</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {form.account_type === 'BANK' && (
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] pl-2">Account Number</label>
                                        <input placeholder="Verify with Bank Statement" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} 
                                            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-[18px] text-[12px] font-bold text-gray-900 focus:outline-none transition-all focus:border-primary/30" />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-primary uppercase tracking-[0.2em] pl-2">Opening Balance (Rs)</label>
                                    <input type="number" step="any" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} 
                                        className="w-full px-6 py-4 bg-primary/5 border border-primary/10 rounded-[18px] text-xl font-black text-primary placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-center" />
                                </div>
                            </div>

                            <button disabled={saving} className="w-full py-4.5 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-[22px] shadow-xl hover:bg-primary hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4">
                                {saving ? 'Updating...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
