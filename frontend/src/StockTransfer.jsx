import React, { useState, useEffect, useRef } from 'react';
import { SyncAlt, AddCircle, Delete } from '@mui/icons-material';
import { Tooltip, IconButton, CircularProgress } from '@mui/material';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:8000';

export default function StockTransfer() {
  const [locations, setLocations] = useState({ branches: [], warehouses: [] });
  const [sourceType, setSourceType] = useState('branch');
  const [sourceId, setSourceId] = useState('');
  const [destType, setDestType] = useState('warehouse');
  const [destId, setDestId] = useState('');
  const [reference, setReference] = useState('');
  const [items, setItems] = useState([]);
  
  // Product Search State
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState('');
  const [availableStock, setAvailableStock] = useState(null);
  const [checkingStock, setCheckingStock] = useState(false);
  const [availableStockUom, setAvailableStockUom] = useState("");
  const [focusedSearchIndex, setFocusedSearchIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchLocations();
    fetchProducts();
  }, []);

  const fetchLocations = async () => {
    try {
      const [bRes, wRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/dashboard-data/`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/warehouses/?limit=1000`, { withCredentials: true })
      ]);
      setLocations({
        branches: bRes.data.branches || [],
        warehouses: wRes.data.warehouses || []
      });
    } catch (err) {
      console.error("Failed to fetch locations", err);
      setError("Failed to load branches and warehouses.");
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/products/?limit=1000`, { withCredentials: true });
      const prods = res.data.products || res.data || [];
      setProducts(prods);
    } catch (err) {
      console.error("Failed to fetch products", err);
    }
  };

  const handleProductSearch = (e) => {
    const val = e.target.value;
    setProductSearch(val);
    if (!val.trim()) {
      setProductSearchResults([]);
      return;
    }
    const lower = val.toLowerCase();
    
    // Filter out products from OTHER branches if a branch is selected as source
    const hits = products.filter(p => {
      // Must match search term
      const matchesSearch = p.name.toLowerCase().includes(lower) || 
                            (p.sku && p.sku.toLowerCase().includes(lower)) ||
                            (p.barcode && p.barcode.toLowerCase().includes(lower));
      
      // If source is a branch, only show products for this branch (or global products where branch_id is null)
      const matchesBranch = sourceType === 'branch' ? (!p.branch_id || p.branch_id == sourceId) : true;
      
      return matchesSearch && matchesBranch;
    }).slice(0, 10);
    
    setProductSearchResults(hits);
    setFocusedSearchIndex(-1);
  };

  const handleKeyDownSearch = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (focusedSearchIndex < productSearchResults.length - 1) {
        setFocusedSearchIndex(prev => prev + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focusedSearchIndex > 0) {
        setFocusedSearchIndex(prev => prev - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSearchIndex >= 0 && focusedSearchIndex < productSearchResults.length) {
        selectProduct(productSearchResults[focusedSearchIndex]);
      } else if (productSearchResults.length === 1) {
        selectProduct(productSearchResults[0]);
      }
    }
  };

  const handleKeyDownQuantity = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const selectProduct = async (p) => {
    if (!sourceId) {
      alert("Please select Source (From) location first to check available stock.");
      return;
    }
    setSelectedProduct(p);
    setProductSearch(`${p.name} (${p.sku || p.barcode || 'N/A'})`);
    setProductSearchResults([]);
    setQuantityToAdd('');
    setAvailableStock(null);
    setAvailableStockUom("");
    
    setCheckingStock(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/warehouses/stock-check/?source_type=${sourceType}&source_id=${sourceId}&product_id=${p.id}`, { withCredentials: true });
      setAvailableStock(parseFloat(res.data.available_quantity || 0));
      setAvailableStockUom(res.data.uom || p.uom_code || "");
    } catch (err) {
      console.error("Failed to check stock", err);
      setAvailableStock(0);
      setAvailableStockUom(p.uom_code || "");
    }
    setCheckingStock(false);
    
    setTimeout(() => {
        if (quantityInputRef.current) quantityInputRef.current.focus();
    }, 50);
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      alert("Please select a product.");
      return;
    }
    const qty = parseFloat(quantityToAdd);
    if (!qty || qty <= 0) {
      alert("Please enter a positive quantity.");
      return;
    }
    
    // Find if already added to check total quantity
    const exists = items.find(i => i.product_id === selectedProduct.id);
    const currentlyAdded = exists ? exists.quantity : 0;
    
    if (qty + currentlyAdded > availableStock) {
      alert(`Cannot transfer more than available stock. Available: ${availableStock}, Already added: ${currentlyAdded}`);
      return;
    }

    if (exists) {
      setItems(items.map(i => 
        i.product_id === selectedProduct.id 
        ? { ...i, quantity: i.quantity + qty } 
        : i
      ));
    } else {
      setItems([...items, { 
        product_id: selectedProduct.id, 
        name: selectedProduct.name, 
        code: selectedProduct.sku || selectedProduct.barcode,
        quantity: qty,
        uom: selectedProduct.uom_code || ""
      }]);
    }

    setSelectedProduct(null);
    setProductSearch('');
    setQuantityToAdd('');
    setAvailableStock(null);
    setAvailableStockUom('');
    setFocusedSearchIndex(-1);
    
    setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
    }, 50);
  };

  const handleRemoveItem = (productId) => {
    setItems(items.filter(i => i.product_id !== productId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!sourceId || !destId) {
       setError("Please select both source and destination locations.");
       return;
    }
    
    // Validate same source and destination
    if (sourceType === destType && sourceId === destId) {
       setError("Source and Destination cannot be the same location.");
       return;
    }

    if (items.length === 0) {
      setError("Please add at least one product to transfer.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        source_type: sourceType,
        source_id: sourceId,
        dest_type: destType,
        dest_id: destId,
        reference: reference,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
      };

      await axios.post(`${BACKEND_URL}/api/warehouses/transfer/`, payload, { withCredentials: true });
      
      setSuccessMsg("Stock transfer completed successfully.");
      setItems([]);
      setReference('');
      setSourceId('');
      setDestId('');
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to process transfer.");
    } finally {
      setLoading(false);
    }
  };

  const renderLocationOptions = (type) => {
    const list = type === 'branch' ? locations.branches : locations.warehouses;
    return list.map(loc => (
      <option key={loc.id} value={loc.id}>{loc.name}</option>
    ));
  };

  return (
    <div className="flex flex-col h-full bg-white lowercase text-sm">
      <div className="w-full h-full flex flex-col px-6 pb-6 pt-2">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 mb-6 border-b border-gray-50 pb-6">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <SyncAlt />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight capitalize">Stock Transfer</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Move Inventory Between Locations</p>
          </div>
        </div>

        {error && <div className="p-4 mb-6 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">{error}</div>}
        {successMsg && <div className="p-4 mb-6 bg-emerald-50 text-emerald-500 rounded-xl font-bold text-xs">{successMsg}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
            
          {/* Left Column - Details */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col space-y-6 overflow-y-auto pr-2 pb-4 pt-1 custom-scrollbar">
              
              {/* Source */}
              <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-gray-900 capitalize flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-rose-400"></span> Source (From)
                  </h3>
                  
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                      <select
                          value={sourceType}
                          onChange={(e) => { 
                            setSourceType(e.target.value); 
                            setSourceId(''); 
                            setSelectedProduct(null);
                            setProductSearch('');
                            setAvailableStock(null);
                            setAvailableStockUom('');
                            setItems([]);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                      >
                          <option value="branch">Branch</option>
                          <option value="warehouse">Warehouse</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location</label>
                      <select
                          value={sourceId}
                          onChange={(e) => {
                            setSourceId(e.target.value);
                            setSelectedProduct(null);
                            setProductSearch('');
                            setAvailableStock(null);
                            setAvailableStockUom('');
                            setItems([]);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                      >
                          <option value="" disabled>Select Location</option>
                          {renderLocationOptions(sourceType)}
                      </select>
                  </div>
              </div>

              {/* Destination */}
              <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-gray-900 capitalize flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Destination (To)
                  </h3>
                  
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                      <select
                          value={destType}
                          onChange={(e) => { setDestType(e.target.value); setDestId(''); }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                      >
                          <option value="branch">Branch</option>
                          <option value="warehouse">Warehouse</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location</label>
                      <select
                          value={destId}
                          onChange={(e) => setDestId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 bg-white"
                      >
                          <option value="" disabled>Select Location</option>
                          {renderLocationOptions(destType)}
                      </select>
                  </div>
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Reference / Notes</label>
                  <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Optional details..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300"
                  />
              </div>

          </div>

          {/* Right Column - Items */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0">
              <div className="h-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col p-1 border-t flex-1 overflow-hidden">
                  
                  {/* Adder Bar */}
                  <div className="p-4 border-b border-gray-50 flex gap-3 relative">
                      <div className="flex-1 relative">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={productSearch}
                            onChange={handleProductSearch}
                            onKeyDown={handleKeyDownSearch}
                            disabled={!sourceId}
                            placeholder={sourceId ? "Search Product by Name or SKU..." : "Select Source Location first..."}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        />
                        {productSearchResults.length > 0 && (
                            <div className="absolute top-12 left-0 right-0 bg-white border border-gray-100 shadow-premium rounded-xl z-50 overflow-hidden">
                                {productSearchResults.map((p, index) => (
                                    <div 
                                      key={p.id}
                                      onClick={() => selectProduct(p)}
                                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer font-bold text-gray-700 capitalize border-b border-gray-50 last:border-0 ${index === focusedSearchIndex ? 'bg-gray-50' : ''}`}
                                    >
                                        {p.name} <span className="text-gray-400 uppercase text-xs ml-2">({p.sku || p.barcode || 'N/A'})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                      </div>
                      
                      <div className="w-48 relative">
                          <input
                            ref={quantityInputRef}
                            type="number"
                            value={quantityToAdd}
                            onChange={(e) => setQuantityToAdd(e.target.value)}
                            onKeyDown={handleKeyDownQuantity}
                            disabled={!selectedProduct || checkingStock}
                            placeholder="Qty"
                            min="0.01" step="0.01"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700 text-center placeholder:text-gray-300 placeholder:text-left disabled:bg-gray-50 disabled:cursor-not-allowed"
                          />
                          {checkingStock && (
                            <div className="absolute -bottom-6 left-0 right-0 text-center text-[11px] text-gray-400 font-bold z-20">Checking...</div>
                          )}
                          {!checkingStock && availableStock !== null && (
                            <div className="absolute -bottom-6 left-0 right-0 text-center text-[11px] font-black tracking-wider text-emerald-600 z-20">
                                AV: {availableStock} {availableStockUom}
                            </div>
                          )}
                      </div>

                      <button 
                        type="button"
                        onClick={handleAddItem}
                        className="px-5 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs hover:bg-zinc-800 transition-all flex items-center justify-center shadow-sm"
                      >
                         <AddCircle sx={{ fontSize: 20 }} />
                      </button>
                  </div>

                  {/* List */}
                  <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur w-1/2">Product</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur">Code</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-right">Qty</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/80 backdrop-blur text-center w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-12 text-center text-gray-400 font-bold">
                                        No items added to transfer.
                                    </td>
                                </tr>
                            ) : items.map(item => (
                                <tr key={item.product_id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-3 font-bold text-gray-900 capitalize text-sm">{item.name}</td>
                                    <td className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">{item.code || '—'}</td>
                                    <td className="px-6 py-3 font-black text-gray-700 text-right text-sm">
                                        {item.quantity} <span className="text-[10px] text-gray-400 font-bold ml-1">{item.uom}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <Tooltip title="Remove" arrow>
                                            <IconButton onClick={() => handleRemoveItem(item.product_id)} size="small" sx={{ color: '#EF4444', '&:hover': { background: '#FEE2E2' } }}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>

                  {/* Footer Submit */}
                  <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                      <button 
                         onClick={handleSubmit}
                         disabled={loading || items.length === 0}
                         className="px-8 py-3 bg-primary text-white rounded-xl font-black tracking-wide text-sm hover:bg-primary-light transition-all active:scale-[0.98] shadow-premium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                         {loading ? <CircularProgress size={20} color="inherit" /> : 'Confirm Transfer'}
                      </button>
                  </div>
                  
              </div>
          </div>
        </div>

      </div>
    </div>
  );
}
