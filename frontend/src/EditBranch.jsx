import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowBack, Save, Business 
} from '@mui/icons-material';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:8000';

export default function EditBranch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    opening_balance: 0,
    opening_balance_date: '',
  });

  useEffect(() => {
    fetchBranchDetails();
  }, [id]);

  const fetchBranchDetails = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/branches/${id}/`, { withCredentials: true });
      setFormData(res.data);
    } catch (err) {
      setError('Failed to fetch branch details.');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.patch(`${BACKEND_URL}/api/branches/${id}/edit/`, formData, { withCredentials: true });
      navigate('/business-dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update branch.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return;
    setLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/branches/${id}/delete/`, { withCredentials: true });
      navigate('/business-dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete branch.');
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-10 text-center font-black uppercase tracking-widest text-gray-300 text-xs">Loading Details...</div>;

  return (
    <div className="h-screen flex flex-col bg-mesh p-6 lowercase text-sm">
      <div className="max-w-xl mx-auto w-full bg-white rounded-3xl border border-gray-100 shadow-premium overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-zinc-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-xl">
              <Business />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Edit Branch</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Update Branch Information</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDelete}
              title="Delete Branch"
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <Save sx={{ fontSize: 18, color: 'inherit', display: 'none' }} />
              <span className="text-[10px] font-black uppercase tracking-widest">Delete</span>
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <ArrowBack />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5 flex-1 overflow-y-auto">
          {error && <div className="p-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Branch Name</label>
              <input 
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Downtown Branch"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Branch Code</label>
              <input 
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="BR-001"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
              <input 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+92..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="branch@business.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
              />
            </div>

            <div className="col-span-2 space-y-1.5 border-t border-gray-50 pt-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Financial Data</label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Opening Balance (PKR)</label>
                  <input 
                    type="number"
                    name="opening_balance"
                    value={formData.opening_balance}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300"
                  />
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

            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location Address</label>
              <textarea 
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                placeholder="Full physical address..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold placeholder:text-gray-300 resize-none"
              />
            </div>
          </div>
        </form>

        {/* Action */}
        <div className="p-6 bg-gray-50/50 border-t border-gray-50">
          <button 
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white py-3.5 rounded-2xl font-black text-sm shadow-premium hover:bg-primary-light transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Updating...' : (
              <>
                <Save sx={{ fontSize: 18 }} />
                Update Branch Details
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
