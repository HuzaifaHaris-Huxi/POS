import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Store, Inventory, SettingsBackupRestore, History
} from '@mui/icons-material';
import { CircularProgress, Tooltip, IconButton } from '@mui/material';
import StockDetail from './StockDetail';

const BACKEND_URL = 'http://localhost:8000';

export default function StockStatus() {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & Search
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal
  const [viewingProduct, setViewingProduct] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [selectedBranch, search, limit]);

  useEffect(() => {
    if (page > 1) {
      fetchProducts(page);
    }
  }, [page]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/dashboard-data/`, { withCredentials: true });
      if (res.data?.branches) {
        setBranches(res.data.branches);
      }
    } catch (err) {
      console.error("Failed to fetch branches", err);
    }
  };

  const fetchProducts = async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit,
      });
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      if (search.trim()) params.append('search', search.trim());

      const res = await axios.get(`${BACKEND_URL}/api/products/?${params.toString()}`, { withCredentials: true });
      setProducts(res.data.products || []);
      setTotalCount(res.data.total_count || 0);
      setPage(res.data.page);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch products.');
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

  if (viewingProduct) {
    return (
      <StockDetail 
        product={viewingProduct} 
        onClose={() => setViewingProduct(null)} 
        onSaved={() => {
          fetchProducts(page);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white lowercase text-sm">
      <div className="w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-zinc-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary rounded-xl">
              <Inventory />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight capitalize">Stock Status</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Inventory Ledger</p>
            </div>
          </div>
        </div>

        {/* Branch Tabs */}
        <div className="flex px-6 pt-4 border-b border-gray-100 gap-6 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setSelectedBranch('all')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap border-b-2 ${selectedBranch === 'all' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            All
          </button>
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap border-b-2 ${selectedBranch === b.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <Store sx={{ fontSize: 14, mr: 0.5, mb: 0.5 }} />{b.name}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 px-6 flex items-center justify-between gap-4 bg-gray-50/30">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" sx={{ fontSize: 20 }} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-600"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Show:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 outline-none focus:border-primary appearance-none bg-white cursor-pointer"
            >
              <option value={10}>10 Entries</option>
              <option value={25}>25 Entries</option>
              <option value={50}>50 Entries</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {error && <div className="m-6 p-4 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{error}</div>}
          
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Product & SKU</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Brand / Company</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Branch</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-right">Current Stock</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center"><CircularProgress size={24} sx={{ color: '#EA5E28' }} /></td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 font-bold">No products found.</td>
                </tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 capitalize">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.sku && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-black uppercase tracking-wider">{p.sku}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {p.company_name ? (
                        <div className="font-bold text-gray-700 capitalize">{p.company_name}</div>
                      ) : (
                        <div className="text-gray-300 font-medium italic">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-1">
                        <Store sx={{ fontSize: 12, color: '#9CA3AF' }} />
                        {p.branch_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100/50 text-gray-700 font-black border border-gray-200/50 hover:bg-gray-100 transition-colors">
                        {parseStock(p.stock_qty, p.default_bulk_size, p.bulk_uom_code, p.uom_code)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Tooltip title="View Ledger" arrow>
                        <IconButton onClick={() => setViewingProduct(p)} size="small" sx={{ color: '#0ea5e9', '&:hover': { background: '#e0f2fe' } }}>
                          <History fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="text-xs font-bold text-gray-400">
            Showing {((page - 1) * limit) + (products.length > 0 ? 1 : 0)} to {((page - 1) * limit) + products.length} of {totalCount} entries
          </div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Prev</button>
            <div className="px-3 py-1.5 rounded-lg font-black text-xs bg-primary/10 text-primary">{page} / {totalPages}</div>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Next</button>
          </div>
        </div>

      </div>
    </div>
  );
}
