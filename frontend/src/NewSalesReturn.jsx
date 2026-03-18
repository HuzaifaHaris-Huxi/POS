import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
export default function NewSalesReturn() {
  const navigate = useNavigate();

  // ── Form data ─────────────────────────────────────────────────────────────
  const [branches, setBranches]         = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [returnDate, setReturnDate]         = useState(new Date().toISOString().split('T')[0]);

  // ── Customer ─────────────────────────────────────────────────────────────
  const [custQuery, setCustQuery]     = useState('');
  const [custResults, setCustResults] = useState([]);
  const [customer, setCustomer]       = useState(null);
  const custTimer = useRef(null);

  // ── Refund ───────────────────────────────────────────────────────────────
  const [payMethod, setPayMethod] = useState('cash');
  const [bankAccId, setBankAccId] = useState('');
  const [refunded, setRefunded]   = useState('');
  const refundedManual = useRef(false);

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

  // ── Save ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);
  const saveRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/api/sales/form-data/`, { withCredentials: true })
      .then(r => {
        setBranches(r.data.branches || []);
        setBankAccounts(r.data.bank_accounts || []);
        if (r.data.branches?.length) setSelectedBranch(r.data.branches[0]);
      }).catch(() => {});
    setTimeout(() => barcodeRef.current?.focus(), 200);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed totals
  // ─────────────────────────────────────────────────────────────────────────
  const subTotal  = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discAmt   = subTotal * toN(discPct) / 100;
  const taxAmt    = (subTotal - discAmt) * toN(taxPct) / 100;
  const netTotal  = subTotal - discAmt + taxAmt;
  const balDue    = Math.max(0, netTotal - toN(refunded));

  useEffect(() => {
    if (!refundedManual.current) {
      if (payMethod === 'credit') setRefunded('0.00');
      else setRefunded(fmt(netTotal));
    }
  }, [payMethod, netTotal]);

  // ─────────────────────────────────────────────────────────────────────────
  // Customer search
  // ─────────────────────────────────────────────────────────────────────────
  const searchCustomers = useCallback((q) => {
    clearTimeout(custTimer.current);
    if (!q.trim()) { setCustResults([]); return; }
    custTimer.current = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ search: q });
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
    if (prod.bulk_uom_id && prod.bulk_uom_code) {
      const spu   = parseFloat(prod.default_bulk_size || 1);
      const price = parseFloat(prod.sale_price || 0) * spu;
      units.push({
        uomId:   prod.bulk_uom_id,
        uomCode: prod.bulk_uom_code,
        spu,
        price,
        label:   prod.bulk_uom_code,
        isBulk:  true,
      });
    }
    return units;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Barcode → auto-add
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Name search
  // ─────────────────────────────────────────────────────────────────────────
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

  const handleUnitChip = (unit) => {
    setActiveUnit(unit);
    setPriceVal(fmt(unit.price));
  };

  const handleQtyEnter   = () => priceRef.current?.focus();
  const handlePriceEnter = () => {
    if (!selectedProduct || !activeUnit) return;
    addToCart(selectedProduct, activeUnit, toN(qtyVal) || 1, toN(priceVal));
    setSelectedProduct(null); setActiveUnit(null);
    setNameVal(''); setQtyVal('1'); setPriceVal('');
    barcodeRef.current?.focus();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Cart
  // ─────────────────────────────────────────────────────────────────────────
  const addToCart = (prod, unit, qty, overridePrice) => {
    const price = overridePrice !== null && overridePrice !== undefined
      ? overridePrice
      : unit?.price ?? parseFloat(prod.sale_price || 0);
    const u = unit || buildUnits(prod)[0] || {};

    setCart(prev => {
      const ex = prev.findIndex(c => c.productId === prod.id && c.uomId === u.uomId);
      if (ex !== -1) {
        const nxt = [...prev]; nxt[ex] = { ...nxt[ex], qty: nxt[ex].qty + qty }; return nxt;
      }
      return [...prev, {
        productId: prod.id, name: prod.name, sku: prod.sku,
        uomId: u.uomId, uomCode: u.uomCode, spu: u.spu || 1,
        qty, price,
      }];
    });
  };

  const updateCart     = (idx, field, val) => setCart(p => { const u = [...p]; u[idx] = { ...u[idx], [field]: toN(val) }; return u; });
  const removeFromCart = (idx)             => setCart(p => p.filter((_, i) => i !== idx));

  // ─────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setCart([]); setCustomer(null); setCustQuery(''); setCustResults([]);
    setPayMethod('cash'); setBankAccId(''); setDiscPct('0'); setTaxPct('0');
    setSelectedProduct(null); setActiveUnit(null);
    setNameVal(''); setBarcodeVal(''); setQtyVal('1'); setPriceVal('');
    refundedManual.current = false; setToast(null);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving || saveRef.current) return;
    if (!cart.length) { showToast('err', 'Add at least one product.'); return; }
    saveRef.current = true; setSaving(true); setToast(null);
    try {
      const payload = {
        branch_id: selectedBranch?.id ?? null,
        customer_id: customer?.id ?? null,
        return_date: returnDate,
        payment_method: payMethod,
        bank_account_id: payMethod === 'bank' ? bankAccId : null,
        amount_refunded: toN(refunded),
        discount_percent: toN(discPct),
        tax_percent:      toN(taxPct), 
        items: cart.map(i => ({
          product_id: i.productId, uom_id: i.uomId,
          quantity: i.qty, price: i.price, size_per_unit: i.spu,
        })),
      };
      const res = await axios.post(`${API}/api/sales/returns/create/`, payload, { withCredentials: true });
      showToast('ok', `Return #${res.data.sales_return_id} saved!`);
      handleReset();
      setTimeout(() => navigate('/sales/returns'), 1500);
    } catch (e) {
      showToast('err', e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false); saveRef.current = false;
    }
  };

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4500); };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white animate-in fade-in duration-200" style={{ fontFamily: "'Google Sans', sans-serif" }}>

      {/* ELITE STICKY HEADER */}
      <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sales/returns')} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-300 text-gray-400 hover:text-primary hover:border-primary/30 transition-all group">
            <ArrowBack className="group-hover:text-primary" sx={{ fontSize: 20 }} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">New Return</h1>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Inventory Inbound</span>
          </div>
        </div>

        <div className="flex justify-center h-full">
          <div className="flex gap-8 h-full items-center">
            {branches.map(b => {
              const active = selectedBranch?.id === b.id;
              return (
                <button key={b.id} onClick={() => { setSelectedBranch(b); setCustomer(null); setCustQuery(''); }}
                  className={`group relative flex items-center gap-2.5 h-16 transition-all`}>
                  <Storefront sx={{ fontSize: 18 }} className={active ? 'text-primary' : 'text-gray-300'} />
                  <span className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-gray-400'}`}>{b.name}</span>
                  {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in zoom-in-y" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 text-[10px] font-black uppercase tracking-widest">
            {toast && <span className={toast.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}>{toast.msg}</span>}
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300">
                <p className="text-[9px] text-gray-400">Return Date</p>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="bg-transparent font-black text-gray-700 outline-none p-0" />
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-gray-50/30">
        {/* LEFT SIDEBAR */}
        <div className="w-80 bg-white border-r border-gray-300 flex flex-col shadow-sm">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-300/60 no-scrollbar">
            
            <div className="p-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">A. Customer Entity</p>
              <div className="relative">
                <input value={custQuery} onChange={e => { setCustQuery(e.target.value); searchCustomers(e.target.value); setCustomer(null); }}
                  onFocus={e => e.target.select()} onBlur={() => setTimeout(() => setCustResults([]), 200)}
                  placeholder="Seach client database…" className="w-full h-11 px-4 bg-gray-50 rounded-xl text-[12px] font-bold outline-none border border-transparent focus:bg-white focus:border-gray-300 shadow-sm" />
                {customer && <button onClick={() => { setCustomer(null); setCustQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-red-50 text-red-400 font-black">×</button>}
                {custResults.length > 0 && (
                  <Dropdown items={custResults} onSelect={p => { setCustomer(p); setCustQuery(p.display_name); setCustResults([]); }}
                    onClose={() => setCustResults([])} renderItem={p => (
                      <div className="flex justify-between items-center py-0.5 text-[12px]">
                        <span className="font-black text-gray-900">{p.display_name}</span>
                        {p.cached_balance !== 0 && <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${p.cached_balance < 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>Rs {fmtK(Math.abs(p.cached_balance))}</span>}
                      </div>
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
          </div>

          <div className="p-4 pt-8 bg-gray-50/30 border-t border-gray-300 space-y-2">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-300 pb-3 mb-4">Return Summary</p>
             <div className="flex justify-between items-center text-[11px] font-black">
               <span className="text-gray-400 uppercase tracking-tighter">Gross Total</span>
               <span className="text-gray-700">Rs {fmtK(subTotal)}</span>
             </div>
             <div className="flex justify-between items-center text-[11px] font-black">
               <span className="text-gray-400 uppercase tracking-tighter">Adjustments</span>
               <span className={(taxAmt - discAmt) < 0 ? 'text-red-500' : 'text-emerald-500'}>Rs {fmtK(taxAmt - discAmt)}</span>
             </div>
             <div className="pt-2 mt-2 border-t border-gray-300 space-y-2 text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Net Payable</p>
                <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">Rs {fmtK(netTotal)}</p>
                <div className="pt-2">
                   <div className="flex justify-between items-center bg-white p-2 border border-gray-300 rounded-xl shadow-inner">
                      <span className="text-[9px] font-black text-gray-400 uppercase">Refund Paid</span>
                      <input type="number" step="any" value={refunded} onChange={e => { setRefunded(e.target.value); refundedManual.current = true; }} className="w-24 text-right bg-transparent border-none outline-none text-[12px] font-black text-gray-900 focus:ring-0 p-0" />
                   </div>
                </div>
                <p className="text-[9px] font-black uppercase text-gray-400 pt-2 tracking-widest border-t border-gray-50 mt-2">Due to customer: {fmtK(balDue)}</p>
             </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Entry Bar */}
          <div className="bg-white border-b border-gray-300 px-8 py-4 shrink-0 shadow-sm z-50">
            <div className="flex gap-4 items-end">
              <div className="flex-none w-48">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Scanner Input</label>
                <input ref={barcodeRef} value={barcodeVal} onChange={e => setBarcodeVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBarcodeEnter()} placeholder="Ready for scan…" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-[12px] font-black outline-none placeholder:text-gray-300" />
              </div>
              <div className="flex-1 relative">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Inventory Search</label>
                <input ref={nameRef} value={nameVal} onChange={e => { setNameVal(e.target.value); setSelectedProduct(null); setActiveUnit(null); searchByName(e.target.value); }} onBlur={() => setTimeout(() => setNameResults([]), 200)} placeholder="Lookup product…" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-[12px] font-black outline-none" />
                {nameResults.length > 0 && <Dropdown items={nameResults} onSelect={selectProduct} onClose={() => setNameResults([])} renderItem={p => (
                  <div className="flex justify-between items-center py-1 text-[12px]">
                    <span className="font-black text-gray-900">{p.name}</span>
                    <span className="font-black text-primary">Rs {fmtK(p.sale_price)}</span>
                  </div>
                )} />}
              </div>
              {selectedProduct && <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-300 shadow-sm">
                {buildUnits(selectedProduct).map(u => {
                  const active = activeUnit?.uomId === u.uomId;
                  return <button key={u.uomId} onClick={() => handleUnitChip(u)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${active ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-white'}`}>{u.label}</button>
                })}
              </div>}
              <div className="flex-none w-24">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Qty</label>
                <input ref={qtyRef} type="number" min="0.001" step="any" value={qtyVal} onChange={e => setQtyVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQtyEnter()} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-[12px] font-black text-right outline-none" />
              </div>
              <div className="flex-none w-32">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Rate</label>
                <input ref={priceRef} type="number" min="0" step="any" value={priceVal} onChange={e => setPriceVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePriceEnter()} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-[12px] font-black text-right outline-none" />
              </div>
              <button disabled={!selectedProduct} onClick={handlePriceEnter} className={`w-12 h-10 rounded-xl flex items-center justify-center transition-all ${selectedProduct ? 'bg-primary text-white shadow-md hover:-translate-y-0.5' : 'bg-gray-100 text-gray-300'}`}><Add sx={{ fontSize: 24 }} /></button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto bg-white">
            {cart.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-200 uppercase tracking-[0.3em] font-black text-[10px]">
                 <AssignmentReturn sx={{ fontSize: 44, mb: 1 }} /> Transaction Empty
               </div>
            ) : (
              <table className="w-full border-collapse divide-y divide-gray-300/60">
                <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-300 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">
                  <tr>
                    <th className="px-5 py-3 w-12">#</th>
                    <th className="px-5 py-3">Product Specifics</th>
                    <th className="px-5 py-3 w-24">Unit</th>
                    <th className="px-5 py-3 w-28 text-right">Qty</th>
                    <th className="px-5 py-3 w-32 text-right">Rate</th>
                    <th className="px-5 py-3 w-36 text-right">Net Total</th>
                    <th className="px-5 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300/60 transition-all">
                  {cart.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-orange-50/20 text-[12px] font-black">
                      <td className="px-5 py-3 text-gray-300 text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="px-5 py-3 text-gray-900">{item.name}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px]">{item.uomCode}</span></td>
                      <td className="px-5 py-3 text-right"><input type="number" step="any" value={item.qty} onChange={e => updateCart(idx, 'qty', e.target.value)} className="w-20 px-3 py-1.5 border border-gray-300 rounded-xl text-right outline-none focus:border-primary/40" /></td>
                      <td className="px-5 py-3 text-right"><input type="number" step="any" value={item.price} onChange={e => updateCart(idx, 'price', e.target.value)} className="w-28 px-3 py-1.5 border border-gray-300 rounded-xl text-right outline-none focus:border-primary/40" /></td>
                      <td className="px-5 py-3 text-right text-indigo-600">Rs {fmtK(item.qty * item.price)}</td>
                      <td className="px-5 py-3 text-center"><button onClick={() => removeFromCart(idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Delete sx={{ fontSize: 18 }} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-white border-t border-gray-300 px-8 py-4 flex items-center gap-6 shadow-sm">
             <div className="flex items-center gap-6 px-6 py-2 bg-gray-50 rounded-2xl border border-gray-200 text-[13px] font-black">
                <div className="flex flex-col">
                   <span className="text-[8px] text-gray-400 uppercase">Tax (%)</span>
                   <input type="number" value={taxPct} onChange={e => setTaxPct(e.target.value)} onFocus={e => e.target.select()} className="bg-transparent border-none outline-none focus:ring-0 p-0 w-12" />
                </div>
                <div className="w-px h-6 bg-gray-300" />
                <div className="flex flex-col">
                   <span className="text-[8px] text-gray-400 uppercase">Disc (%)</span>
                   <input type="number" value={discPct} onChange={e => setDiscPct(e.target.value)} onFocus={e => e.target.select()} className="bg-transparent border-none outline-none focus:ring-0 p-0 w-12" />
                </div>
             </div>
             <div className="flex-1" />
             <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-gray-400 transition-all"><Refresh sx={{ fontSize: 16 }} /> Reset</button>
             <button disabled={saving} onClick={handleSave} className="flex items-center gap-2 px-10 py-3 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all">
                {saving ? 'Saving…' : <><PointOfSale sx={{ fontSize: 16 }} /> Finalize Return</>}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
