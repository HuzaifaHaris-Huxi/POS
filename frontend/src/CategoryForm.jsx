import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowBack, Save, Category } from '@mui/icons-material';

const BACKEND_URL = 'http://localhost:8000';

export default function CategoryForm({ branches, category, selectedBranch, onClose, onSaved }) {
    const isEdit = !!category;
    const title = isEdit ? 'Edit Category' : 'Create New Category';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        branch_id: '',
    });

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name || '',
                code: category.code || '',
                branch_id: category.branch_id || (branches.length > 0 ? branches[0].id : ''),
            });
        } else if (selectedBranch && selectedBranch !== 'all') {
            setFormData(prev => ({ ...prev, branch_id: selectedBranch }));
        } else if (branches.length > 0) {
            setFormData(prev => ({ ...prev, branch_id: branches[0].id }));
        }
    }, [category, branches, selectedBranch]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isEdit) {
                await axios.put(`${BACKEND_URL}/api/categories/${category.id}/`, formData, { withCredentials: true });
            } else {
                await axios.post(`${BACKEND_URL}/api/categories/`, formData, { withCredentials: true });
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save category.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-mesh p-6 lowercase text-sm">
            <div className="max-w-md mx-auto w-full bg-white rounded-3xl border border-gray-100 shadow-premium overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-zinc-900 text-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-xl">
                            <Category />
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
                    
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Name <span className="text-rose-500">*</span></label>
                            <input 
                                required
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Beverages, Electronics"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 capitalize"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Code</label>
                            <input 
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                placeholder="e.g. BEV, ELEC"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 uppercase"
                            />
                        </div>

                        <div className="space-y-1.5">
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
                                {isEdit ? 'Save Changes' : 'Create Category'}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
