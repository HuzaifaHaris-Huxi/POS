import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import {
  QrCodeScanner, Search, PersonOutline, PaymentsOutlined,
  AccountBalanceOutlined, CreditScoreOutlined, Delete,
  ShoppingCart, ReceiptLong, Refresh, ChevronLeft, ChevronRight,
  PointOfSale, ArrowForward, Add, Storefront, ArrowBack, AssignmentReturn
} from '@mui/icons-material';

const API  = 'http://localhost:8000';
const fmt  = (n) => Number(n || 0).toFixed(2);
const fmtK = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toN  = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// ── Keyboard navigable dropdown ───────────────────────────────────────────────
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

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  if (!items.length) return null;
  return (
    <div ref={listRef} className="absolute top-full left-0 right-0 z-[1000] bg-white rounded-2xl shadow-premium border border-gray-300 overflow-hidden max-h-[320px] overflow-y-auto mt-2 animate-in slide-in-from-top-2 duration-200">
      {items.map((item, i) => (
        <div key={item.id} data-idx={i}
          onMouseDown={() => onSelect(item)}
          onMouseEnter={() => setHi(i)}
          className={`px-4 py-2.5 cursor-pointer border-l-[3px] transition-all text-[12px] ${i === hi ? 'bg-orange-50 border-l-primary' : 'bg-white border-l-transparent hover:bg-gray-50'}`}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function EditSalesReturn() {
  const navigate = useNavigate();
  const { id } = useParams();

  // ── Form data ─────────────────────────────────────────────────────────────
  const [branches, setBranches]         = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [returnDate, setReturnDate]         = useState('');

  // ── Customer ─────────────────────────────────────────────────────────────
  const [custQuery, setCustQuery]     = useState('');
  const [custResults, setCustResults] = useState([]);
  const [customer, setCustomer]       = useState(null);
  const custTimer = useRef(null);

  // ── Refund
  const [payMethod, setPayMethod] = useState('cash');
  const [bankAccId, setBankAccId] = useState('');
  const [refunded, setRefunded]   = useState('0.00');

  // ── Product search ────────────────────────────────────────────────────────
  const [barcodeVal, setBarcodeVal]         = useState('');
  const [nameVal, setNameVal]               = useState('');
  const [qtyVal, setQtyVal]                 = useState('1');
  const [priceVal, setPriceVal]             = useState('');
  const [nameResults, setNameResults]       = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeUnit, setActiveUnit]         = useState(null);
  const nameTimer = useRef(null);

  const barcodeRef = useRef(null);
  const nameRef    = useRef(null);
  const qtyRef     = useRef(null);
  const priceRef   = useRef(null);

  // ── Cart ─────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState([]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const [discPct, setDiscPct] = useState('0');
  const [taxPct, setTaxPct]   = useState('0');

  // ── App State ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fdRes, srRes] = await Promise.all([
          axios.get(`${API}/api/sales/form-data/`, { withCredentials: true }),
          axios.get(`${API}/api/sales/returns/${id}/`, { withCredentials: true })
        ]);

        const br = fdRes.data.branches || [];
        setBranches(br);

        const sr = srRes.data;
        setReturnDate(sr.created_at.split(' ')[0]);
        setDiscPct(String(sr.discount_percent));
        setTaxPct(String(sr.tax_percent));
        setRefunded(fmt(sr.amount_refunded));
        setPayMethod(sr.payment_method || 'cash');
        setBankAccId(sr.bank_account_id || '');
        setBankAccounts(fdRes.data.bank_accounts || []);
        
        if (sr.branch_id) {
          const b = br.find(x => x.id === sr.branch_id);
          if (b) setSelectedBranch(b);
        }

        if (sr.customer_id) {
            // Minimal customer mock for display
            setCustomer({ id: sr.customer_id, display_name: sr.customer });
            setCustQuery(sr.customer);
        } else {
            setCustQuery(sr.customer || '');
        }

        setCart((sr.items || []).map(i => ({
            productId: i.product_id,
            name: i.product_name,
            qty: i.quantity,
            price: i.unit_price,
            uomCode: 'UNT', // Mocked as simplified return model doesn't store UOM id yet
        })));

      } catch (e) {
        showToast('err', 'Failed to load details.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed totals
  // ─────────────────────────────────────────────────────────────────────────
  const subTotal  = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discAmt   = subTotal * toN(discPct) / 100;
  const taxAmt    = (subTotal - discAmt) * toN(taxPct) / 100;
  const netTotal  = subTotal - discAmt + taxAmt;
  const balDue    = Math.max(0, netTotal - toN(refunded));

  // ─────────────────────────────────────────────────────────────────────────
  // Customer search
  // ─────────────────────────────────────────────────────────────────────────
  const searchCustomers = useCallback((q) => {
    clearTimeout(custTimer.current);
    if (!q.trim()) { setCustResults([]); return; }
    custTimer.current = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ search: q, type: 'CUSTOMER' });
        if (selectedBranch) p.append('branch_id', selectedBranch.id);
        const r = await axios.get(`${API}/api/parties/?${p}`, { withCredentials: true });
        setCustResults(r.data.parties || []);
      } catch { setCustResults([]); }
    }, 280);
  }, [selectedBranch]);

  // ─────────────────────────────────────────────────────────────────────────
  // Unit helpers
  // ─────────────────────────────────────────────────────────────────────────
  const buildUnits = (prod) => {
    const units = [];
    if (prod.uom_id) {
      units.push({
        uomId:   prod.uom_id,
        uomCode: prod.uom_code || 'UNT',
        spu:     1,
        price:   parseFloat(prod.sale_price || 0),
        label:   prod.uom_code || 'UNT',
        isBulk:  false,
      });
    }
    return units;
  };

  const handleBarcodeEnter = async () => {
    const bc = barcodeVal.trim();
    if (!bc) { nameRef.current?.focus(); return; }
    try {
      const p = new URLSearchParams({ search: bc });
      if (selectedBranch) p.append('branch_id', selectedBranch.id);
      const r = await axios.get(`${API}/api/products/?${p}&limit=5`, { withCredentials: true });
      const hit = r.data.products?.find(x => x.barcode === bc) || r.data.products?.[0];
      if (hit) {
        const units = buildUnits(hit);
        addToCart(hit, units[0], 1, null);
        setBarcodeVal(''); barcodeRef.current?.focus();
      } else {
        setNameVal(bc); setBarcodeVal(''); nameRef.current?.focus(); searchByName(bc);
      }
    } catch { nameRef.current?.focus(); }
  };

  const searchByName = useCallback((q) => {
    clearTimeout(nameTimer.current);
    if (!q.trim()) { setNameResults([]); return; }
    nameTimer.current = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ search: q });
        if (selectedBranch) p.append('branch_id', selectedBranch.id);
        const r = await axios.get(`${API}/api/products/?${p}&limit=8`, { withCredentials: true });
        setNameResults(r.data.products || []);
      } catch { setNameResults([]); }
    }, 280);
  }, [selectedBranch]);

  const selectProduct = (prod) => {
    const units = buildUnits(prod);
    const defaultUnit = units[0];
    setSelectedProduct(prod);
    setActiveUnit(defaultUnit);
    setNameVal(prod.name);
    setNameResults([]);
    setPriceVal(fmt(defaultUnit ? defaultUnit.price : prod.sale_price));
    setQtyVal('1');
    qtyRef.current?.focus();
  };

  const addToCart = (prod, unit, qty, overridePrice) => {
    const price = overridePrice !== null && overridePrice !== undefined ? overridePrice : unit?.price ?? parseFloat(prod.sale_price || 0);
    const u = unit || buildUnits(prod)[0] || {};

    setCart(prev => {
      const ex = prev.findIndex(c => c.productId === prod.id);
      if (ex !== -1) {
        const nxt = [...prev]; nxt[ex] = { ...nxt[ex], qty: nxt[ex].qty + qty }; return nxt;
      }
      return [...prev, { productId: prod.id, name: prod.name, qty, price, uomCode: u.uomCode || 'UNT' }];
    });
  };

  const updateCart     = (idx, field, val) => setCart(p => { const u = [...p]; u[idx] = { ...u[idx], [field]: toN(val) }; return u; });
  const removeFromCart = (idx)             => setCart(p => p.filter((_, i) => i !== idx));

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    if (!cart.length) { showToast('err', 'Add at least one product.'); return; }
    setSaving(true);
    try {
      const payload = {
        branch_id: selectedBranch?.id || null,
        customer_id: customer?.id || null,
        discount_percent: toN(discPct),
        tax_percent:      toN(taxPct), 
        payment_method:   payMethod,
        bank_account_id:  payMethod === 'bank' ? bankAccId : null,
        amount_refunded:  toN(refunded),
        items: cart.map(i => ({ product_id: i.productId, quantity: i.qty, price: i.price })),
      };
      await axios.patch(`${API}/api/sales/returns/${id}/edit/`, payload, { withCredentials: true });
      showToast('ok', `Return #${id} updated!`);
      setTimeout(() => navigate('/sales/returns'), 1500);
    } catch (e) {
      showToast('err', e.response?.data?.error || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4500); };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-gray-300 uppercase tracking-[0.3em]">Synching Details…</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white animate-in fade-in duration-200" style={{ fontFamily: "'Google Sans', sans-serif" }}>

      {/* HEADER */}
      <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sales/returns')} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-300 text-gray-400 hover:text-primary transition-all">
            <ArrowBack sx={{ fontSize: 20 }} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">Edit Return #{id}</h1>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none tracking-tighter text-primary animate-pulse">Update Mode</span>
          </div>
        </div>

        <div className="flex justify-center h-full">
          <div className="flex gap-8 h-full items-center">
            {branches.map(b => {
              const active = selectedBranch?.id === b.id;
              return (
                <div key={b.id} className={`flex items-center gap-2.5 h-16 ${active ? 'text-primary' : 'text-gray-300 opacity-50 cursor-not-allowed'}`}>
                  <Storefront sx={{ fontSize: 18 }} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{b.name}</span>
                  {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 text-[10px] font-black uppercase tracking-widest">
            {toast && <span className={toast.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}>{toast.msg}</span>}
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300">
                <p className="text-[9px] text-gray-400">Return Date</p>
                <span className="font-black text-gray-700">{returnDate}</span>
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-gray-50/30">
        <div className="w-80 bg-white border-r border-gray-300 flex flex-col shadow-sm">
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">A. Customer Entity</p>
            <div className="relative">
              <input value={custQuery} onChange={e => { setCustQuery(e.target.value); searchCustomers(e.target.value); setCustomer(null); }}
                className="w-full h-11 px-4 bg-gray-50 rounded-xl text-[12px] font-bold outline-none border border-transparent focus:bg-white focus:border-gray-300 shadow-sm" />
              {custResults.length > 0 && (
                <Dropdown items={custResults} onSelect={p => { setCustomer(p); setCustQuery(p.display_name); setCustResults([]); }}
                  onClose={() => setCustResults([])} renderItem={p => (
                    <span className="font-black text-gray-900 text-[12px]">{p.display_name}</span>
                  )} />
              )}
            </div>
          </div>

          <div className="p-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">B. Refund Method</p>
            <div className="flex gap-2 text-[9px] font-black uppercase">
              {[
                { key: 'cash',  label: 'Cash',  Icon: PaymentsOutlined },
                { key: 'bank',  label: 'Bank',  Icon: AccountBalanceOutlined },
                { key: 'credit', label: 'Credit', Icon: CreditScoreOutlined },
              ].map(({ key, label, Icon }) => {
                const active = payMethod === key;
                return (
                  <button key={key} onClick={() => setPayMethod(key)}
                    className={`flex-1 flex flex-col items-center justify-center gap-2 h-16 rounded-xl border-2 transition-all ${active ? 'border-primary bg-orange-50 text-primary shadow-sm' : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'}`}>
                    <Icon sx={{ fontSize: 18 }} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            {payMethod === 'bank' && (
              <select value={bankAccId} onChange={e => setBankAccId(e.target.value)} className="mt-4 w-full px-4 py-2.5 rounded-xl border border-gray-300 text-[11px] font-black text-gray-700 outline-none appearance-none cursor-pointer">
                <option value="">Select Account…</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>)}
              </select>
            )}
          </div>

          <div className="p-4 pt-8 bg-gray-50/30 border-t border-gray-300 space-y-2">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-300 pb-3 mb-4">Financial Snapshot</p>
             <div className="flex justify-between text-[11px] font-black">
               <span className="text-gray-400">Net Payable</span>
               <span className="text-gray-700">Rs {fmtK(netTotal)}</span>
             </div>
             <div className="flex justify-between items-center bg-white p-2 border border-gray-300 rounded-xl shadow-inner mt-4">
                <span className="text-[9px] font-black text-gray-400 uppercase">Refund Paid</span>
                <input type="number" step="any" value={refunded} onChange={e => setRefunded(e.target.value)} className="w-24 text-right bg-transparent border-none outline-none text-[12px] font-black text-gray-900 focus:ring-0 p-0" />
             </div>
             <div className="pt-2 mt-2 border-t border-gray-300 text-right">
                <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">Rs {fmtK(netTotal)}</p>
                <p className="text-[9px] font-black uppercase text-gray-400 pt-2 tracking-widest">Due to customer: {fmtK(balDue)}</p>
             </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-gray-300 px-8 py-4 shrink-0 shadow-sm z-50">
            <div className="flex gap-4 items-end">
              <div className="flex-none w-48">
                <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Scanner</label>
                <input ref={barcodeRef} value={barcodeVal} onChange={e => setBarcodeVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBarcodeEnter()} placeholder="Scan code…" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-[12px] font-black outline-none" />
              </div>
              <div className="flex-1 relative">
                <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Product Search</label>
                <input ref={nameRef} value={nameVal} onChange={e => { setNameVal(e.target.value); setSelectedProduct(null); searchByName(e.target.value); }} onBlur={() => setTimeout(() => setNameResults([]), 200)} placeholder="Search inventoy…" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-[12px] font-black outline-none" />
                {nameResults.length > 0 && <Dropdown items={nameResults} onSelect={selectProduct} onClose={() => setNameResults([])} renderItem={p => (
                   <div className="flex justify-between text-[12px] font-black py-0.5">
                     <span>{p.name}</span>
                     <span className="text-primary">Rs {fmtK(p.sale_price)}</span>
                   </div>
                )} />}
              </div>
              <div className="w-24">
                <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Qty</label>
                <input ref={qtyRef} type="number" step="any" value={qtyVal} onChange={e => setQtyVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && priceRef.current?.focus()} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-[12px] font-black text-right outline-none" />
              </div>
              <div className="w-32">
                <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Rate</label>
                <input ref={priceRef} type="number" step="any" value={priceVal} onChange={e => setPriceVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-[12px] font-black text-right outline-none" />
              </div>
              <button disabled={!selectedProduct} onClick={() => { addToCart(selectedProduct, buildUnits(selectedProduct)[0], toN(qtyVal), toN(priceVal)); setSelectedProduct(null); setNameVal(''); }} className={`w-12 h-10 rounded-xl flex items-center justify-center ${selectedProduct ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-300'}`}><Add sx={{ fontSize: 24 }} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-300 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 text-left w-12">#</th>
                  <th className="px-5 py-3 text-left">Description</th>
                  <th className="px-5 py-3 text-right w-28">Qty</th>
                  <th className="px-5 py-3 text-right w-32">Rate</th>
                  <th className="px-5 py-3 text-right w-36">Total</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300/60">
                {cart.map((item, idx) => (
                  <tr key={idx} className="hover:bg-orange-50/20 text-[12px] font-black">
                    <td className="px-5 py-3 text-gray-300">{idx+1}</td>
                    <td className="px-5 py-3 text-gray-900">{item.name}</td>
                    <td className="px-5 py-3 text-right"><input type="number" step="any" value={item.qty} onChange={e => updateCart(idx, 'qty', e.target.value)} className="w-20 px-3 py-1.5 border border-gray-300 rounded-xl text-right outline-none" /></td>
                    <td className="px-5 py-3 text-right"><input type="number" step="any" value={item.price} onChange={e => updateCart(idx, 'price', e.target.value)} className="w-28 px-3 py-1.5 border border-gray-300 rounded-xl text-right outline-none" /></td>
                    <td className="px-5 py-3 text-right text-indigo-600">Rs {fmtK(item.qty * item.price)}</td>
                    <td className="px-5 py-3 text-center"><button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600"><Delete sx={{ fontSize: 18 }} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-t border-gray-300 px-8 py-4 flex items-center gap-6 shadow-sm">
             <div className="flex gap-6 px-6 py-2 bg-gray-50 rounded-2xl border border-gray-200 font-black text-[13px]">
                <div className="flex flex-col">
                   <span className="text-[8px] text-gray-400 uppercase">Tax (%)</span>
                   <input type="number" value={taxPct} onChange={e => setTaxPct(e.target.value)} className="bg-transparent border-none outline-none focus:ring-0 p-0 w-12" />
                </div>
                <div className="w-px h-6 bg-gray-300" />
                <div className="flex flex-col">
                   <span className="text-[8px] text-gray-400 uppercase">Disc (%)</span>
                   <input type="number" value={discPct} onChange={e => setDiscPct(e.target.value)} className="bg-transparent border-none outline-none focus:ring-0 p-0 w-12" />
                </div>
             </div>
             <div className="flex-1" />
             <button disabled={saving} onClick={handleSave} className="px-12 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-premium hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {saving ? 'Saving…' : 'Finalize Update'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
