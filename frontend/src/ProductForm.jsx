import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowBack, Save, Inventory, AddCircle } from '@mui/icons-material';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

const BACKEND_URL = 'http://localhost:8000';

export default function ProductForm({ branches, product, selectedBranch, onClose, onSaved }) {
    const isEdit = !!product;
    const title = isEdit ? 'Edit Product' : 'Create New Product';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [categories, setCategories] = useState([]);
    const [uoms, setUoms] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        company_name: '',
        sku: '',
        barcode: '',
        branch_id: '',
        category_id: '',
        uom_id: '',
        purchase_price: '',
        sale_price: '',
        min_stock: '0',
        stock_qty: '0',
        bulk_uom_id: '',
        default_bulk_size: '1',
        has_expiry: false,
        expiry_date: '',
    });

    const [uomModalOpen, setUomModalOpen] = useState(false);
    const [uomForm, setUomForm] = useState({ name: '', code: '', symbol: '' });
    const [uomAdding, setUomAdding] = useState(false);

    useEffect(() => {
        fetchUoms();
    }, []);

    useEffect(() => {
        if (formData.branch_id) {
            fetchCategories(formData.branch_id);
        } else {
            setCategories([]);
        }
    }, [formData.branch_id]);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                company_name: product.company_name || '',
                sku: product.sku || '',
                barcode: product.barcode || '',
                branch_id: product.branch_id || (branches.length > 0 ? branches[0].id : ''),
                category_id: product.category_id || '',
                uom_id: product.uom_id || '',
                bulk_uom_id: product.bulk_uom_id || '',
                default_bulk_size: product.default_bulk_size || '1',
                purchase_price: product.purchase_price || '',
                sale_price: product.sale_price || '',
                min_stock: product.min_stock || '0',
                stock_qty: product.stock_qty || '0',
                has_expiry: product.has_expiry || false,
                expiry_date: product.expiry_date || '',
            });
        } else if (selectedBranch && selectedBranch !== 'all') {
            setFormData(prev => ({ ...prev, branch_id: selectedBranch }));
        } else if (branches.length > 0) {
            setFormData(prev => ({ ...prev, branch_id: branches[0].id }));
        }
    }, [product, branches, selectedBranch]);

    const fetchCategories = async (branchId) => {
        try {
            const branchQuery = branchId ? `&branch_id=${branchId}` : '';
            const res = await axios.get(`${BACKEND_URL}/api/categories/?limit=1000${branchQuery}`, { withCredentials: true });
            if (res.data?.categories) {
                setCategories(res.data.categories);
            }
        } catch (err) {
            console.error("Failed to fetch categories", err);
        }
    };

    const fetchUoms = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/setup/uoms/`, { withCredentials: true });
            if (res.data?.uoms) {
                setUoms(res.data.uoms);
            }
        } catch (err) {
            console.error("Failed to fetch UOMs", err);
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleUomSubmit = async (e) => {
        e.preventDefault();
        setUomAdding(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/setup/uoms/`, uomForm, { withCredentials: true });
            if (res.data?.success) {
                setUoms([...uoms, res.data.uom]);
                setUomModalOpen(false);
                setUomForm({ name: '', code: '', symbol: '' });
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add UOM.');
        } finally {
            setUomAdding(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isEdit) {
                await axios.put(`${BACKEND_URL}/api/products/${product.id}/`, formData, { withCredentials: true });
            } else {
                await axios.post(`${BACKEND_URL}/api/products/`, formData, { withCredentials: true });
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save product.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-mesh p-6 lowercase text-sm">
            <div className="max-w-4xl mx-auto w-full bg-white rounded-3xl border border-gray-100 shadow-premium overflow-hidden flex flex-col h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-zinc-900 text-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-xl">
                            <Inventory />
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
                <form onSubmit={handleSubmit} className="p-8 space-y-8 flex-1 overflow-y-auto w-full hide-scrollbar">
                    {error && <div className="p-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{error}</div>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        
                        {/* Section: Basic Info */}
                        <div className="lg:col-span-3 pb-2 border-b border-gray-100">
                            <h2 className="text-[10px] font-black text-primary uppercase tracking-widest">Basic Information</h2>
                        </div>

                        <div className="space-y-1.5 lg:col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Product Name <span className="text-rose-500">*</span></label>
                            <input 
                                required
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Diet Coke 330ml"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 capitalize"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Brand / Company</label>
                            <input 
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                placeholder="e.g. Coca-Cola"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 capitalize"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">SKU</label>
                            <input 
                                name="sku"
                                value={formData.sku}
                                onChange={handleChange}
                                placeholder="e.g. CC330D"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 uppercase"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Barcode / EAN</label>
                            <input 
                                name="barcode"
                                value={formData.barcode}
                                onChange={handleChange}
                                placeholder="e.g. 5449000111678"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                            <select
                                name="category_id"
                                value={formData.category_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                            >
                                <option value="" disabled>Select a Category (Optional)</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Section: Organization Options */}
                        <div className="lg:col-span-3 pb-2 pt-4 border-b border-gray-100">
                            <h2 className="text-[10px] font-black text-primary uppercase tracking-widest">Pricing & Stock</h2>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Purchase Price <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rs</span>
                                <input 
                                    required
                                    type="number"
                                    step="0.01"
                                    name="purchase_price"
                                    value={formData.purchase_price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sale Price <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rs</span>
                                <input 
                                    required
                                    type="number"
                                    step="0.01"
                                    name="sale_price"
                                    value={formData.sale_price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 text-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unit of Measure (UOM) <span className="text-rose-500">*</span></label>
                            <select
                                required
                                name="uom_id"
                                value={formData.uom_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white uppercase"
                            >
                                <option value="" disabled>Select Unit</option>
                                {uoms.map(u => (
                                    <option key={u.id} value={u.id}>{u.code}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Stock Qty <span className="text-rose-500">*</span></label>
                            <input 
                                required
                                type="number"
                                step="0.01"
                                name="stock_qty"
                                value={formData.stock_qty}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Minimum Alert Level</label>
                            <input 
                                type="number"
                                step="0.01"
                                name="min_stock"
                                value={formData.min_stock}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
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

                        {/* Section: Bulk Pricing & Expiry */}
                        <div className="lg:col-span-3 pb-2 pt-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-[10px] font-black text-primary uppercase tracking-widest">Bulk Settings & Expiry</h2>
                        </div>

                        <div className="space-y-1.5 focus-within:z-10">
                            <div className="flex items-center justify-between ml-1 mb-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bulk Unit (Ops)</label>
                                <button 
                                    type="button" 
                                    onClick={() => setUomModalOpen(true)}
                                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                                >
                                    <AddCircle sx={{ fontSize: 12 }} /> Add UOM
                                </button>
                            </div>
                            <select
                                name="bulk_uom_id"
                                value={formData.bulk_uom_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white uppercase"
                            >
                                <option value="">No Bulk Unit</option>
                                {uoms.map(u => (
                                    <option key={u.id} value={u.id}>{u.code}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-400 font-medium px-2">e.g. Bag, Box, Carton</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Items Per Bulk Unit</label>
                            <input 
                                type="number"
                                step="0.01"
                                name="default_bulk_size"
                                value={formData.default_bulk_size}
                                onChange={handleChange}
                                disabled={!formData.bulk_uom_id}
                                placeholder="1"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold disabled:opacity-50 disabled:bg-gray-50"
                            />
                            {formData.bulk_uom_id && (
                                <p className="text-[10px] text-gray-500 font-bold px-2">
                                    1 {uoms.find(u => u.id == formData.bulk_uom_id)?.code || 'Bulk'} = {formData.default_bulk_size || 1} {uoms.find(u => u.id == formData.uom_id)?.code || 'Base Unit(s)'}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end pb-3 pl-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox"
                                        name="has_expiry"
                                        checked={formData.has_expiry}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    <div className={`w-11 h-6 bg-gray-200 rounded-full transition-colors group-hover:bg-gray-300 ${formData.has_expiry ? '!bg-primary' : ''}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${formData.has_expiry ? 'translate-x-5' : ''}`}></div>
                                </div>
                                <div>
                                    <div className="text-[12px] font-black text-gray-700 uppercase tracking-wider">Has Expiry Date?</div>
                                    <div className="text-[10px] text-gray-400 font-medium">Track expiration for this product</div>
                                </div>
                            </label>
                        </div>

                        {formData.has_expiry && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Expiry Date <span className="text-rose-500">*</span></label>
                                <input 
                                    required
                                    type="date"
                                    name="expiry_date"
                                    value={formData.expiry_date}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700"
                                />
                            </div>
                        )}

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
                                {isEdit ? 'Save Changes' : 'Create Product'}
                            </>
                        )}
                    </button>
                </div>

            </div>

            {/* UOM Creation Modal */}
            <Dialog open={uomModalOpen} onClose={() => !uomAdding && setUomModalOpen(false)} PaperProps={{ style: { borderRadius: 24, padding: 8 } }}>
                <DialogTitle className="!font-black !text-gray-900 !tracking-tight">Quick Add UOM</DialogTitle>
                <form onSubmit={handleUomSubmit}>
                    <DialogContent className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Name <span className="text-rose-500">*</span></label>
                            <input 
                                required
                                value={uomForm.name}
                                onChange={e => setUomForm({...uomForm, name: e.target.value})}
                                placeholder="e.g. Kilogram"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary outline-none font-bold placeholder:text-gray-300 capitalize"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Code <span className="text-rose-500">*</span></label>
                            <input 
                                required
                                value={uomForm.code}
                                onChange={e => setUomForm({...uomForm, code: e.target.value.toUpperCase()})}
                                placeholder="e.g. KG"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary outline-none font-bold placeholder:text-gray-300 uppercase"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Symbol</label>
                            <input 
                                value={uomForm.symbol}
                                onChange={e => setUomForm({...uomForm, symbol: e.target.value})}
                                placeholder="e.g. kg"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary outline-none font-bold placeholder:text-gray-300"
                            />
                        </div>
                    </DialogContent>
                    <DialogActions className="!px-6 !pb-4">
                        <button type="button" onClick={() => setUomModalOpen(false)} className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-50 text-xs">Cancel</button>
                        <button disabled={uomAdding} type="submit" className="px-5 py-2 rounded-xl font-bold text-white bg-primary hover:bg-primary-light disabled:opacity-50 text-xs shadow-sm">
                            {uomAdding ? 'Saving...' : 'Save Unit'}
                        </button>
                    </DialogActions>
                </form>
            </Dialog>

        </div>
    );
}
