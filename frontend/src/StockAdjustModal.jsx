import React, { useState } from 'react';
import axios from 'axios';
import { Close } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

const BACKEND_URL = 'http://localhost:8000';

export default function StockAdjustModal({ product, currentStock, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    movement: 'in', // 'in' or 'out'
    quantity: '',
    uom_id: product.uom_id || '',
    reference: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        movement: formData.movement,
        quantity: formData.quantity,
        reference: formData.reference,
        notes: formData.notes,
        uom_id: formData.uom_id || undefined
      };

      const res = await axios.post(`${BACKEND_URL}/api/products/${product.id}/stock-adjust/`, payload, { withCredentials: true });
      if (res.data?.success) {
        onSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to adjust stock. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  // Build UOM Options (Base Unit and Bulk Unit if it exists)
  const uomOptions = [];
  if (product.uom_id) {
    uomOptions.push({ id: product.uom_id, label: `${product.uom_code || 'Base Unit'}` });
  }
  if (product.bulk_uom_id) {
    uomOptions.push({ id: product.bulk_uom_id, label: `${product.bulk_uom_code || 'Bulk Unit'} (x${product.default_bulk_size})` });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lowercase bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight capitalize">Adjust Stock</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              Current: <span className="text-primary">{parseFloat(currentStock).toLocaleString()} Base Units</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
            <Close />
          </button>
        </div>

        {error && <div className="mx-6 mt-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-bold text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col p-6 gap-6 overflow-y-auto">
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Movement Type*</label>
              <select 
                name="movement" 
                value={formData.movement} 
                onChange={handleChange} 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                required
              >
                <option value="in">Stock IN (+)</option>
                <option value="out">Stock OUT (-)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Quantity*</label>
              <input 
                type="number" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleChange} 
                step="0.000001"
                min="0.000001"
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700" 
                required 
              />
            </div>
            {uomOptions.length > 0 && (
              <div className="w-1/3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Unit</label>
                <select 
                  name="uom_id" 
                  value={formData.uom_id} 
                  onChange={handleChange} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                  required
                >
                  {uomOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Reference / Invoice No.</label>
            <input 
              type="text" 
              name="reference" 
              value={formData.reference} 
              onChange={handleChange} 
              placeholder="e.g. Audit, Damage, Bill No..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold uppercase text-gray-700" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Notes</label>
            <textarea 
              name="notes" 
              value={formData.notes} 
              onChange={handleChange} 
              rows="3"
              placeholder="Reason for adjustment..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 resize-none" 
            ></textarea>
          </div>

          <div className="pt-4 border-t border-gray-50 flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-8 py-2.5 rounded-xl font-bold text-xs bg-primary hover:bg-[#d65524] text-white shadow-md shadow-primary/20 transition-all flex items-center justify-center min-w-[120px]"
            >
              {loading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Confirm Adjustment'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
