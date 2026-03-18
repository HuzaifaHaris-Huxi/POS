import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  QrCodeScanner, Search, PersonOutline, PaymentsOutlined,
  AccountBalanceOutlined, CreditScoreOutlined, Delete,
  ShoppingCart, ReceiptLong, Refresh, ChevronLeft, ChevronRight,
  PointOfSale, ArrowForward, Add, Storefront, ArrowBack
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

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS = {
  open:      { label: 'Open',      cls: 'bg-blue-50 text-blue-600 border-blue-100',    dot: 'bg-blue-400'    },
  partial:   { label: 'Partial',   cls: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-400'   },
  fulfilled: { label: 'Fulfilled', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-400' },
  credit:    { label: 'Credit',    cls: 'bg-orange-50 text-primary border-orange-100', dot: 'bg-primary'     },
};
function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function NewSaleOrder() {
  const navigate = useNavigate();

  // ── Form data ─────────────────────────────────────────────────────────────
  const [branches, setBranches]         = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [orderDate, setOrderDate]           = useState(new Date().toISOString().split('T')[0]);

  // ── Customer ─────────────────────────────────────────────────────────────
  const [custQuery, setCustQuery]     = useState('');
  const [custResults, setCustResults] = useState([]);
  const [customer, setCustomer]       = useState(null);
  const custTimer = useRef(null);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [payMethod, setPayMethod] = useState('cash');
  const [bankAccId, setBankAccId] = useState('');
  const [received, setReceived]   = useState('');
  const receivedManual = useRef(false);

  // ── Product search ────────────────────────────────────────────────────────
  const [barcodeVal, setBarcodeVal]         = useState('');
  const [nameVal, setNameVal]               = useState('');
  const [qtyVal, setQtyVal]                 = useState('1');
  const [priceVal, setPriceVal]             = useState('');
  const [nameResults, setNameResults]       = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  // The active unit for the currently-selected product: { uomId, uomCode, spu, price }
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

  // ── Recent saved invoice IDs for prev/next ─────────────────────────────
  const [recentIds, setRecentIds]   = useState([]);
  const [recentIdx, setRecentIdx]   = useState(-1);

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
    // Load recent IDs from session for nav arrows
    axios.get(`${API}/api/sales/?limit=10`, { withCredentials: true })
      .then(r => setRecentIds((r.data.orders || []).map(o => o.id)))
      .catch(() => {});
    setTimeout(() => barcodeRef.current?.focus(), 200);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed totals
  // ─────────────────────────────────────────────────────────────────────────
  const subTotal  = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const discAmt   = subTotal * toN(discPct) / 100;
  const taxAmt    = (subTotal - discAmt) * toN(taxPct) / 100;
  const netTotal  = subTotal - discAmt + taxAmt;
  const change    = Math.max(0, toN(received) - netTotal);
  const balDue    = Math.max(0, netTotal - toN(received));

  useEffect(() => {
    if (!receivedManual.current) {
      if (payMethod === 'credit') setReceived('0.00');
      else setReceived(fmt(netTotal));
    }
  }, [payMethod, netTotal]);

  const orderStatus = payMethod === 'credit' ? 'credit'
    : toN(received) >= netTotal && netTotal > 0 ? 'fulfilled'
    : toN(received) > 0 ? 'partial' : 'open';

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
  // Build unit options for a product: lower unit + bulk unit (if exists)
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
    const defaultUnit = units[0];                  // lower unit by default
    setSelectedProduct(prod);
    setActiveUnit(defaultUnit);
    setNameVal(prod.name);
    setNameResults([]);
    setPriceVal(fmt(defaultUnit ? defaultUnit.price : prod.sale_price));
    setQtyVal('1');
    qtyRef.current?.focus();
  };

  // Switch unit chip — recalculate price
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
        stockQty: parseFloat(prod.stock_qty || 0),
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
    receivedManual.current = false; setToast(null);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = async (doPrint = false) => {
    if (saving || saveRef.current) return;
    if (!cart.length) { showToast('err', 'Add at least one product.'); return; }
    saveRef.current = true; setSaving(true); setToast(null);
    try {
      const payload = {
        branch_id: selectedBranch?.id ?? null,
        customer_id: customer?.id ?? null,
        order_date: orderDate,
        payment_method: payMethod,
        bank_account_id: payMethod === 'bank' ? bankAccId : null,
        amount_received: toN(received),
        sub_total: subTotal, discount_percent: toN(discPct),
        tax_percent:      toN(taxPct), 
        net_total:        netTotal,
        items: cart.map(i => ({
          product_id: i.productId, uom_id: i.uomId,
          quantity: i.qty, price: i.price, size_per_unit: i.spu,
        })),
      };
      const res = await axios.post(`${API}/api/sales/create/`, payload, { withCredentials: true });
      const newId = res.data.sales_order_id;
      showToast('ok', `Sale #${newId} saved!`);
      setRecentIds(prev => [newId, ...prev.filter(id => id !== newId)]);
      setRecentIdx(0);
      if (doPrint) window.print();
      handleReset();
    } catch (e) {
      showToast('err', e.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false); saveRef.current = false;
    }
  };

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4500); };

  // Prev / Next navigation
  const goToOrder = (idxOffset) => {
    const newIdx = recentIdx + idxOffset;
    if (newIdx < 0 || newIdx >= recentIds.length) return;
    setRecentIdx(newIdx);
    navigate(`/sales/edit/${recentIds[newIdx]}`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white animate-in fade-in duration-200" style={{ fontFamily: "'Google Sans', sans-serif" }}>

      {/* ══════════════ ELITE STICKY HEADER ══════════════ */}
      <div className="bg-white border-b border-gray-300 px-8 h-16 grid grid-cols-3 items-center shrink-0 z-50">
        {/* Left: Identity & Back */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sales/invoices')} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-300 text-gray-400 hover:text-primary hover:border-primary/30 transition-all group">
            <ArrowBack className="group-hover:text-primary transition-colors" sx={{ fontSize: 20 }} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-1">
              New Sale
            </h1>
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none tracking-tighter">Terminal v2.0</span>
            </div>
          </div>
        </div>

        {/* Mid: Branch Tabs */}
        <div className="flex justify-center h-full">
          <div className="flex gap-8 h-full items-center">
            {branches.map(b => {
              const active = selectedBranch?.id === b.id;
              return (
                <button key={b.id} onClick={() => { setSelectedBranch(b); setCustomer(null); setCustQuery(''); }}
                  className={`group relative flex items-center gap-2.5 h-16 transition-all`}>
                  <Storefront sx={{ fontSize: 18 }} className={active ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} />
                  <span className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {b.name}
                  </span>
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in zoom-in-y duration-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Auxiliary Info */}
        <div className="flex items-center justify-end gap-6">
            {toast && (
              <span className={`text-[10px] font-black uppercase tracking-widest ${toast.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
                {toast.msg}
              </span>
            )}
            
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-300 shadow-sm">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Date</p>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} 
                    className="bg-transparent text-[11px] font-black text-gray-700 outline-none border-none focus:ring-0 p-0" />
            </div>

            <div className="flex items-center gap-1.5 border-l border-gray-200 pl-4">
               <button onClick={() => goToOrder(1)} disabled={recentIdx >= recentIds.length - 1 || recentIds.length === 0}
                 className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-400 hover:text-primary disabled:opacity-30 transition-all shadow-sm">
                 <ChevronLeft sx={{ fontSize: 18 }} />
               </button>
               <button onClick={() => goToOrder(-1)} disabled={recentIdx <= 0}
                 className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-400 hover:text-primary disabled:opacity-30 transition-all shadow-sm">
                 <ChevronRight sx={{ fontSize: 18 }} />
               </button>
            </div>
        </div>
      </div>

      {/* ══════════════ MAIN WORKSPACE ══════════════ */}
      <div className="flex-1 flex overflow-hidden bg-gray-50/30">

        {/* ════ LEFT COMPACT SIDEBAR ════ */}
        <div className="w-80 bg-white border-r border-gray-300 flex flex-col overflow-hidden shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.02)]">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-300/60 no-scrollbar transition-all">
            
            {/* A. Customer Selection */}
            <div className="p-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">A. Customer Entity</p>
              <div className="relative group">
                <input value={custQuery}
                  onFocus={e => e.target.select()}
                  onChange={e => { setCustQuery(e.target.value); searchCustomers(e.target.value); setCustomer(null); }}
                  onBlur={() => setTimeout(() => setCustResults([]), 200)}
                  placeholder="Seach client database…"
                  className="w-full h-11 px-4 bg-gray-50 rounded-xl text-[12px] font-bold outline-none border border-transparent focus:bg-white focus:border-gray-300 shadow-sm transition-all placeholder:text-gray-300" />
                {customer ? (
                  <button onClick={() => { setCustomer(null); setCustQuery(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors flex items-center justify-center font-black">×</button>
                ) : (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300">
                    <Search sx={{ fontSize: 18 }} />
                  </div>
                )}
                
                {custResults.length > 0 && (
                  <Dropdown items={custResults}
                    onSelect={p => { setCustomer(p); setCustQuery(p.display_name); setCustResults([]); }}
                    onClose={() => setCustResults([])}
                    renderItem={p => (
                      <div className="flex justify-between items-center py-0.5">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-[12px] tracking-tight">{p.display_name}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest tracking-tighter">{p.phone || 'NO CONTACT'}</span>
                        </div>
                        {p.cached_balance !== 0 && (
                          <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${p.cached_balance < 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            Rs {fmtK(Math.abs(p.cached_balance))} {p.cached_balance < 0 ? 'DR' : 'CR'}
                          </div>
                        )}
                      </div>
                    )} />
                )}
              </div>
              {customer && (
                 <div className="mt-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-300 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">A/C Balance</span>
                    <span className={`text-[12px] font-black ${customer.cached_balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                       Rs {fmtK(Math.abs(customer.cached_balance))} {customer.cached_balance < 0 ? 'DR' : 'CR'}
                    </span>
                 </div>
              )}
            </div>

            {/* B. Settlement Strategy */}
            <div className="p-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">B. Record Status</p>
              <div className="flex gap-2">
                {[
                  { key: 'cash',  label: 'Cash',  Icon: PaymentsOutlined },
                  { key: 'bank',  label: 'Bank',  Icon: AccountBalanceOutlined },
                  { key: 'credit', label: 'Credit', Icon: CreditScoreOutlined },
                ].map(({ key, label, Icon }) => {
                  const active = payMethod === key;
                  return (
                    <button key={key} onClick={() => setPayMethod(key)}
                      className={`flex-1 flex flex-col items-center justify-center gap-2 h-16 rounded-xl border-2 transition-all ${active ? 'border-primary bg-orange-50 text-primary shadow-sm' : 'border-gray-50 bg-gray-50 hover:border-gray-200 text-gray-400'}`}>
                      <Icon sx={{ fontSize: 18 }} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                    </button>
                  );
                })}
              </div>

              {payMethod === 'bank' && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                  <select value={bankAccId} onChange={e => setBankAccId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-[11px] font-black text-gray-700 outline-none focus:border-primary shadow-sm appearance-none cursor-pointer">
                    <option value="">Select Account…</option>
                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>)}
                  </select>
                </div>
              )}
            </div>

          </div>

          {/* Sync Summary (Table Style) */}
          <div className="p-4 pt-8 mt-auto space-y-2 bg-gray-50/30 border-t border-gray-300">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-300 pb-3 mb-4">Sync Summary</p>
             {[
               { l: 'Subtotal', v: subTotal },
               { l: 'Adjustments', v: taxAmt - discAmt, c: (taxAmt - discAmt) < 0 ? 'text-red-500' : 'text-emerald-500' },
             ].map(x => (
               <div key={x.l} className="flex justify-between items-center text-[11px] font-black">
                 <span className="text-gray-400 uppercase tracking-tighter">{x.l}</span>
                 <span className={x.c || 'text-gray-700'}>Rs {fmtK(x.v)}</span>
               </div>
             ))}
             <div className="pt-2 mt-2 border-t border-gray-300 space-y-2 text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Net Total</p>
                <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">Rs {fmtK(netTotal)}</p>
                
                <div className="pt-2 border-t border-gray-300">
                   <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-300 shadow-inner">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Handle Amt</span>
                      <input type="number" step="any" value={received} onChange={e => { setReceived(e.target.value); receivedManual.current = true; }}
                        onFocus={e => e.target.select()}
                        className="w-24 text-right bg-transparent border-none outline-none text-[12px] font-black text-gray-900 focus:ring-0 p-0" />
                   </div>
                </div>

                <div className="flex justify-between text-[9px] font-black uppercase text-gray-400 pt-2 tracking-widest border-t border-gray-50 mt-2">
                   <span>Paid: {fmtK(received)}</span>
                   <span className={balDue > 0.01 ? 'text-red-400' : ''}>Due: {fmtK(balDue)}</span>
                </div>
             </div>
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* 1. Transaction Entry Bar (Elite Quick Row) */}
          <div className="bg-white border-b border-gray-300 px-8 py-4 shrink-0 shadow-sm z-50">
            <div className="flex gap-4 items-end">

              {/* Barcode Interface */}
              <div className="flex-none w-48">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                  <QrCodeScanner sx={{ fontSize: 13 }} className="text-gray-300" /> Scanner Input
                </label>
                <div className="relative group">
                   <input ref={barcodeRef} value={barcodeVal}
                     onChange={e => setBarcodeVal(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleBarcodeEnter()}
                     placeholder="Ready for scan…"
                     className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-[12px] font-black text-gray-700 outline-none focus:border-primary/40 focus:bg-white transition-all placeholder:text-gray-300 shadow-sm" />
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border-2 border-white shadow-sm" />
                </div>
              </div>

              {/* Product Lookup */}
              <div className="flex-1 relative">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                  <Search sx={{ fontSize: 13 }} className="text-gray-300" /> Inventory Search
                </label>
                <div className="relative">
                   <input ref={nameRef} value={nameVal}
                     onChange={e => { setNameVal(e.target.value); setSelectedProduct(null); setActiveUnit(null); searchByName(e.target.value); }}
                     onBlur={() => setTimeout(() => setNameResults([]), 200)}
                     placeholder="Lookup by name or SKU…"
                     className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-[12px] font-black text-gray-700 outline-none focus:border-primary/40 focus:bg-white transition-all placeholder:text-gray-300 shadow-sm" />
                   {nameResults.length > 0 && (
                     <Dropdown items={nameResults}
                       onSelect={selectProduct}
                       onClose={() => setNameResults([])}
                       renderItem={p => {
                         const u = buildUnits(p);
                         return (
                           <div className="flex justify-between items-center py-1">
                             <div className="flex flex-col">
                               <span className="font-black text-gray-900 text-[12px] tracking-tight">{p.name}</span>
                               <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                 SOH: {parseFloat(p.stock_qty || 0).toFixed(2)} {p.uom_code}
                               </span>
                             </div>
                             <div className="text-right flex flex-col items-end">
                               <span className="font-black text-primary text-[12px]">Rs {fmtK(p.sale_price)}</span>
                               <span className="text-[8px] text-gray-300 font-bold uppercase">{p.uom_code} UNIT</span>
                             </div>
                           </div>
                         );
                       }} />
                   )}
                </div>
              </div>

              {/* Unit Selection */}
              {selectedProduct && (
                <div className="flex-none animate-in fade-in slide-in-from-bottom-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">UOM</label>
                  <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-300 shadow-sm">
                    {buildUnits(selectedProduct).map(u => {
                      const active = activeUnit?.uomId === u.uomId;
                      return (
                        <button key={u.uomId} onClick={() => handleUnitChip(u)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${active ? 'bg-primary text-white shadow-md scale-105' : 'text-gray-400 hover:bg-white hover:text-gray-600'}`}>
                          {u.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex-none w-24">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Qty</label>
                <input ref={qtyRef} type="number" min="0.001" step="any" value={qtyVal}
                  onFocus={e => e.target.select()}
                  onChange={e => setQtyVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQtyEnter()}
                  disabled={!selectedProduct}
                  className={`w-full px-4 py-2.5 rounded-xl border text-[12px] font-black text-right outline-none transition-all shadow-sm ${selectedProduct ? 'border-gray-300 bg-white focus:border-primary/40' : 'border-gray-200 bg-gray-50 text-gray-300'}`} />
              </div>

              {/* Sale Price */}
              <div className="flex-none w-32">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">Unit Rate</label>
                <input ref={priceRef} type="number" min="0" step="any" value={priceVal}
                  onFocus={e => e.target.select()}
                  onChange={e => setPriceVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePriceEnter()}
                  disabled={!selectedProduct}
                  placeholder="0.00"
                  className={`w-full px-4 py-2.5 rounded-xl border text-[12px] font-black text-right outline-none transition-all shadow-sm ${selectedProduct ? 'border-gray-300 bg-white focus:border-primary/40' : 'border-gray-200 bg-gray-50 text-gray-300'}`} />
              </div>

              {/* Commit Button */}
              <div className="flex-none">
                <button disabled={!selectedProduct} onClick={handlePriceEnter}
                  className={`w-12 h-10 rounded-xl flex items-center justify-center transition-all ${selectedProduct ? 'bg-primary text-white shadow-[0_10px_20px_rgba(249,115,22,0.2)] hover:shadow-glow hover:-translate-y-0.5' : 'bg-gray-100 text-gray-300'}`}>
                  <Add sx={{ fontSize: 24 }} />
                </button>
              </div>
            </div>

            {/* Selection Meta Preview */}
            {selectedProduct && activeUnit && (
              <div className="mt-4 flex items-center gap-6 px-4 py-2 bg-orange-50/50 rounded-xl border border-orange-100 animate-in slide-in-from-left-4 duration-300">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <span className="text-[11px] font-black text-gray-900">{selectedProduct.name}</span>
                </div>
                <div className="h-3 w-px bg-orange-200" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Standard Rate: <strong className="text-primary ml-1">Rs {fmtK(activeUnit.price)}</strong>
                </span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Stock Position: <strong className="text-gray-900 ml-1">{parseFloat(selectedProduct.stock_qty || 0).toFixed(2)} {selectedProduct.uom_code}</strong>
                </span>
              </div>
            )}
          </div>

          {/* 2. Line Items Table (High Contrast) */}
          <div className="flex-1 overflow-y-auto bg-white">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-200">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                   <ShoppingCart sx={{ fontSize: 44 }} />
                </div>
                <div className="text-center">
                  <p className="font-black text-[12px] uppercase tracking-[0.3em] text-gray-300">Transaction Empty</p>
                  <p className="text-[11px] text-gray-400 font-bold mt-1">Awaiting product entry to initialize ledger.</p>
                </div>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-300 shadow-sm">
                  <tr>
                    {[
                      { l: '#', w: 'w-12', a: 'left' },
                      { l: 'Product Specifics', w: '', a: 'left' },
                      { l: 'Unit', w: 'w-24', a: 'left' },
                      { l: 'Quantity', w: 'w-28', a: 'right' },
                      { l: 'Unit Rate', w: 'w-32', a: 'right' },
                      { l: 'Net Line Total', w: 'w-36', a: 'right' },
                      { l: '', w: 'w-12', a: 'center' },
                    ].map((h, i) => (
                      <th key={i} className={`px-5 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest ${h.w}`} style={{ textAlign: h.a }}>{h.l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300/60">
                  {cart.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-orange-50/20 transition-all duration-150">
                      <td className="px-5 py-3 text-gray-300 font-black text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="px-5 py-3">
                        <div className="font-black text-gray-900 text-[12px] tracking-tight">{item.name}</div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{item.sku || 'N/A SKU'}</div>
                      </td>
                      <td className="px-5 py-3 text-left">
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-black uppercase tracking-tighter">{item.uomCode}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <input type="number" min="0.001" step="any" value={item.qty}
                          onFocus={e => e.target.select()}
                          onChange={e => updateCart(idx, 'qty', e.target.value)}
                          className="w-20 px-3 py-1.5 border border-gray-300 rounded-xl bg-white text-[12px] font-black text-right outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <input type="number" min="0" step="any" value={item.price}
                          onFocus={e => e.target.select()}
                          onChange={e => updateCart(idx, 'price', e.target.value)}
                          className="w-28 px-3 py-1.5 border border-gray-300 rounded-xl bg-white text-[12px] font-black text-right outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" />
                      </td>
                      <td className="px-5 py-3 text-right font-black text-indigo-600 text-[13px] tracking-tighter">
                        Rs {fmtK(item.qty * item.price)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => removeFromCart(idx)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-500 hover:border-red-200 border border-transparent transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                          <Delete sx={{ fontSize: 18 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 3. Sticky Action Bar (Footer) */}
          <div className="bg-white border-t border-gray-300 px-8 py-4 flex items-center gap-6 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            
            {/* Payment Input */}
            <div className="flex items-center gap-4">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Liquid Received</span>
                  <div className="relative">
                    <input type="number" min="0" step="any" value={received}
                      onFocus={e => e.target.select()}
                      onChange={e => { receivedManual.current = true; setReceived(e.target.value); }}
                      disabled={payMethod === 'credit'}
                      className={`w-44 px-4 py-3 border rounded-xl text-[16px] font-black text-right outline-none transition-all shadow-sm ${payMethod === 'credit' ? 'border-gray-200 bg-gray-50 text-gray-300' : 'border-primary/30 bg-orange-50/30 text-gray-900 focus:border-primary/60 focus:bg-white'}`} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 uppercase">Rs</span>
                  </div>
               </div>
               
               {/* Adjustments (Tax & Disc) */}
               <div className="flex items-center gap-6 px-6 py-2 bg-gray-50 rounded-2xl border border-gray-200">
                   <div className="flex flex-col">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Tax (%)</span>
                       <input type="number" value={taxPct} onChange={e => setTaxPct(e.target.value)}
                           onFocus={e => e.target.select()}
                           className="bg-transparent border-none outline-none text-[13px] font-black text-gray-900 focus:ring-0 p-0 w-12" />
                   </div>
                   <div className="w-px h-6 bg-gray-300" />
                   <div className="flex flex-col">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Disc (%)</span>
                       <input type="number" value={discPct} onChange={e => setDiscPct(e.target.value)}
                           onFocus={e => e.target.select()}
                           className="bg-transparent border-none outline-none text-[13px] font-black text-gray-900 focus:ring-0 p-0 w-12" />
                   </div>
               </div>

               {/* Quick Summary in Footer */}
               <div className="flex items-center gap-6 px-6 py-2 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="flex flex-col">
                     <span className="text-[8px] font-black text-gray-400 uppercase">Remaining</span>
                     <span className={`text-[14px] font-black tracking-tighter ${balDue > 0 ? 'text-red-500' : 'text-gray-300'}`}>Rs {fmtK(balDue)}</span>
                  </div>
                  <div className="w-px h-6 bg-gray-300" />
                  <div className="flex flex-col">
                     <span className="text-[8px] font-black text-gray-400 uppercase">Change</span>
                     <span className={`text-[14px] font-black tracking-tighter ${change > 0 ? 'text-emerald-500' : 'text-gray-300'}`}>Rs {fmtK(change)}</span>
                  </div>
               </div>
            </div>

            <div className="flex-1" />

            {/* Final Actions */}
            <div className="flex items-center gap-3">
              <button onClick={handleReset}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-300 text-[10px] font-black text-gray-400 hover:text-gray-600 hover:border-gray-400 uppercase tracking-widest transition-all">
                <Refresh sx={{ fontSize: 16 }} /> Reset Form
              </button>

              <button disabled={saving} onClick={() => handleSave(true)}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${saving ? 'bg-gray-50 text-gray-300 border-gray-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100/50 shadow-sm'}`}>
                <ReceiptLong sx={{ fontSize: 18 }} /> Print & Save
              </button>

              <button disabled={saving} onClick={() => handleSave(false)}
                className={`flex items-center gap-3 px-8 py-3 rounded-xl text-white text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${saving ? 'bg-gray-400' : 'bg-primary shadow-[0_10px_25px_rgba(249,115,22,0.3)] hover:shadow-[0_15px_35px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:translate-y-0'}`}>
                {saving ? 'Processing…' : 'Finalize Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
