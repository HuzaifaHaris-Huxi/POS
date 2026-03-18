import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, AddCircle, Edit, Delete, Store, Warehouse as WarehouseIcon, Inventory
} from '@mui/icons-material';
import { Tooltip, IconButton, CircularProgress } from '@mui/material';
import WarehouseForm from './WarehouseForm';

const BACKEND_URL = 'http://localhost:8000';

export default function Warehouses() {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Stock View Modal
  const [viewingStockWarehouse, setViewingStockWarehouse] = useState(null);
  
  // Pagination & Search
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Form Modal Custom state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchWarehouses(1);
  }, [selectedBranch, search, limit]);

  useEffect(() => {
    if (page > 1) {
      fetchWarehouses(page);
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

  const fetchWarehouses = async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit,
      });
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      if (search.trim()) params.append('search', search.trim());

      const res = await axios.get(`${BACKEND_URL}/api/warehouses/?${params.toString()}`, { withCredentials: true });
      setWarehouses(res.data.warehouses || []);
      setTotalCount(res.data.total_count || 0);
      setPage(res.data.page);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch warehouses.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete warehouse '${name}'?`)) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/warehouses/${id}/`, { withCredentials: true });
      fetchWarehouses(page);
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  const openAddForm = () => {
    setEditingWarehouse(null);
    setIsFormOpen(true);
  };

  const openEditForm = (warehouse) => {
    setEditingWarehouse(warehouse);
    setIsFormOpen(true);
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (isFormOpen) {
    return (
      <WarehouseForm 
        branches={branches} 
        warehouse={editingWarehouse}
        selectedBranch={selectedBranch}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          setIsFormOpen(false);
          fetchWarehouses(page);
        }}
      />
    );
  }

  // Stock Modal Inline component
  const WarehouseStockModal = ({ warehouse, onClose }) => {
    const [stocks, setStocks] = useState([]);
    const [sLoading, setSLoading] = useState(true);
    const [sError, setSError] = useState('');
    const [sPage, setSPage] = useState(1);
    const [sTotal, setSTotal] = useState(0);
    const [sLimit, setSLimit] = useState(10);
    const [sSearch, setSSearch] = useState('');

    useEffect(() => {
      fetchStock();
    }, [sPage, sLimit, sSearch]);

    const fetchStock = async () => {
      setSLoading(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/api/warehouses/${warehouse.id}/stock/?page=${sPage}&limit=${sLimit}&search=${sSearch}`, { withCredentials: true });
        setStocks(res.data.stocks || []);
        setSTotal(res.data.total_count || 0);
      } catch (err) {
        setSError('Failed to fetch stock.');
      } finally {
        setSLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 lowercase text-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-xl font-black text-gray-900 capitalize tracking-tight">Stock in {warehouse.name}</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Total {sTotal} items available</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-rose-100 hover:text-rose-600 transition-colors">
              ✕
            </button>
          </div>
          
          <div className="p-4 px-6 flex items-center justify-between gap-4 bg-white border-b border-gray-100">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" sx={{ fontSize: 20 }} />
              <input
                type="text"
                placeholder="Search products..."
                value={sSearch}
                onChange={(e) => setSSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50/20">
            {sError ? (
              <div className="m-6 p-4 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{sError}</div>
            ) : sLoading ? (
               <div className="p-8 text-center"><CircularProgress size={24} sx={{ color: '#EA5E28' }} /></div>
            ) : stocks.length === 0 ? (
               <div className="p-12 text-center text-gray-400 font-bold">No stock items found in this warehouse.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur w-1/2">Product Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Code / SKU</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-right">Available Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stocks.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3 font-bold text-gray-900 capitalize text-sm">{s.product_name}</td>
                      <td className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">{s.sku || s.barcode || '—'}</td>
                      <td className="px-6 py-3 font-black text-gray-700 text-right text-sm">
                        {s.quantity} <span className="text-[10px] text-gray-400 font-bold ml-1">{s.uom}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <button onClick={() => setSPage(p => Math.max(1, p - 1))} disabled={sPage <= 1} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all">Prev</button>
            <button onClick={() => setSPage(p => p + 1)} disabled={stocks.length < sLimit} className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all">Next</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white lowercase text-sm">
      {viewingStockWarehouse && (
        <WarehouseStockModal 
          warehouse={viewingStockWarehouse} 
          onClose={() => setViewingStockWarehouse(null)} 
        />
      )}
      <div className="w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <WarehouseIcon />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight capitalize">Warehouses</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Inventory Storage</p>
            </div>
          </div>
          <button 
            onClick={openAddForm}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary-light transition-all flex items-center gap-2 shadow-sm"
          >
            <AddCircle sx={{ fontSize: 18 }} />
            Add Warehouse
          </button>
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

        {/* Filters & Actions */}
        <div className="p-4 px-6 flex items-center justify-between gap-4 bg-gray-50/30">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" sx={{ fontSize: 20 }} />
            <input
              type="text"
              placeholder="Search warehouses by name or code..."
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
              <option value={100}>100 Entries</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto">
          {error && <div className="m-6 p-4 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{error}</div>}
          
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Code</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Warehouse Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Branch</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Address</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center"><CircularProgress size={24} sx={{ color: '#EA5E28' }} /></td>
                </tr>
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 font-bold">
                    No warehouses found.
                  </td>
                </tr>
              ) : (
                warehouses.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-600 uppercase">{w.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 capitalize">{w.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100/80 text-gray-500 font-black text-[10px] uppercase tracking-wider">
                        {w.branch_name || 'Global'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-500 font-medium capitalize max-w-xs truncate">{w.address || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Tooltip title="View Stock" arrow>
                        <IconButton onClick={() => setViewingStockWarehouse(w)} size="small" sx={{ color: '#10B981', '&:hover': { background: '#D1FAE5' }, mr: 0.5 }}>
                          <Inventory fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit" arrow>
                        <IconButton onClick={() => openEditForm(w)} size="small" sx={{ color: '#0EA5E9', '&:hover': { background: '#E0F2FE' }, mr: 0.5 }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete" arrow>
                        <IconButton onClick={() => handleDelete(w.id, w.name)} size="small" sx={{ color: '#EF4444', '&:hover': { background: '#FEE2E2' } }}>
                          <Delete fontSize="small" />
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
            Showing {((page - 1) * limit) + (warehouses.length > 0 ? 1 : 0)} to {((page - 1) * limit) + warehouses.length} of {totalCount} entries
          </div>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Prev
            </button>
            <div className="px-3 py-1.5 rounded-lg font-black text-xs bg-primary/10 text-primary">
              {page} / {totalPages}
            </div>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
