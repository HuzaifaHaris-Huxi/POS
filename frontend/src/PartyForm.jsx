import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowBack, Save, PersonAddAlt1, Storefront } from '@mui/icons-material';

const BACKEND_URL = 'http://localhost:8000';

export default function PartyForm({ type, branches, party, selectedBranch, onClose, onSaved }) {
    const isCustomer = type === 'CUSTOMER';
    const isEdit = !!party;
    const title = isEdit ? `Edit ${isCustomer ? 'Customer' : 'Vendor'}` : `Create New ${isCustomer ? 'Customer' : 'Vendor'}`;
    const Icon = isCustomer ? PersonAddAlt1 : Storefront;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        type: type,
        display_name: '',
        legal_name: '',
        branch_id: branches.length > 0 ? branches[0].id : '',
        phone: '',
        email: '',
        address: '',
        gst_number: '',
        opening_balance: 0,
        opening_balance_side: 'Dr',
        opening_balance_date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (party) {
            setFormData({
                type: party.type || type,
                display_name: party.display_name || '',
                legal_name: party.legal_name || '',
                branch_id: party.branch_id || (branches.length > 0 ? branches[0].id : ''),
                phone: party.phone || '',
                email: party.email || '',
                address: party.address || '',
                gst_number: party.gst_number || '',
                opening_balance: party.opening_balance || 0,
                opening_balance_side: party.opening_balance_side || 'Dr',
                opening_balance_date: party.opening_balance_date || new Date().toISOString().split('T')[0],
            });
        } else if (selectedBranch && selectedBranch !== 'all') {
            setFormData(prev => ({ ...prev, branch_id: selectedBranch }));
        } else if (branches.length > 0) {
            setFormData(prev => ({ ...prev, branch_id: branches[0].id }));
        }
    }, [party, branches, type, selectedBranch]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isEdit) {
                await axios.put(`${BACKEND_URL}/api/parties/${party.id}/`, formData, { withCredentials: true });
            } else {
                await axios.post(`${BACKEND_URL}/api/parties/`, formData, { withCredentials: true });
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save party.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-mesh p-6 lowercase text-sm">
            <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl border border-gray-100 shadow-premium overflow-hidden flex flex-col h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-zinc-900 text-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-xl">
                            <Icon />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight capitalize">{title}</h1>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                {isEdit ? 'Update Details' : 'New Entry'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                        <ArrowBack />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto w-full hide-scrollbar">
                    {error && <div className="p-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{error}</div>}
                    
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name <span className="text-rose-500">*</span></label>
                            <input 
                                required
                                name="display_name"
                                value={formData.display_name}
                                onChange={handleChange}
                                placeholder="e.g. John Doe / ABC Corp"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 capitalize"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Legal Name</label>
                            <input 
                                name="legal_name"
                                value={formData.legal_name}
                                onChange={handleChange}
                                placeholder="e.g. ABC Corporation Pvt Ltd"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 capitalize"
                            />
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Associated Branch <span className="text-rose-500">*</span></label>
                            <select
                                required
                                name="branch_id"
                                value={formData.branch_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                            >
                                <option value="" disabled>Select a branch</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Number</label>
                            <input 
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="+92 3XX XXXXXXX"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input 
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="contact@example.com"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                            />
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">GST / Tax Number</label>
                            <input 
                                name="gst_number"
                                value={formData.gst_number}
                                onChange={handleChange}
                                placeholder="Optional tax ID"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 uppercase"
                            />
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mailing Address</label>
                            <textarea 
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows="2"
                                placeholder="Full street address..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 resize-none capitalize"
                            />
                        </div>

                        <div className="col-span-2 space-y-1.5 border-t border-gray-50 pt-4 mt-2">
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Opening Balance Information</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        name="opening_balance"
                                        value={formData.opening_balance}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Type (Dr/Cr)</label>
                                    <select
                                        name="opening_balance_side"
                                        value={formData.opening_balance_side}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                                    >
                                        <option value="Dr">Debit (They owe us)</option>
                                        <option value="Cr">Credit (We owe them)</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">As of Date</label>
                                    <input 
                                        type="date"
                                        name="opening_balance_date"
                                        value={formData.opening_balance_date}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </form>

                {/* Footer Action */}
                <div className="p-6 bg-gray-50/50 border-t border-gray-50 z-10">
                    <button 
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-primary text-white py-3.5 rounded-2xl font-black text-sm shadow-premium hover:bg-primary-light transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <Save sx={{ fontSize: 18 }} />
                                {isEdit ? 'Save Changes' : 'Create Record'}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
