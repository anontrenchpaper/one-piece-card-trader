import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  Search, 
  Download, 
  DollarSign, 
  ExternalLink, 
  Layers, 
  AlertCircle, 
  RefreshCw, 
  Sparkles,
  CreditCard,
  Plus,
  Trash2,
  X,
  SkipForward,
  Edit3,
  RotateCcw,
  FileSpreadsheet,
  Filter,
  TrendingUp,
  Cpu,
  Lock
} from 'lucide-react';

import AuthGuard from './components/AuthGuard';
import { searchCardClientSide } from './services/tcgplayer';
import { AUTH_CONFIG } from './config/auth';

const LOCAL_API_BASE = "http://localhost:8000/api";
const CACHE_RESULTS_KEY = "tcg_priced_cards_cache_v3";
const CACHE_QUEUE_KEY = "tcg_card_queue_cache_v3";
const CACHE_EXCHANGE_KEY = "tcg_exchange_rate_cache_v3";

function MainDashboard() {
  const [exchangeRate, setExchangeRate] = useState(() => {
    const saved = localStorage.getItem(CACHE_EXCHANGE_KEY);
    return saved ? parseFloat(saved) : 1.52;
  });
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [manualRateInput, setManualRateInput] = useState(exchangeRate.toString());

  // Engine Mode: 'client' (Default for GitHub Pages) vs 'backend' (Local Python Proxy)
  const [useBackendProxy, setUseBackendProxy] = useState(false);

  const [onePieceOnly, setOnePieceOnly] = useState(true);

  const [cardInputs, setCardInputs] = useState(() => {
    try {
      const saved = localStorage.getItem(CACHE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [manualCodeInput, setManualCodeInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  
  const [pendingVariants, setPendingVariants] = useState(null); 

  const [selectedResults, setSelectedResults] = useState(() => {
    try {
      const saved = localStorage.getItem(CACHE_RESULTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [editingRowIndex, setEditingRowIndex] = useState(null);

  useEffect(() => {
    localStorage.setItem(CACHE_RESULTS_KEY, JSON.stringify(selectedResults));
  }, [selectedResults]);

  useEffect(() => {
    localStorage.setItem(CACHE_QUEUE_KEY, JSON.stringify(cardInputs));
  }, [cardInputs]);

  useEffect(() => {
    localStorage.setItem(CACHE_EXCHANGE_KEY, manualRateInput);
  }, [manualRateInput]);

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    setExchangeRateLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data.rates?.AUD) {
          const rate = roundDec(data.rates.AUD, 4);
          setExchangeRate(rate);
          setManualRateInput(rate.toString());
        }
      }
    } catch (err) {
      console.warn("Could not fetch live exchange rate, using cached rate:", err);
    } finally {
      setExchangeRateLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage("Parsing uploaded CSV file...");
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) return;

      const rows = lines.map(line => line.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
      const firstRow = rows[0];

      let cardColIdx = 0;
      for (let idx = 0; idx < firstRow.length; idx++) {
        const colLower = firstRow[idx].toLowerCase();
        if (["card", "number", "code", "id", "uid", "sku"].some(k => colLower.includes(k))) {
          cardColIdx = idx;
          break;
        }
      }

      const startRow = ["card", "number", "code", "id", "uid"].some(k => firstRow[cardColIdx].toLowerCase().includes(k)) ? 1 : 0;
      const extractedCodes = [];

      for (let i = startRow; i < rows.length; i++) {
        if (rows[i][cardColIdx]) {
          const val = rows[i][cardColIdx].trim();
          if (val && !extractedCodes.includes(val)) {
            extractedCodes.push(val);
          }
        }
      }

      const newQueue = Array.from(new Set([...cardInputs, ...extractedCodes]));
      setCardInputs(newQueue);
      setStatusMessage(`Loaded ${extractedCodes.length} card numbers from CSV (Total queued: ${newQueue.length}).`);
    } catch (err) {
      setStatusMessage("Failed to parse CSV file.");
    }
  };

  const addManualCode = () => {
    const trimmed = manualCodeInput.trim();
    if (!trimmed) return;
    if (!cardInputs.includes(trimmed)) {
      setCardInputs([...cardInputs, trimmed]);
    }
    setManualCodeInput("");
  };

  const removeCardCode = (code) => {
    setCardInputs(cardInputs.filter(c => c !== code));
  };

  const clearAllSavedData = () => {
    if (window.confirm("Are you sure you want to clear all queued cards and saved pricing results?")) {
      setSelectedResults([]);
      setCardInputs([]);
      localStorage.removeItem(CACHE_RESULTS_KEY);
      localStorage.removeItem(CACHE_QUEUE_KEY);
      setStatusMessage("Cleared cached data.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
    window.location.reload();
  };

  const searchCard = async (code) => {
    if (useBackendProxy) {
      // Dev Proxy Mode (Local Python FastAPI)
      const res = await fetch(`${LOCAL_API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNumber: code, onePieceOnly }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.variants || [];
      }
      throw new Error("Backend server error");
    } else {
      // Standalone Client-Side Direct Engine (GitHub Pages Default)
      return await searchCardClientSide(code, onePieceOnly);
    }
  };

  const startPricingProcess = async () => {
    if (cardInputs.length === 0) return;
    setIsProcessing(true);

    const existingCodes = selectedResults.map(r => r.cardNumber);
    const unpricedCodes = cardInputs.filter(c => !existingCodes.includes(c));

    const queueToRun = unpricedCodes.length > 0 ? unpricedCodes : cardInputs;
    await processQueue(queueToRun);
  };

  const processQueue = async (remainingCodes) => {
    for (let idx = 0; idx < remainingCodes.length; idx++) {
      const code = remainingCodes[idx];
      setStatusMessage(`Searching TCGPlayer (${idx + 1}/${remainingCodes.length}): ${code}...`);
      
      try {
        const variants = await searchCard(code);

        if (variants.length === 0) {
          setSelectedResults(prev => [...prev, {
            cardNumber: code,
            productName: "Not Found on TCGPlayer",
            setName: "N/A",
            number: code,
            marketPriceUSD: null,
            recentSalesUSD: [],
            averageRecentSalesUSD: null,
            imageUrl: "",
            productUrl: `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(code)}`,
            status: "Not Found",
            allVariants: []
          }]);
        } else if (variants.length === 1) {
          setSelectedResults(prev => [...prev, {
            ...variants[0],
            cardNumber: code,
            status: "Exact Match",
            allVariants: variants
          }]);
        } else {
          const rest = remainingCodes.slice(idx + 1);
          setPendingVariants({ 
            cardNumber: code, 
            variants, 
            remainingQueue: rest 
          });
          setIsProcessing(false);
          return;
        }
      } catch (err) {
        console.error(`Error searching ${code}:`, err);
      }
    }

    setIsProcessing(false);
    setPendingVariants(null);
    setStatusMessage("Pricing complete! Selections & 3-sale averages saved.");
  };

  const handleSelectVariant = (selectedVariant) => {
    const isEditing = editingRowIndex !== null;

    if (isEditing) {
      setSelectedResults(prev => {
        const updated = [...prev];
        updated[editingRowIndex] = {
          ...selectedVariant,
          cardNumber: pendingVariants.cardNumber,
          status: "User Selected",
          allVariants: pendingVariants.variants
        };
        return updated;
      });
      setEditingRowIndex(null);
      setPendingVariants(null);
    } else {
      setSelectedResults(prev => [...prev, {
        ...selectedVariant,
        cardNumber: pendingVariants.cardNumber,
        status: "User Selected",
        allVariants: pendingVariants.variants
      }]);

      const rest = pendingVariants.remainingQueue || [];
      setPendingVariants(null);

      if (rest.length > 0) {
        setIsProcessing(true);
        processQueue(rest);
      } else {
        setIsProcessing(false);
        setStatusMessage("Pricing complete!");
      }
    }
  };

  const handleSkipVariant = () => {
    if (editingRowIndex !== null) {
      setEditingRowIndex(null);
      setPendingVariants(null);
      return;
    }

    const code = pendingVariants.cardNumber;
    setSelectedResults(prev => [...prev, {
      cardNumber: code,
      productName: "Skipped by User",
      setName: "Multiple Variants Available",
      number: code,
      marketPriceUSD: null,
      recentSalesUSD: [],
      averageRecentSalesUSD: null,
      imageUrl: pendingVariants.variants[0]?.imageUrl || "",
      productUrl: `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(code)}`,
      status: "Skipped",
      allVariants: pendingVariants.variants
    }]);

    const rest = pendingVariants.remainingQueue || [];
    setPendingVariants(null);

    if (rest.length > 0) {
      setIsProcessing(true);
      processQueue(rest);
    } else {
      setIsProcessing(false);
      setStatusMessage("Selection finished.");
    }
  };

  const handleCloseModal = () => {
    setPendingVariants(null);
    setEditingRowIndex(null);
    setIsProcessing(false);
    setStatusMessage("Variant selection paused.");
  };

  const handleReopenVariantPicker = async (rowIndex, item) => {
    if (item.allVariants && item.allVariants.length > 0) {
      setEditingRowIndex(rowIndex);
      setPendingVariants({
        cardNumber: item.cardNumber,
        variants: item.allVariants,
        remainingQueue: []
      });
    } else {
      setStatusMessage(`Fetching options for ${item.cardNumber}...`);
      try {
        const variants = await searchCard(item.cardNumber);
        if (variants.length > 0) {
          setEditingRowIndex(rowIndex);
          setPendingVariants({
            cardNumber: item.cardNumber,
            variants,
            remainingQueue: []
          });
        } else {
          alert(`No variants found on TCGPlayer for ${item.cardNumber}.`);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const exportToCSV = () => {
    if (selectedResults.length === 0) return;

    const rate = parseFloat(manualRateInput) || exchangeRate;
    const headers = [
      "Card Number", 
      "Product Name", 
      "Set Name", 
      "TCG Number", 
      "Rarity", 
      "Market Price (USD)", 
      "Market Price (AUD)",
      "Recent Sale 1 (USD)",
      "Recent Sale 2 (USD)",
      "Recent Sale 3 (USD)",
      "3-Sale Average (USD)",
      "3-Sale Average (AUD)",
      "Status", 
      "TCGPlayer Link"
    ];
    
    const csvRows = [headers.join(",")];

    selectedResults.forEach(item => {
      const priceUSD = item.marketPriceUSD !== null && item.marketPriceUSD !== undefined ? item.marketPriceUSD.toFixed(2) : "N/A";
      const priceAUD = item.marketPriceUSD !== null && item.marketPriceUSD !== undefined ? (item.marketPriceUSD * rate).toFixed(2) : "N/A";

      const sales = item.recentSalesUSD || [];
      const s1 = sales[0] !== undefined ? `$${sales[0].toFixed(2)}` : "N/A";
      const s2 = sales[1] !== undefined ? `$${sales[1].toFixed(2)}` : "N/A";
      const s3 = sales[2] !== undefined ? `$${sales[2].toFixed(2)}` : "N/A";

      const avgUSD = item.averageRecentSalesUSD !== null && item.averageRecentSalesUSD !== undefined ? item.averageRecentSalesUSD.toFixed(2) : "N/A";
      const avgAUD = item.averageRecentSalesUSD !== null && item.averageRecentSalesUSD !== undefined ? (item.averageRecentSalesUSD * rate).toFixed(2) : "N/A";

      const row = [
        `"${item.cardNumber}"`,
        `"${item.productName.replace(/"/g, '""')}"`,
        `"${item.setName.replace(/"/g, '""')}"`,
        `"${item.number || ''}"`,
        `"${item.rarity || ''}"`,
        `"$${priceUSD}"`,
        `"$${priceAUD}"`,
        `"${s1}"`,
        `"${s2}"`,
        `"${s3}"`,
        `"$${avgUSD}"`,
        `"$${avgAUD}"`,
        `"${item.status || ''}"`,
        `"${item.productUrl || ''}"`
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `tcg_card_prices_3sales_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rateNum = parseFloat(manualRateInput) || exchangeRate;

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '32px 20px' }}>
      
      {/* Top Navbar Header */}
      <header className="glass-panel" style={{ padding: '20px 28px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'var(--primary-gradient)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>
              TCG Card <span className="gradient-text">Pricing Automation</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Market Prices + 3 Most Recent Purchase Sales & Average (USD & AUD)
            </p>
          </div>
        </div>

        {/* Engine Toggle & Currency Widgets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Dev Proxy Mode Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: useBackendProxy ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)', padding: '8px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }} title="Toggle between Standalone Client Engine (GH Pages) and Local Python Backend Proxy">
            <Cpu size={15} color={useBackendProxy ? "var(--primary-accent)" : "var(--text-dim)"} />
            <span>{useBackendProxy ? "Mode: Python Proxy (Local)" : "Mode: Standalone Client"}</span>
            <input 
              type="checkbox" 
              checked={useBackendProxy} 
              onChange={(e) => setUseBackendProxy(e.target.checked)} 
              style={{ accentColor: 'var(--primary-accent)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </label>

          {/* One Piece Only Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.04)', padding: '8px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
            <Filter size={15} color="var(--primary-accent)" />
            <span>One Piece TCG Only</span>
            <input 
              type="checkbox" 
              checked={onePieceOnly} 
              onChange={(e) => setOnePieceOnly(e.target.checked)} 
              style={{ accentColor: 'var(--primary-accent)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </label>

          {/* USD -> AUD Currency Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.04)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <DollarSign size={18} color="var(--primary-accent)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>1 USD = </span>
            <input 
              type="number" 
              step="0.01" 
              value={manualRateInput} 
              onChange={(e) => setManualRateInput(e.target.value)}
              style={{ width: '70px', background: '#0f172a', border: '1px solid var(--border-accent)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600 }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>AUD</span>
            <button 
              onClick={fetchExchangeRate} 
              title="Refresh live USD to AUD exchange rate" 
              disabled={exchangeRateLoading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={15} className={exchangeRateLoading ? "animate-spin" : ""} />
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="btn-secondary"
            title="Lock workspace / Logout"
            style={{ padding: '8px 12px' }}
          >
            <Lock size={15} /> Lock
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
        
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* File Upload Box */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={20} color="var(--primary-accent)" />
              Upload CSV File
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
              Select a CSV containing card unique IDs (e.g., OP13-120 SEC, ST30-001).
            </p>

            <label style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '20px 16px', 
              border: '2px dashed var(--border-accent)', 
              borderRadius: '12px', 
              cursor: 'pointer', 
              background: 'rgba(99, 102, 241, 0.03)',
              transition: 'all 0.2s',
              marginBottom: '12px'
            }}>
              <UploadCloud size={28} color="var(--primary-accent)" style={{ marginBottom: '6px' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Choose CSV File</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>.csv files supported</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            <div style={{ textAlign: 'center' }}>
              <a 
                href="/one-piece-card-trader/example_card_inputs.csv"
                download="example_card_inputs.csv"
                style={{ 
                  color: 'var(--primary-accent)', 
                  fontSize: '0.82rem', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  textDecoration: 'none'
                }}
              >
                <FileSpreadsheet size={14} /> Download Reference Example CSV
              </a>
            </div>
          </div>

          {/* Add Manual Code Box */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} color="var(--primary-accent)" />
              Add Card ID Manually
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="e.g. OP13-120 SEC"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualCode()}
                style={{
                  flex: 1,
                  background: '#0f172a',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
              <button onClick={addManualCode} className="btn-primary" style={{ padding: '10px 14px' }}>
                Add
              </button>
            </div>
          </div>

          {/* Queue List */}
          <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="var(--primary-accent)" />
                Card Queue ({cardInputs.length})
              </h3>
              {cardInputs.length > 0 && (
                <button 
                  onClick={() => setCardInputs([])} 
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Clear Queue
                </button>
              )}
            </div>

            <div style={{ 
              flex: 1, 
              maxHeight: '220px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              paddingRight: '4px'
            }}>
              {cardInputs.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto 0' }}>
                  No card numbers queued yet. Upload a CSV or add IDs manually above.
                </p>
              ) : (
                cardInputs.map((code, idx) => {
                  const isPriced = selectedResults.some(r => r.cardNumber === code);
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justify: 'space-between', 
                      alignItems: 'center', 
                      background: isPriced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)', 
                      border: isPriced ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                      padding: '8px 12px', 
                      borderRadius: '8px',
                      fontSize: '0.88rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{code}</span>
                        {isPriced && (
                          <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                            Priced
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => removeCardCode(code)} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={startPricingProcess} 
              disabled={isProcessing || cardInputs.length === 0}
              className="btn-primary"
              style={{ width: '100%', marginTop: '18px', justifyContent: 'center' }}
            >
              {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
              {isProcessing ? "Fetching Prices..." : `Fetch Prices (${cardInputs.length})`}
            </button>
          </div>

        </aside>

        {/* Right Column: Pricing Dashboard & Results Table */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Dashboard Header Bar */}
          <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>Priced Cards & Sales History ({selectedResults.length})</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                {statusMessage || "Market Prices + 3 Most Recent Purchase Sales and Average."}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={clearAllSavedData}
                className="btn-secondary"
                title="Clear cached results and start clean"
                style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
              >
                <RotateCcw size={14} /> Clear Cache
              </button>

              <button 
                onClick={exportToCSV} 
                disabled={selectedResults.length === 0}
                className="btn-secondary"
                style={{ background: selectedResults.length > 0 ? 'rgba(16, 185, 129, 0.15)' : undefined, borderColor: selectedResults.length > 0 ? 'rgba(16, 185, 129, 0.4)' : undefined }}
              >
                <Download size={18} color={selectedResults.length > 0 ? '#10b981' : undefined} />
                Export CSV (AUD & USD)
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Set Name</th>
                  <th>Card #</th>
                  <th>Market Price</th>
                  <th>3 Recent Purchase Prices</th>
                  <th>3-Sale Average</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
                      <Sparkles size={36} color="var(--primary-accent)" style={{ marginBottom: '12px', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.95rem' }}>No priced cards yet. Upload a CSV or add card IDs to begin.</p>
                    </td>
                  </tr>
                ) : (
                  selectedResults.map((item, idx) => {
                    const priceUSD = item.marketPriceUSD;
                    const priceAUD = priceUSD !== null && priceUSD !== undefined ? priceUSD * rateNum : null;
                    
                    const recentSales = item.recentSalesUSD || [];
                    const avgUSD = item.averageRecentSalesUSD;
                    const avgAUD = avgUSD !== null && avgUSD !== undefined ? avgUSD * rateNum : null;

                    const isSkipped = item.status === "Skipped";

                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl} 
                                alt={item.productName} 
                                style={{ width: '44px', height: '62px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }} 
                              />
                            ) : (
                              <div style={{ width: '44px', height: '62px', background: '#1e293b', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CreditCard size={18} color="var(--text-dim)" />
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>{item.productName}</div>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: isSkipped ? '#f59e0b' : 'var(--primary-accent)', 
                                background: isSkipped ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.1)', 
                                padding: '2px 6px', 
                                borderRadius: '4px' 
                              }}>
                                {item.status || 'Priced'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {item.setName}
                        </td>

                        <td>
                          <code style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', color: '#38bdf8' }}>
                            {item.number || item.cardNumber}
                          </code>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: priceUSD !== null ? '#10b981' : 'var(--text-dim)' }}>
                            {priceUSD !== null ? `$${priceUSD.toFixed(2)} USD` : 'N/A'}
                          </div>
                          {priceAUD !== null && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              ~${priceAUD.toFixed(2)} AUD
                            </div>
                          )}
                        </td>

                        <td>
                          {recentSales.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {recentSales.map((sPrice, sIdx) => (
                                  <span key={sIdx} style={{ background: '#0f172a', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 }}>
                                    ${sPrice.toFixed(2)}
                                  </span>
                                ))}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>Last 3 Purchases</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No recent sales</span>
                          )}
                        </td>

                        <td>
                          {avgUSD !== null ? (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TrendingUp size={14} color="#38bdf8" /> ${avgUSD.toFixed(2)} USD
                              </div>
                              {avgAUD !== null && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  ~${avgAUD.toFixed(2)} AUD
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>N/A</span>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button 
                              onClick={() => handleReopenVariantPicker(idx, item)}
                              style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                              title="Re-open variant picker for this card"
                            >
                              <Edit3 size={14} /> Switch
                            </button>

                            {item.productUrl && (
                              <a 
                                href={item.productUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                              >
                                View <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </main>
      </div>

      {/* Interactive Card Variant Selector Modal */}
      {pendingVariants && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '32px',
            border: '1px solid var(--primary-accent)',
            position: 'relative'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <AlertCircle color="var(--primary-accent)" size={24} />
                  <h2 style={{ fontSize: '1.4rem' }}>
                    Select Variant for "{pendingVariants.cardNumber}"
                  </h2>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {editingRowIndex !== null 
                    ? "Editing selected variant for this card."
                    : `Multiple prints/variants found on TCGPlayer (${pendingVariants.variants.length} options).`}
                </p>
              </div>

              <button 
                onClick={handleCloseModal}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.06)', 
                  border: '1px solid var(--border-color)', 
                  color: '#fff', 
                  borderRadius: '50%', 
                  width: '36px', 
                  height: '36px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer' 
                }}
                title="Exit / Save & Close Selection Modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ 
              display: 'flex', 
              justify: 'space-between', 
              alignItems: 'center', 
              background: 'rgba(255, 255, 255, 0.03)', 
              padding: '12px 18px', 
              borderRadius: '10px',
              marginBottom: '24px'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                Don't see your desired print variant below?
              </span>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleSkipVariant} 
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.85rem', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }}
                >
                  <SkipForward size={14} /> Skip This Card
                </button>

                <button 
                  onClick={handleCloseModal} 
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  Close & Pause Batch
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '20px'
            }}>
              {pendingVariants.variants.map((v, i) => {
                const usd = v.marketPriceUSD;
                const aud = usd !== null ? (usd * rateNum).toFixed(2) : "N/A";
                const avgUSD = v.averageRecentSalesUSD;
                const avgAUD = avgUSD !== null ? (avgUSD * rateNum).toFixed(2) : "N/A";

                return (
                  <div 
                    key={i} 
                    onClick={() => handleSelectVariant(v)}
                    className="glass-panel variant-card"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}
                  >
                    <img 
                      src={v.imageUrl} 
                      alt={v.productName} 
                      style={{ width: '130px', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}
                    />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
                      {v.productName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {v.setName}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)', width: '100%' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Market Price</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
                        {usd !== null ? `$${usd.toFixed(2)} USD (~$${aud} AUD)` : 'Price N/A'}
                      </div>

                      {avgUSD !== null && (
                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                          3-Sale Avg: ${avgUSD.toFixed(2)} USD (~${avgAUD} AUD)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function roundDec(val, dec = 2) {
  return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
}

export default function App() {
  return (
    <AuthGuard>
      <MainDashboard />
    </AuthGuard>
  );
}
