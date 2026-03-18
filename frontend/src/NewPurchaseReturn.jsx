import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  QrCodeScanner, Search, PersonOutline, PaymentsOutlined,
  AccountBalanceOutlined, CreditScoreOutlined, Delete,
  ShoppingCart, Refresh, ChevronLeft, ChevronRight,
  ShoppingBag, SaveOutlined, LocalShipping, Add, InfoOutlined,
  Store, ArrowBack, AssignmentReturn
} from '@mui/icons-material';

const API  = 'http://localhost:8000';
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toN  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

//  Dropdown Helper 
function Dropdown({ items, onSelect, renderItem, onClose }) {
  const [hi, setHi] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(x => Math.min(x + 1, items.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(x => Math.max(x - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); if (items[hi]) onSelect(items[hi]); }
      if (e.key === 'Escape')    { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, hi, onSelect, onClose]);

  if (!items.length) return null;
  return (
    <div ref={listRef} className="absolute top-full left-0 right-0 z-[999] bg-white rounded-xl shadow-xl border border-gray-300 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto mt-1">
      {items.map((item, i) => (
        <div key={item.id} data-idx={i}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          onMouseEnter={() => setHi(i)}
          className={`px-4 py-2 cursor-pointer transition-all text-[11px] ${i === hi ? 'bg-orange-50 text-primary' : 'bg-white hover:bg-gray-50'}`}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

export default function NewPurchaseReturn() {
  const navigate = useNavigate();

  //  Form State 
  const [branches, setBranches] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [returnStatus, setReturnStatus] = useState('pending');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  //  Vendor 
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorResults, setVendorResults] = useState([]);
  const [vendor, setVendor] = useState(null);

  //  Product Search 
  const [barcodeVal, setBarcodeVal] = useState('');
  const [nameVal, setNameVal] = useState('');
  const [qtyVal, setQtyVal] = useState('1');
  const [priceVal, setPriceVal] = useState('');
  const [nameResults, setNameResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeUnit, setActiveUnit] = useState(null);

  const barcodeRef = useRef(null);
  const nameRef    = useRef(null);
  const qtyRef       = useRef(null);
  const priceRef     = useRef(null);

  //  Cart 
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');

  //  Totals 
  const [discPct, setDiscPct] = useState('0');
  const [taxPct, setTaxPct]   = useState('0');

  //  Refund State (Receipt from Vendor)
  const [payMethod, setPayMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('0');
  const [selectedBank, setSelectedBank] = useState('');

  //  Feedback 
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  //  Init 
  useEffect(() => {
    axios.get(`${API}/api/purchase/form-data/`, { withCredentials: true })
      .then(r => {
        setBranches(r.data.branches || []);
        setBankAccounts(r.data.bank_accounts || []);
        setVendors(r.data.vendors || []);
        setProducts(r.data.products || []);
        if (r.data.branches?.length) setSelectedBranch(r.data.branches[0]);
      }).catch(() => { });
    setTimeout(() => barcodeRef.current?.focus(), 200);
  }, []);

  //  Search Logic 
  useEffect(() => {
    if (!vendorQuery.trim()) { setVendorResults([]); return; }
    const q = vendorQuery.toLowerCase();
    const res = vendors.filter(v => v.display_name.toLowerCase().includes(q) || (v.phone && v.phone.includes(q)));
    setVendorResults(res.slice(0, 8));
  }, [vendorQuery, vendors]);

  const searchProducts = useCallback((q) => {
    if (!q.trim()) { setNameResults([]); return; }
    const term = q.toLowerCase();
    const res = products.filter(p => (p.name && p.name.toLowerCase().includes(term)) || (p.barcode && p.barcode.includes(term)));
    setNameResults(res.slice(0, 8));
  }, [products]);

  const buildUnits = (prod) => {
    const units = [];
    if (prod.uom_id) units.push({ uomId: prod.uom_id, uomCode: prod.uom_code, spu: 1, label: prod.uom_code });
    if (prod.bulk_uom_id) units.push({ uomId: prod.bulk_uom_id, uomCode: prod.bulk_uom_code, spu: toN(prod.default_bulk_size), label: prod.bulk_uom_code });
    return units;
  };

  const selectProduct = (prod) => {
    const u = buildUnits(prod);
    setSelectedProduct(prod);
    setActiveUnit(u[0]);
    setNameVal(prod.name);
    setNameResults([]);
    setQtyVal('1');
    setPriceVal(prod.purchase_price ? String(prod.purchase_price) : '0');
    qtyRef.current?.focus();
  };

  const handleUnitSwitch = (u) => {
    setActiveUnit(u);
    if (selectedProduct) {
        setPriceVal(String(toN(selectedProduct.purchase_price) * u.spu));
    }
  };

  const handleBarcodeEnter = () => {
    const bc = barcodeVal.trim();
    if (!bc) { nameRef.current?.focus(); return; }
    const hit = products.find(p => p.barcode === bc);
    if (hit) {
        const units = buildUnits(hit);
        addToCart(hit, units[0], 1, hit.purchase_price || 0);
        setBarcodeVal('');
    } else {
        setNameVal(bc); setBarcodeVal(''); nameRef.current?.focus(); searchProducts(bc);
    }
  };

  const addToCart = (prod, unit, qty, price) => {
    setCart(prev => {
        const ex = prev.findIndex(c => c.productId === prod.id && c.uomId === unit.uomId);
        if (ex !== -1) {
            const nxt = [...prev]; nxt[ex].qty += toN(qty); return nxt;
        }
        return [...prev, {
            productId: prod.id, name: prod.name, uomId: unit.uomId, uomCode: unit.uomCode,
            qty: toN(qty), price: toN(price), spu: unit.spu
        }];
    });
  };

  const removeFromCart = (idx) => setCart(p => p.filter((_, i) => i !== idx));
  const updateCart = (idx, field, val) => setCart(p => { const u = [...p]; u[idx][field] = toN(val); return u; });

  const subTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discAmt = subTotal * toN(discPct) / 100;
  const taxAmt = (subTotal - discAmt) * toN(taxPct) / 100;
  const netTotal = subTotal - discAmt + taxAmt;

  const handleSave = async () => {
      if (saving || !vendor || !cart.length) return;
      setSaving(true);
      try {
          const payload = {
              branch_id: selectedBranch?.id,
              vendor_id: vendor.id,
              status: returnStatus,
              return_date: returnDate,
              discount_percent: toN(discPct),
              tax_percent: toN(taxPct),
              notes,
              items: cart.map(i => ({ 
                  product_id: i.productId, 
                  uom_id: i.uomId, 
                  quantity: i.qty, 
                  price: i.price, 
                  size_per_unit: i.spu
              })),
              refund: (payMethod !== 'credit' && toN(paidAmount) > 0) ? {
                  amount: toN(paidAmount),
                  payment_method: payMethod,
                  bank_account_id: payMethod === 'bank' ? selectedBank : null
              } : null
          };
          await axios.post(`${API}/api/purchase/returns/create/`, payload, { withCredentials: true });
          showToast('ok', 'Return saved successfully!');
          setTimeout(() => navigate('/purchasing/returns'), 1000);
      } catch (e) {
          showToast('err', e.response?.data?.error || 'Save failed.');
      } finally {
          setSaving(false);
      }
  };

  const handleReset = () => {
    setCart([]); setVendor(null); setVendorQuery(''); setPaidAmount('0'); setNotes(''); setSelectedProduct(null);
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden" style={{ fontFamily: "'Google Sans', sans-serif" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-gray-300 px-6 h-16 grid grid-cols-3 items-center shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/purchasing/returns')} className="p-2 hover:bg-gray-50 rounded-full transition-colors group">
                <ArrowBack className="text-gray-400 group-hover:text-primary transition-colors" sx={{ fontSize: 20 }} />
            </button>
            <div className="flex flex-col">
                <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">
                   New Purchase Return
                </h1>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none text-orange-500">Stock Reversal (OUT)</span>
            </div>
        </div>

        <div className="flex justify-center h-full">
            <div className="flex gap-8 h-full items-center">
                {branches.map(b => (
                    <button key={b.id} onClick={() => setSelectedBranch(b)}
                        className={`group relative flex items-center gap-2.5 h-16 transition-all`}>
                        <Store sx={{ fontSize: 18 }} className={selectedBranch?.id === b.id ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} />
                        <span className={`text-[11px] font-black uppercase tracking-widest ${selectedBranch?.id === b.id ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                            {b.name}
                        </span>
                        {selectedBranch?.id === b.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in zoom-in-y duration-300" />
                        )}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex items-center justify-end gap-6">
            {toast && <span className={`text-[10px] font-black uppercase tracking-widest ${toast.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>{toast.msg}</span>}
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300 shadow-sm">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Date</p>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} 
                    className="bg-transparent text-[11px] font-black text-gray-700 outline-none border-none focus:ring-0 p-0" />
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COMPACT SIDEBAR */}
        <div className="w-[300px] border-r border-gray-300 flex flex-col shrink-0 divide-y divide-gray-300/60 overflow-y-auto no-scrollbar">
          
          <div className="p-4 space-y-2">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">A. Vendor Entity</p>
             <div className="relative">
                <input value={vendorQuery} onChange={e => { setVendorQuery(e.target.value); if(vendor) setVendor(null); }}
                    className="w-full h-11 px-4 bg-gray-50 rounded-xl text-[12px] font-bold outline-none border border-transparent focus:bg-white focus:border-gray-300" placeholder="Lookup supplier..." />
                {vendorResults.length > 0 && (
                    <Dropdown items={vendorResults} onSelect={v => { setVendor(v); setVendorQuery(v.display_name); setVendorResults([]); }}
                        onClose={() => setVendorResults([])}
                        renderItem={v => (
                            <div className="flex flex-col py-1">
                                <span className="font-black text-[12px]">{v.display_name}</span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase">{v.phone || 'No Contact'}</span>
                            </div>
                        )} />
                )}
             </div>
             {vendor && (
               <div className="flex justify-between items-center px-1 animate-in fade-in">
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier Ledger</span>
                 <span className={`text-[12px] font-black ${vendor.cached_balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Rs {fmtK(Math.abs(vendor.cached_balance))} {vendor.cached_balance >= 0 ? 'Cr' : 'Dr'}</span>
               </div>
             )}
          </div>

          <div className="p-4 space-y-2">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">B. Record Status</p>
             <div className="flex p-1 bg-gray-50 rounded-xl gap-1">
                {['pending', 'processed'].map(s => (
                    <button key={s} onClick={() => setReturnStatus(s)}
                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${returnStatus === s ? 'bg-white text-primary shadow-sm border border-orange-100' : 'text-gray-400 hover:text-gray-600'}`}>{s}</button>
                ))}
             </div>
             <p className="text-[8px] font-bold text-gray-300 px-1 uppercase tracking-tighter">Processed returns will deduct stock.</p>
          </div>

          <div className="p-4 space-y-1">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">C. Refund Reception</p>
             <div className="flex p-1 bg-gray-50 rounded-xl gap-1">
               {['cash', 'bank', 'credit'].map(m => (
                 <button key={m} onClick={() => { setPayMethod(m); if (m === 'credit') setPaidAmount('0'); }}
                   className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${payMethod === m ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-gray-400 hover:text-gray-500'}`}>{m}</button>
               ))}
              </div>
              {payMethod !== 'credit' && (
               <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                 <div className="relative">
                   <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0.00"
                     className="w-full px-4 py-3 bg-gray-50 rounded-xl text-[14px] font-black text-emerald-600 text-right pr-12 outline-none focus:bg-white" />
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 uppercase">Rs</span>
                 </div>
                 {payMethod === 'bank' && (
                   <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full h-11 px-3 bg-gray-50 rounded-xl text-[11px] font-bold text-gray-600 border border-transparent outline-none">
                      <option value="">A/C Selection...</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
                   </select>
                 )}
               </div>
             )}
          </div>

          <div className="p-4 pt-8 mt-auto space-y-2 bg-gray-50/30">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-300 pb-3 mb-4">Financial Snap</p>
             {[
               { l: 'Subtotal (Net Cost)', v: subTotal },
               { l: 'Tax Adjust', v: taxAmt, c: 'text-gray-700' },
               { l: 'Discount', v: discAmt, c: 'text-red-500' },
             ].map(x => (
               <div key={x.l} className="flex justify-between items-center text-[11px] font-black">
                 <span className="text-gray-400 uppercase tracking-tighter">{x.l}</span>
                 <span className={x.c || 'text-gray-700'}>Rs {fmtK(x.v)}</span>
               </div>
             ))}
             <div className="pt-2 mt-2 border-t border-gray-300 space-y-2 text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Total Return Value</p>
                <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">Rs {fmtK(netTotal)}</p>
                <div className="flex justify-between text-[9px] font-black uppercase text-gray-400 pt-2 tracking-widest border-t border-gray-50 mt-2">
                   <span>Refunded: {fmtK(paidAmount)}</span>
                   <span className={(netTotal - toN(paidAmount)) > 0.01 ? 'text-amber-500 font-bold' : ''}>Bal: {fmtK(Math.max(0, netTotal - toN(paidAmount)))}</span>
                </div>
             </div>
          </div>
        </div>

        {/* MAIN WORKING AREA */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="pb-24">
              
              {/* Quick row */}
              <div className="flex items-center gap-3 p-6 bg-gray-50/20 border-b border-gray-200 sticky top-0 bg-white z-[30]">
                 <div className="w-[120px] shrink-0">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><QrCodeScanner sx={{ fontSize: 13 }} /> Barcode</p>
                    <input ref={barcodeRef} value={barcodeVal} onChange={e => setBarcodeVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBarcodeEnter()}
                      className="w-full h-10 px-4 bg-white border border-gray-300 rounded-xl text-[11px] font-bold outline-none focus:border-primary shadow-sm transition-all" placeholder="Scan..." />
                 </div>
                 <div className="flex-1 relative">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1.5"><Search sx={{ fontSize: 13 }} /> Product Search</p>
                    <input ref={nameRef} value={nameVal} onChange={e => { setNameVal(e.target.value); setSelectedProduct(null); searchProducts(e.target.value); }}
                      onBlur={() => setTimeout(() => setNameResults([]), 200)}
                      className="w-full h-10 px-4 bg-white border border-gray-300 rounded-xl text-[11px] font-bold outline-none focus:border-primary shadow-sm transition-all" placeholder="Lookup product..." />
                    {nameResults.length > 0 && (
                      <Dropdown items={nameResults} onSelect={selectProduct} onClose={() => setNameResults([])}
                        renderItem={p => (
                          <div className="flex justify-between py-1 font-bold text-[11px]">
                            <span>{p.name}</span>
                            <span className="text-primary font-black">Rs {fmtK(p.purchase_price)}</span>
                          </div>
                        )} />
                    )}
                 </div>
                 {selectedProduct && (
                   <div className="shrink-0 animate-in fade-in slide-in-from-right-2">
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5">Unit</p>
                     <div className="flex gap-1 p-1 bg-white border border-gray-300 rounded-xl h-10">
                        {buildUnits(selectedProduct).map(u => (
                          <button key={u.label} onClick={() => handleUnitSwitch(u)} className={`px-4 rounded-lg text-[9px] font-black uppercase transition-all ${activeUnit?.label === u.label ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>{u.label}</button>
                        ))}
                     </div>
                   </div>
                 )}
                 <div className="w-[70px] shrink-0 text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Qty</p>
                    <input ref={qtyRef} type="number" value={qtyVal} 
                      onChange={e => setQtyVal(e.target.value)} 
                      onFocus={e => e.target.select()}
                      onKeyDown={e => e.key === 'Enter' && priceRef.current?.focus()}
                      className="w-full h-10 px-2 bg-white border border-gray-300 rounded-xl text-center text-[12px] font-black outline-none focus:border-primary shadow-sm" />
                 </div>
                 <div className="w-[100px] shrink-0 text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mr-1 mb-1.5 text-indigo-500">Unit Cost</p>
                    <input ref={priceRef} type="number" value={priceVal} 
                      onChange={e => setPriceVal(e.target.value)} 
                      onFocus={e => e.target.select()}
                      onKeyDown={e => e.key === 'Enter' && selectedProduct && addToCart(selectedProduct, activeUnit, qtyVal, priceVal)}
                      className="w-full h-10 px-4 bg-white border border-gray-300 rounded-xl text-right text-[12px] font-black text-indigo-600 outline-none focus:border-primary shadow-sm" />
                 </div>
                 <button onClick={() => { if(selectedProduct) { addToCart(selectedProduct, activeUnit, qtyVal, priceVal); setSelectedProduct(null); setNameVal(''); setPriceVal(''); setBarcodeVal(''); barcodeRef.current?.focus(); } }}
                  className={`h-10 self-end px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${selectedProduct ? 'bg-primary text-white shadow-lg active:scale-95' : 'bg-white border border-gray-200 text-gray-300 cursor-not-allowed'}`}>
                  Add
                 </button>
              </div>

              {/* Content Table */}
              <table className="w-full text-left truncate">
                  <thead className="sticky top-0 bg-white z-10 border-b border-gray-300 shadow-sm">
                    <tr>
                      {['#', 'Item Description', 'Unit', 'Returning Cost', 'Qty', 'Line Total', ''].map((h, i) => (
                        <th key={h} className={`px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50/30 ${i >= 3 && i <= 5 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300/60">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center opacity-10">
                          <AssignmentReturn sx={{ fontSize: 50 }} />
                          <p className="text-[10px] font-black uppercase mt-2 tracking-widest">No Items Added</p>
                        </td>
                      </tr>
                     ) : cart.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-orange-50/10 transition-colors">
                        <td className="px-6 py-5 text-[11px] font-black text-gray-300">{idx + 1}</td>
                        <td className="px-6 py-5">
                          <p className="text-[12px] font-black text-gray-800 tracking-tight">{item.name}</p>
                        </td>
                        <td className="px-6 py-5 text-[10px] font-black text-primary uppercase">{item.uomCode}</td>
                        <td className="px-6 py-5 text-right">
                           <input type="number" value={item.price} onFocus={e => e.target.select()} onChange={e => updateCart(idx, 'price', e.target.value)} className="w-[100px] h-8 px-2 bg-transparent hover:bg-white text-right text-[12px] font-black text-indigo-600 border border-transparent rounded-lg hover:border-gray-300 outline-none transition-all focus:bg-white focus:border-primary" />
                        </td>
                        <td className="px-6 py-5 text-right">
                           <input type="number" value={item.qty} onFocus={e => e.target.select()} onChange={e => updateCart(idx, 'qty', e.target.value)} className="w-[80px] h-8 px-2 bg-transparent hover:bg-white text-right text-[12px] font-black text-gray-800 border border-transparent rounded-lg hover:border-gray-300 outline-none transition-all focus:bg-white focus:border-primary" />
                        </td>
                        <td className="px-6 py-5 text-right text-[12px] font-black text-gray-900">Rs {fmtK(item.qty * item.price)}</td>
                        <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 transition-all pr-10">
                           <button onClick={() => removeFromCart(idx)} className="text-gray-300 hover:text-red-500 transition-colors"><Delete sx={{ fontSize: 18 }} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Extras Area */}
                <div className="p-8 space-y-10 border-t border-gray-300 bg-gray-50/10">
                   
                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest px-1">Adjustments</p>
                        <div className="space-y-3">
                           <div className="flex items-center justify-between bg-white p-3 border border-gray-200 rounded-2xl">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax (%)</span>
                              <input type="number" value={taxPct} onChange={e => setTaxPct(e.target.value)} className="w-20 text-right font-black text-gray-900 outline-none p-0 bg-transparent" />
                           </div>
                           <div className="flex items-center justify-between bg-white p-3 border border-gray-200 rounded-2xl">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount (%)</span>
                              <input type="number" value={discPct} onChange={e => setDiscPct(e.target.value)} className="w-20 text-right font-black text-red-500 outline-none p-0 bg-transparent" />
                           </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest px-1">Memo / Remarks</p>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for return, damaged condition, etc..."
                          className="w-full h-[100px] p-5 bg-white border border-gray-300 rounded-2xl text-[11px] font-bold outline-none resize-none focus:border-gray-500 transition-all font-google-sans no-scrollbar" />
                      </div>
                   </div>
                </div>
            </div>
          </div>

          {/* Footer */}
          <div className="h-20 flex items-center justify-between px-10 border-t border-gray-300 shrink-0 bg-white z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.04)]">
             <div className="flex items-center gap-16">
                <div className="flex flex-col"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Cost</span><span className="text-lg font-black text-gray-800">Rs {fmtK(subTotal)}</span></div>
                <div className="flex flex-col border-l border-gray-300 pl-16"><span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total Return Value</span><span className="text-2xl font-black text-primary tracking-tighter leading-none">Rs {fmtK(netTotal)}</span></div>
             </div>
             <div className="flex items-center gap-6">
                <button onClick={handleReset} className="h-12 w-12 flex items-center justify-center text-gray-300 hover:text-gray-600 transition-colors border border-gray-300 rounded-xl hover:bg-gray-50"><Refresh sx={{ fontSize: 24 }} /></button>
                <div className="flex items-center gap-4 bg-gray-50 p-1.5 rounded-2xl border border-gray-300">
                    <span className="text-[9px] font-black text-gray-400 uppercase px-4 tracking-widest font-google-sans">Submit Return?</span>
                    <button disabled={saving} onClick={handleSave} className="px-12 py-3.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all">
                      {saving ? 'Syncing...' : 'Complete Return'}
                    </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
