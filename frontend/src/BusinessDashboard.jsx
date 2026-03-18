import { useState, useEffect } from 'react';
import { 
  TrendingUp, AccountBalanceWallet, ShoppingBag, Receipt,
  Add, History, MoreVert, CallReceived, CallMade, Inventory,
  Schedule
} from '@mui/icons-material';

const BACKEND_URL = 'http://localhost:8000';

const fmt = (n) => `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function BusinessDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expiryDays, setExpiryDays] = useState(30);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data
  useEffect(() => {
    setLoading(true);
    const url = `${BACKEND_URL}/api/dashboard-data/?branch_id=${selectedBranch}&year=${selectedYear}&expiry_days=${expiryDays}`;
    fetch(url, { credentials: 'include' })
      .then(res => res.json())
      .then(resData => {
        if (resData.stats) setData(resData);
        else setError(resData.error || 'Failed to load dashboard.');
      })
      .catch(() => setError('Connection error.'))
      .finally(() => setLoading(false));
  }, [selectedBranch, selectedYear, expiryDays]);

  if (loading && !data) return <div className="p-2 text-gray-400 text-[10px]">Loading...</div>;
  if (error) return <div className="p-2 text-red-500 text-[10px]">{error}</div>;
  if (!data) return null;

  const { stats, expiry_products, sales_graph, branches } = data;

  const kpis = [
    { label: 'Receivable', value: stats.receivable, icon: <CallReceived sx={{ fontSize: 16 }} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Payable', value: stats.payable, icon: <CallMade sx={{ fontSize: 16 }} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Cash In Hand', value: stats.cash_in_hand, icon: <AccountBalanceWallet sx={{ fontSize: 16 }} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Inventory', value: stats.inventory, icon: <Inventory sx={{ fontSize: 16 }} />, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="h-screen flex flex-col px-4 pb-4 space-y-3 overflow-hidden animate-in fade-in duration-500">
      
      {/* Top Header Row - Perfectly balanced with Sidebar Logo Row */}
      <div className="flex items-center justify-between shrink-0 h-[60px] border-b border-transparent">
        <div className="pt-1">
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-tight">
            Hey, {data?.business_name || 'Owner'}
          </h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest -mt-0.5">Business Intelligence Suite</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 border-r pr-2.5 border-gray-100 italic font-bold text-[10px]">
             {currentTime.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div className="flex items-center gap-1.5 text-primary">
            <Schedule sx={{ fontSize: 14 }} />
            <span className="font-mono font-black text-xs">
              {currentTime.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Branch Tabs & Controls */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedBranch('all')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              selectedBranch === 'all' 
              ? 'bg-primary text-white shadow-premium' 
              : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'
            }`}
          >
            All
          </button>
          {branches?.map(b => (
            <div key={b.id} className="relative group/tab">
              <button
                onClick={() => setSelectedBranch(b.id)}
                className={`pl-4 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  selectedBranch === b.id 
                  ? 'bg-primary text-white shadow-premium' 
                  : 'bg-white text-gray-400 border border-gray-100 hover:border-primary/20'
                }`}
              >
                {b.name}
              </button>
              <a 
                href={`/branches/edit/${b.id}`}
                className={`absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-all ${
                  selectedBranch === b.id ? 'text-white/50 hover:text-white' : 'text-gray-300 hover:text-primary'
                }`}
              >
                <MoreVert sx={{ fontSize: 14 }} />
              </a>
            </div>
          ))}
          <a href="/branches/new" className="w-8 h-8 rounded-lg bg-white text-gray-300 border border-dashed border-gray-200 hover:text-primary hover:border-primary transition-all flex items-center justify-center">
            <Add sx={{ fontSize: 16 }} />
          </a>
        </div>
      </div>

      {/* Bento KPIs - Premium Card feel with Larger Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="group relative bg-white p-4 rounded-2xl border border-gray-100 transition-all duration-300 hover:border-primary/30 hover:shadow-premium overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">{kpi.label}</p>
                <h3 className="text-2xl font-black text-gray-800 tracking-tighter leading-none">{fmt(kpi.value)}</h3>
              </div>
              <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform duration-300`}>
                {kpi.icon}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 opacity-[0.02] group-hover:opacity-[0.05] scale-150 transition-all duration-500">
               {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Area that consumes the rest of the height */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 pb-2">
        
        {/* Expiry Table - Full Height in its container */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 flex flex-col min-h-0 overflow-hidden shadow-sm hover:border-primary/10 transition-colors">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between shrink-0">
            <h2 className="text-[12px] font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Schedule sx={{ fontSize: 16 }} className="text-rose-500" />
              Stock Expiry Control
            </h2>
            <div className="flex items-center gap-2 bg-gray-50 px-2.5 py-1 rounded-lg">
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Window (Days)</span>
               <input 
                 type="number" 
                 value={expiryDays}
                 onChange={(e) => setExpiryDays(e.target.value)}
                 className="w-10 bg-transparent text-[10px] font-black text-primary outline-none text-center border-l border-gray-200 ml-1 pl-1"
               />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3">
            <table className="w-full text-left border-separate border-spacing-y-1.5">
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                <tr className="text-gray-400">
                  <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest">Description</th>
                  <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-center">In-Stock</th>
                  <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-right">Deadline</th>
                </tr>
              </thead>
              <tbody className="mt-2">
                {expiry_products?.map((p, i) => (
                  <tr key={i} className="group/row bg-white hover:bg-zinc-50 transition-colors">
                    <td className="px-3 py-2.5 rounded-l-xl border-y border-l border-transparent group-hover/row:border-gray-100">
                      <div className="text-[11px] font-bold text-gray-700 truncate">{p.name}</div>
                      <div className="text-[8px] text-rose-500 font-bold uppercase tracking-widest mt-0.5">Immediate Risk</div>
                    </td>
                    <td className="px-3 py-2.5 border-y border-transparent group-hover/row:border-gray-100 text-center text-[11px] font-black text-gray-500">{p.stock_qty}</td>
                    <td className="px-3 py-2.5 rounded-r-xl border-y border-r border-transparent group-hover/row:border-gray-100 text-right text-[10px] font-mono font-black text-gray-400">
                      {new Date(p.expiry_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
                {!expiry_products?.length && (
                  <tr>
                    <td colSpan="3" className="px-4 py-16 text-center text-[10px] text-gray-300 font-black uppercase tracking-[0.2em] italic">No Critical Expiries Found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales Graph - Consumes Height and looks premium */}
        <div className="lg:col-span-7 bg-[#050505] rounded-2xl p-5 flex flex-col min-h-0 border border-zinc-900 shadow-2xl overflow-hidden relative">
          <div className="flex items-center justify-between mb-6 shrink-0 z-10">
            <div>
              <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp sx={{ fontSize: 16 }} className="text-primary" />
                Performance Metrics
              </h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white tracking-tighter">{fmt(sales_graph?.reduce((acc, curr) => acc + curr.total, 0))}</span>
                <span className="text-[8px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Yearly Gross</span>
              </div>
            </div>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-zinc-900 text-zinc-400 text-[10px] font-black px-3 py-1.5 rounded-xl border border-zinc-800 outline-none focus:border-primary transition-all cursor-pointer"
            >
              {[0, 1, 2].map(offset => {
                const year = new Date().getFullYear() - offset;
                return <option key={year} value={year}>{year}</option>
              })}
            </select>
          </div>

          {/* Graph Area - Ensures filling height */}
          <div className="flex-1 flex items-end justify-between gap-2 px-2 min-h-0 border-b border-zinc-900 pb-3 relative">
            {sales_graph?.map((m, i) => {
              const max = Math.max(...sales_graph.map(s => s.total)) || 1;
              const height = (m.total / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group/bar min-h-0">
                  <div className="relative w-full flex justify-center h-full items-end">
                    <div 
                      style={{ height: `${Math.max(height, 5)}%` }}
                      className={`w-full max-w-[16px] rounded-t-lg transition-all duration-1000 ease-out group-hover:max-w-[20px] shadow-lg ${height > 0 ? 'bg-gradient-to-t from-primary/40 to-primary' : 'bg-zinc-800 opacity-20'}`}
                    >
                      {m.total > 0 && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-zinc-900 text-[8px] font-black px-2 py-0.5 rounded shadow-2xl opacity-0 group-hover/bar:opacity-100 transition-all z-20 whitespace-nowrap">
                          {fmt(m.total)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-zinc-700 mt-2 uppercase tracking-tighter group-hover:text-zinc-500 transition-colors italic">{m.month_name}</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 flex items-center justify-between shrink-0 opacity-50 hover:opacity-100 transition-opacity">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Realized</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-800" /><span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Projected</span></div>
             </div>
             <div className="text-[8px] font-black text-zinc-600 uppercase italic">Interactive Data • Realtime</div>
          </div>
        </div>

      </div>

      {/* Quick Access Footer - Slim and elegant */}
      <div className="flex items-center gap-3 shrink-0">
         {[
           { label: 'Create Sale', icon: <CallMade sx={{ fontSize: 16 }} />, color: 'bg-zinc-900 text-white' },
           { label: 'Manage Stock', icon: <Inventory sx={{ fontSize: 16 }} />, color: 'bg-white text-zinc-900 border border-zinc-100' },
           { label: 'View Ledger', icon: <AccountBalanceWallet sx={{ fontSize: 16 }} />, color: 'bg-white text-zinc-900 border border-zinc-100' },
         ].map((act, i) => (
           <div key={i} className={`flex-1 ${act.color} px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-sm font-black`}>
             {act.icon}
             <span className="text-[10px] uppercase tracking-widest">{act.label}</span>
           </div>
         ))}
      </div>

    </div>
  );
}
