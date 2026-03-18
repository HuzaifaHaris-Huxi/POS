import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ArrowBack, AddCircle, RemoveCircle, ErrorOutline, SettingsBackupRestore
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import StockAdjustModal from './StockAdjustModal';

const BACKEND_URL = 'http://localhost:8000';

export default function StockDetail({ product, onClose, onSaved }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [currentStock, setCurrentStock] = useState('0');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  useEffect(() => {
    fetchHistory(page);
  }, [page, limit, product.id]);

  const fetchHistory = async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${BACKEND_URL}/api/products/${product.id}/stock-history/?page=${currentPage}&limit=${limit}`, { withCredentials: true });
      if (res.data?.success) {
        setTransactions(res.data.transactions);
        setTotalCount(res.data.total_count);
        setCurrentStock(res.data.current_stock);
        setPage(res.data.page);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch stock history.');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const parseStock = (qty, bulkSize, bulkCode, baseCode) => {
    const stock = parseFloat(qty || 0);
    const bSize = parseFloat(bulkSize || 1);

    if (bSize > 1 && bulkCode) {
      const bulks = Math.floor(stock / bSize);
      const remains = stock % bSize;
      let text = [];
      if (bulks > 0) text.push(`${bulks} ${bulkCode}`);
      if (remains > 0 || bulks === 0) text.push(`${remains} ${baseCode || 'UNT'}`);
      return text.join(', ');
    }
    
    return `${stock} ${baseCode || 'UNT'}`;
  };

  return (
    <div className="flex flex-col h-full bg-white lowercase text-sm">
      <div className="w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-zinc-900 text-white relative">
          <button 
            onClick={onClose}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowBack />
          </button>

          <div className="pl-14">
            <h1 className="text-xl font-black tracking-tight text-white capitalize">{product.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest bg-zinc-800 px-2 py-0.5 rounded">Stock Ledger</span>
              {product.sku && <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{product.sku}</span>}
              {product.company_name && <span className="text-[10px] text-zinc-400 font-medium capitalize">{product.company_name}</span>}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Current Stock</div>
              <div className="text-xl font-black text-white tracking-tight">
                 {parseStock(currentStock, product.default_bulk_size, product.bulk_uom_code, product.uom_code)}
              </div>
            </div>
            
            <button 
              onClick={() => setIsAdjustOpen(true)}
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#d65524] transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              <SettingsBackupRestore sx={{ fontSize: 18 }} />
              Stock Adjust
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-auto bg-white">
          {error && <div className="m-6 p-4 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs flex items-center gap-2"><ErrorOutline fontSize="small" />{error}</div>}
          
          <table className="w-full text-left">
            <thead className="sticky top-0 shadow-sm z-10 bg-gray-50/90 backdrop-blur">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Ref</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Quantity Transacted</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Branch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center"><CircularProgress size={24} sx={{ color: '#EA5E28' }} /></td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-gray-400 font-bold bg-gray-50/30">
                    No transactions found for this product.
                  </td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{tx.date}</div>
                      {tx.reference && <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-0.5">{tx.reference}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {tx.movement === 'in' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                          <AddCircle sx={{ fontSize: 12 }} /> IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest">
                          <RemoveCircle sx={{ fontSize: 12 }} /> OUT
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-black text-sm ${tx.movement === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.movement === 'in' ? '+' : '-'}{parseFloat(tx.quantity)} <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-1">{tx.uom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-600 font-medium capitalize max-w-sm truncate" title={tx.notes}>
                        {tx.notes || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-bold text-gray-500 text-[11px] uppercase tracking-wider">{tx.branch_name}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs font-bold text-gray-400">
            Showing {((page - 1) * limit) + (transactions.length > 0 ? 1 : 0)} to {((page - 1) * limit) + transactions.length} of {totalCount} entries
          </div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Prev</button>
            <div className="px-3 py-1.5 rounded-lg font-black text-xs bg-primary/10 text-primary">{page} / {totalPages}</div>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Next</button>
          </div>
        </div>

      </div>

      {/* Adjust Modal Overlay */}
      {isAdjustOpen && (
        <StockAdjustModal 
          product={product} 
          currentStock={currentStock}
          onClose={() => setIsAdjustOpen(false)}
          onSuccess={() => {
            setIsAdjustOpen(false);
            fetchHistory(1);
            onSaved(); // Alert parent that stock changed
          }}
        />
      )}
    </div>
  );
}
