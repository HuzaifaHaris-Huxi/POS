import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Search, AddCircle, Edit, Delete, Groups, Store, History, Close, Save
} from '@mui/icons-material';
import { Tooltip, IconButton, CircularProgress } from '@mui/material';
import PartyForm from './PartyForm';

const BACKEND_URL = 'http://localhost:8000';

export default function Parties({ type }) { // type: 'CUSTOMER' or 'VENDOR'
  const isCustomer = type === 'CUSTOMER';
  const pageTitle = isCustomer ? 'Customers' : 'Vendors';
  const pageSubtitle = isCustomer ? 'Client Directory' : 'Supplier Directory';

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & Search
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Form Modal Custom state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  // Initialization
  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    setPage(1); // Reset page on filter change
    fetchParties(1);
  }, [type, selectedBranch, search, limit]);

  useEffect(() => {
    if (page > 1) {
      fetchParties(page);
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

  const fetchParties = async (currentPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        type: type,
        page: currentPage,
        limit,
      });
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      if (search.trim()) params.append('search', search.trim());

      const res = await axios.get(`${BACKEND_URL}/api/parties/?${params.toString()}`, { withCredentials: true });
      setParties(res.data.parties || []);
      setTotalCount(res.data.total_count || 0);
      setPage(res.data.page);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch parties.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ${isCustomer ? 'customer' : 'vendor'}?`)) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/parties/${id}/`, { withCredentials: true });
      fetchParties(page);
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  const openAddForm = () => {
    setEditingParty(null);
    setIsFormOpen(true);
  };

  const openEditForm = (party) => {
    setEditingParty(party);
    setIsFormOpen(true);
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (isFormOpen) {
    return (
      <PartyForm 
        type={type} 
        branches={branches} 
        party={editingParty}
        selectedBranch={selectedBranch}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          setIsFormOpen(false);
          fetchParties(page);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white lowercase text-sm">
      <div className="w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Groups />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight capitalize">{pageTitle}</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{pageSubtitle}</p>
            </div>
          </div>
          <button 
            onClick={openAddForm}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary-light transition-all flex items-center gap-2 shadow-sm"
          >
            <AddCircle sx={{ fontSize: 18 }} />
            Add {isCustomer ? 'Customer' : 'Vendor'}
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
              placeholder={`Search ${pageTitle.toLowerCase()} by name or phone...`}
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
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Party Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Contact</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Branch</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-right">Opening Bal.</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center"><CircularProgress size={24} sx={{ color: '#EA5E28' }} /></td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 font-bold">
                    No {pageTitle.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                parties.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 capitalize">{p.display_name}</div>
                      {p.legal_name && <div className="text-[11px] text-gray-400 font-medium capitalize mt-0.5">{p.legal_name}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-600">{p.phone || '—'}</div>
                      {p.email && <div className="text-[11px] text-gray-400 mt-0.5">{p.email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100/80 text-gray-500 font-black text-[10px] uppercase tracking-wider">
                        {p.branch_name || 'Global'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-black text-[13px] ${p.opening_balance > 0 ? (p.opening_balance_side === 'Dr' ? 'text-emerald-500' : 'text-rose-500') : 'text-gray-400'}`}>
                        {p.opening_balance > 0 ? `${parseFloat(p.opening_balance).toLocaleString()} ${p.opening_balance_side}` : '0.00'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Tooltip title="Edit" arrow>
                        <IconButton onClick={() => openEditForm(p)} size="small" sx={{ color: '#0EA5E9', '&:hover': { background: '#E0F2FE' }, mr: 0.5 }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete" arrow>
                        <IconButton onClick={() => handleDelete(p.id)} size="small" sx={{ color: '#EF4444', '&:hover': { background: '#FEE2E2' } }}>
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
            Showing {((page - 1) * limit) + (parties.length > 0 ? 1 : 0)} to {((page - 1) * limit) + parties.length} of {totalCount} entries
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
