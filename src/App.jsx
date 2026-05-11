import { useState, useCallback } from "react";

const KEEPA_KEY = "e13gv36pj9pijq8d84h045n5rv4r2d0rekm8lsjumnbl09ham7n3h6vionpc5efc";

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1503406445725483160/AjIRSxPqr1Cr3iHhxO-3WytpTqo-4T-9ZjBXcKHIBo6Nda6TuVyukJIf8n9_OKtzv-zV";

async function sendDiscordAlert(product) {
  if (product.grade !== "A+" && product.grade !== "A") return;
  if (product.roi < 40) return;
  if (product.amazonPresence > 30) return;

  const emoji = product.grade === "A+" ? "🟢" : "🔵";
  const message = {
    username: "OA Intelligence Bot",
    embeds: [{
      title: emoji + " " + product.grade + " LEAD — " + product.title,
      color: product.grade === "A+" ? 0x00ff88 : 0x4ade80,
      fields: [
        { name: "ROI", value: product.roi + "%", inline: true },
        { name: "Profit", value: "$" + product.profit.toFixed(2), inline: true },
        { name: "Score", value: product.score + "/100", inline: true },
        { name: "Sellers", value: String(product.sellerCount), inline: true },
        { name: "BB Stability", value: product.buyBoxStability + "%", inline: true },
        { name: "Amazon %", value: product.amazonPresence + "%", inline: true },
        { name: "Retailer", value: product.retailer, inline: true },
        { name: "Source", value: product.source, inline: true },
        { name: "Cost", value: "$" + product.cost, inline: true },
      ],
      description: "[View on Amazon](https://www.amazon.com/dp/" + product.asin + ") | [Keepa](https://keepa.com/#!product/1-" + product.asin + ")",
      footer: { text: "OA Intelligence Dashboard" },
      timestamp: new Date().toISOString(),
    }]
  };

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (e) {
    console.error("Discord alert failed:", e);
  }
}

const GRADE_CONFIG = {
  "A+": { color: "#00ff88", bg: "rgba(0,255,136,0.12)", label: "ELITE" },
  "A":  { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  label: "STRONG" },
  "B":  { color: "#facc15", bg: "rgba(250,204,21,0.1)",  label: "ACCEPTABLE" },
  "C":  { color: "#fb923c", bg: "rgba(251,146,60,0.1)",  label: "RISKY" },
  "F":  { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "REJECT" },
};

const SAMPLE_PRODUCTS = [
  { id: 1, asin: "B09X3KSMVN", title: "Ninja Foodi 6.5 Qt Air Fryer", image: "🍳", retailer: "Target", cost: 89.99, sellPrice: 167.00, roi: 67, monthSales: 420, sellerCount: 3, buyBoxStability: 94, amazonPresence: 8, score: 91, grade: "A+", profit: 42.18, trend: "stable", replenishable: true, ipRisk: false, status: "pending", source: "Tactical Arbitrage", keepaLoaded: false },
  { id: 2, asin: "B08H75RTZ8", title: "Vitamix E310 Explorian Blender", image: "🥤", retailer: "Walmart", cost: 199.00, sellPrice: 329.00, roi: 48, monthSales: 290, sellerCount: 4, buyBoxStability: 88, amazonPresence: 12, score: 78, grade: "A", profit: 64.22, trend: "up", replenishable: true, ipRisk: false, status: "pending", source: "Tactical Arbitrage", keepaLoaded: false },
  { id: 3, asin: "B07ZPKN6YR", title: "KitchenAid Hand Mixer 5-Speed", image: "🍰", retailer: "Kohl's", cost: 44.99, sellPrice: 79.99, roi: 55, monthSales: 180, sellerCount: 6, buyBoxStability: 71, amazonPresence: 22, score: 62, grade: "B", profit: 18.43, trend: "stable", replenishable: false, ipRisk: false, status: "pending", source: "InventoryLab", keepaLoaded: false },
  { id: 4, asin: "B093BVYZQB", title: "Dyson V8 Cordless Vacuum", image: "🌀", retailer: "Home Depot", cost: 279.00, sellPrice: 389.00, roi: 22, monthSales: 510, sellerCount: 11, buyBoxStability: 44, amazonPresence: 67, score: 31, grade: "F", profit: 28.10, trend: "down", replenishable: false, ipRisk: true, status: "rejected", source: "Tactical Arbitrage", keepaLoaded: false },
  { id: 5, asin: "B08DFPV5TP", title: "Instant Pot Duo 7-in-1 6Qt", image: "🫕", retailer: "Walgreens", cost: 59.99, sellPrice: 109.00, roi: 52, monthSales: 640, sellerCount: 5, buyBoxStability: 82, amazonPresence: 18, score: 74, grade: "A", profit: 24.01, trend: "up", replenishable: true, ipRisk: false, status: "pending", source: "Tactical Arbitrage", keepaLoaded: false },
  { id: 6, asin: "B07VCLMR34", title: "Lodge Cast Iron Skillet 12in", image: "🥘", retailer: "Target", cost: 19.99, sellPrice: 44.99, roi: 103, monthSales: 890, sellerCount: 2, buyBoxStability: 97, amazonPresence: 0, score: 98, grade: "A+", profit: 15.22, trend: "stable", replenishable: true, ipRisk: false, status: "approved", source: "InventoryLab", keepaLoaded: false },
];

const SORT_OPTIONS = [
  { label: "Highest ROI", key: "roi", dir: "desc" },
  { label: "Safest", key: "buyBoxStability", dir: "desc" },
  { label: "Fastest Sellers", key: "monthSales", dir: "desc" },
  { label: "Lowest Competition", key: "sellerCount", dir: "asc" },
  { label: "Best Score", key: "score", dir: "desc" },
  { label: "Highest Profit", key: "profit", dir: "desc" },
];

const GRADE_FILTERS = ["All", "A+", "A", "B", "C", "F"];

function computeScore(p) {
  let score = 50;
  if (p.buyBoxStability >= 85) score += 20;
  else if (p.buyBoxStability >= 70) score += 10;
  else score -= 10;
  if (p.amazonPresence <= 10) score += 15;
  else if (p.amazonPresence <= 25) score += 5;
  else if (p.amazonPresence >= 50) score -= 20;
  if (p.sellerCount <= 3) score += 15;
  else if (p.sellerCount <= 6) score += 5;
  else if (p.sellerCount >= 10) score -= 15;
  if (p.roi >= 60) score += 15;
  else if (p.roi >= 40) score += 8;
  else score -= 15;
  if (p.trend === "up") score += 5;
  else if (p.trend === "down") score -= 10;
  if (p.replenishable) score += 10;
  if (p.ipRisk) score -= 30;
  score = Math.max(0, Math.min(100, score));
  let grade = "F";
  if (score >= 88) grade = "A+";
  else if (score >= 72) grade = "A";
  else if (score >= 55) grade = "B";
  else if (score >= 38) grade = "C";
  return { score, grade };
}

async function fetchKeepa(asin) {
  try {
    const url = "https://api.keepa.com/product?key=" + KEEPA_KEY + "&domain=1&asin=" + asin + "&stats=180&offers=20";
    const res = await fetch(url);
    const data = await res.json();
    if (!data.products || !data.products.length) return null;
    const p = data.products[0];
    const sellerCount = p.stats && p.stats.offerCountFBA ? p.stats.offerCountFBA : 0;
    const amazonPresence = p.stats && p.stats.buyBoxPercentage
      ? Math.round((p.stats.buyBoxPercentage[0] || 0) / 10) : 0;
    const currentPrice = p.stats && p.stats.current && p.stats.current[18] > 0
      ? p.stats.current[18] / 100
      : p.stats && p.stats.current && p.stats.current[0] > 0
      ? p.stats.current[0] / 100 : null;
    const salesRank = p.stats && p.stats.current && p.stats.current[3]
      ? p.stats.current[3] : p.salesRankCurrent || null;
    const monthSales = salesRank ? Math.max(10, Math.round(5000000 / (salesRank + 500))) : 50;
    const buyBoxStability = p.stats && p.stats.buyBoxPercentage
      ? Math.min(99, Math.round(100 - (p.stats.buyBoxPercentage[0] || 50) / 10)) : 70;
    const priceHistory = (p.csv && p.csv[18]) ? p.csv[18] : (p.csv && p.csv[0]) ? p.csv[0] : [];
    let trend = "stable";
    if (priceHistory.length >= 4) {
      const recent = priceHistory[priceHistory.length - 1];
      const older = priceHistory[priceHistory.length - 3];
      if (recent > older * 1.05) trend = "up";
      else if (recent < older * 0.95) trend = "down";
    }
    return { sellerCount, amazonPresence, currentPrice, salesRank, monthSales, buyBoxStability, trend, keepaTitle: p.title || null, keepaLoaded: true };
  } catch (e) { return null; }
}

function ScoreMeter({ score }) {
  const color = score >= 85 ? "#00ff88" : score >= 65 ? "#facc15" : score >= 40 ? "#fb923c" : "#f87171";
  return (
    <div style={{ width: 52, height: 52, borderRadius: "50%", background: "conic-gradient(" + color + " " + (score * 3.6) + "deg, rgba(255,255,255,0.07) 0deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color, fontFamily: "monospace" }}>{score}</div>
    </div>
  );
}

function GradeBadge({ grade }) {
  const cfg = GRADE_CONFIG[grade];
  return <div style={{ background: cfg.bg, border: "1.5px solid " + cfg.color, color: cfg.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{grade} - {cfg.label}</div>;
}

function Tag({ children, color }) {
  return <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid " + (color || "#888") + "30", color: color || "#888", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>{children}</span>;
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", minWidth: 80 }}>
      <div style={{ fontSize: 10, color: "#666", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "#ccc", fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, color, onClick }) {
  return (
    <button onClick={function(e) { e.stopPropagation(); onClick(); }} style={{ background: color + "18", border: "1px solid " + color + "50", color, borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 4 }}>{label}</button>
  );
}

function ProductCard({ product, onAction, onLookup }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLookup(e) {
    e.stopPropagation();
    setLoading(true);
    await onLookup(product.id, product.asin);
    setLoading(false);
  }

  const trend = product.trend === "up" ? "▲" : product.trend === "down" ? "▼" : "▬";
  const trendColor = product.trend === "up" ? "#00ff88" : product.trend === "down" ? "#f87171" : "#888";

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid " + (product.status === "approved" ? "#00ff8840" : product.status === "rejected" ? "#f8717140" : "rgba(255,255,255,0.09)"), borderRadius: 16, overflow: "hidden", opacity: product.status === "rejected" ? 0.5 : 1 }}>
      <div style={{ padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }} onClick={function() { setExpanded(function(e) { return !e; }); }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{product.image}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#eee", marginBottom: 6, lineHeight: 1.3 }}>{product.title}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <Tag color="#aaa">{product.retailer}</Tag>
            <Tag color="#666">{product.asin}</Tag>
            {product.replenishable && <Tag color="#00ff88">REPLEN</Tag>}
            {product.ipRisk && <Tag color="#f87171">IP RISK</Tag>}
            {product.keepaLoaded && <Tag color="#6366f1">KEEPA</Tag>}
            <Tag color="#0ea5e9">{product.source}</Tag>
            <span style={{ color: trendColor, fontSize: 13 }}>{trend}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <ScoreMeter score={product.score} />
          <GradeBadge grade={product.grade} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 18px 14px", overflowX: "auto" }}>
        <StatBox label="ROI" value={product.roi + "%"} color={product.roi >= 40 ? "#00ff88" : "#f87171"} />
        <StatBox label="Profit" value={"$" + product.profit.toFixed(0)} color="#4ade80" />
        <StatBox label="Sellers" value={product.sellerCount} color={product.sellerCount <= 4 ? "#00ff88" : product.sellerCount <= 7 ? "#facc15" : "#f87171"} />
        <StatBox label="BB Stab" value={product.buyBoxStability + "%"} color={product.buyBoxStability >= 80 ? "#00ff88" : "#facc15"} />
        <StatBox label="Amz%" value={product.amazonPresence + "%"} color={product.amazonPresence <= 20 ? "#00ff88" : product.amazonPresence <= 40 ? "#facc15" : "#f87171"} />
        <StatBox label="Mo Sales" value={product.monthSales} color="#aaa" />
      </div>

      {expanded && (
        <div style={{ padding: "14px 18px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, fontSize: 12 }}>
            <span style={{ color: "#777" }}>Cost: <strong style={{ color: "#ccc" }}>${product.cost}</strong></span>
            <span style={{ color: "#777" }}>Sell: <strong style={{ color: "#ccc" }}>${product.sellPrice}</strong></span>
            {product.currentPrice && <span style={{ color: "#777" }}>Live BB: <strong style={{ color: "#00ff88" }}>${product.currentPrice.toFixed(2)}</strong></span>}
            {product.salesRank && <span style={{ color: "#777" }}>Rank: <strong style={{ color: "#ccc" }}>#{product.salesRank.toLocaleString()}</strong></span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!product.keepaLoaded && <ActionBtn label={loading ? "Loading..." : "📡 Pull Keepa Data"} color="#6366f1" onClick={handleLookup} />}
            <ActionBtn label="📈 Keepa" color="#6366f1" onClick={function() { window.open("https://keepa.com/#!product/1-" + product.asin, "_blank"); }} />
            <ActionBtn label="🔍 SellerAmp" color="#8b5cf6" onClick={function() { window.open("https://sas.selleramp.com/sas/lookup?SASLookup=" + product.asin, "_blank"); }} />
            <ActionBtn label="📦 InventoryLab" color="#10b981" onClick={function() { window.open("https://www.inventorylab.com/app/stratify/listing?query=" + product.asin, "_blank"); }} />
            <ActionBtn label="🤖 Tact. Arb" color="#0ea5e9" onClick={function() { window.open("https://www.tacticalarbitrage.com", "_blank"); }} />
            <ActionBtn label="🛒 Amazon" color="#f59e0b" onClick={function() { window.open("https://www.amazon.com/dp/" + product.asin, "_blank"); }} />
            {product.status !== "approved" && <ActionBtn label="Approve" color="#00ff88" onClick={function() { onAction(product.id, "approved"); }} />}
            {product.status !== "rejected" && <ActionBtn label="Reject" color="#f87171" onClick={function() { onAction(product.id, "rejected"); }} />}
            <ActionBtn label="Watchlist" color="#888" onClick={function() { onAction(product.id, "watch"); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function CSVImport({ onImport }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setResult("");
    const reader = new FileReader();
    reader.onload = function(ev) {
      const text = ev.target.result;
      const lines = text.trim().split("\n").filter(function(l) { return l.trim(); });
      const products = [];
      lines.forEach(function(line, idx) {
        const cols = [];
        let cur = "", inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuote = !inQuote; }
          else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        cols.push(cur.trim());
        const title = (cols[1] || "").replace(/^"|"$/g, "").trim();
        const asin = (cols[2] || "").replace(/^"|"$/g, "").trim();
        const cost = parseFloat(cols[5]) || 0;
        const profit = parseFloat(cols[6]) || 0;
        const roiRaw = parseFloat(cols[7]) || 0;
        const roi = roiRaw < 2 ? Math.round(roiRaw * 100) : Math.round(roiRaw);
        const salesRankRaw = parseFloat(cols[8]) || 0;
        const monthSales = salesRankRaw > 0 ? Math.max(5, Math.round(5000000 / (salesRankRaw + 500))) : 30;
        const sellPrice = cost + profit > 0 ? parseFloat((cost + profit).toFixed(2)) : parseFloat((cost * 1.6).toFixed(2));
        if (!asin || asin.length < 5 || !title) return;
        const p = {
          id: Date.now() + idx, asin, title, image: "📦", retailer: "SellerAmp",
          cost, sellPrice, profit: parseFloat(profit.toFixed(2)), roi,
          monthSales, salesRank: salesRankRaw, sellerCount: 5,
          buyBoxStability: 75, amazonPresence: 15, trend: "stable",
          replenishable: false, ipRisk: false, status: "pending",
          source: "SellerAmp", keepaLoaded: false,
        };
        const sg = computeScore(p);
        products.push(Object.assign({}, p, sg));
      });
      setLoading(false);
      if (products.length === 0) { setResult("No valid products found in CSV."); return; }
      onImport(products);
      setResult("Imported " + products.length + " products!");
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>SELLERAMP CSV IMPORT</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#10b981", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {loading ? "Importing..." : "Choose CSV File"}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
        <span style={{ fontSize: 11, color: "#444" }}>Drop your SellerAmp Buy Sheet CSV</span>
      </div>
      {result && <div style={{ color: "#10b981", fontSize: 11, marginTop: 8, fontWeight: 700 }}>{result}</div>}
    </div>
  );
}

function AsinLookup({ onAdd }) {
  const [asin, setAsin] = useState("");
  const [cost, setCost] = useState("");
  const [retailer, setRetailer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!asin.trim() || !cost) { setError("Enter ASIN and your cost price"); return; }
    setLoading(true);
    setError("");
    const keepa = await fetchKeepa(asin.trim().toUpperCase());
    if (!keepa) { setError("Could not fetch Keepa data. Check the ASIN."); setLoading(false); return; }
    const costNum = parseFloat(cost);
    const sellPrice = keepa.currentPrice || costNum * 2;
    const fees = sellPrice * 0.15 + 3.5;
    const profit = sellPrice - costNum - fees;
    const roi = Math.round((profit / costNum) * 100);
    const newProduct = {
      id: Date.now(), asin: asin.trim().toUpperCase(),
      title: keepa.keepaTitle || "Product " + asin,
      image: "📦", retailer: retailer || "Manual",
      cost: costNum, sellPrice: parseFloat(sellPrice.toFixed(2)),
      roi, profit: parseFloat(profit.toFixed(2)),
      monthSales: keepa.monthSales, sellerCount: keepa.sellerCount,
      buyBoxStability: keepa.buyBoxStability, amazonPresence: keepa.amazonPresence,
      trend: keepa.trend, replenishable: false, ipRisk: false,
      status: "pending", source: "Manual",
      currentPrice: keepa.currentPrice, salesRank: keepa.salesRank, keepaLoaded: true,
    };
    const sg = computeScore(newProduct);
    onAdd(Object.assign({}, newProduct, sg));
    setAsin(""); setCost(""); setRetailer("");
    setLoading(false);
  }

  return (
    <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>📡 KEEPA LOOKUP — ADD PRODUCT BY ASIN</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={asin} onChange={function(e) { setAsin(e.target.value); }} placeholder="ASIN (e.g. B09X3KSMVN)" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#ddd", fontSize: 12, outline: "none", fontFamily: "inherit", flex: 2, minWidth: 140 }} />
        <input value={cost} onChange={function(e) { setCost(e.target.value); }} placeholder="Your cost $" type="number" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#ddd", fontSize: 12, outline: "none", fontFamily: "inherit", flex: 1, minWidth: 80 }} />
        <input value={retailer} onChange={function(e) { setRetailer(e.target.value); }} placeholder="Retailer" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#ddd", fontSize: 12, outline: "none", fontFamily: "inherit", flex: 1, minWidth: 80 }} />
        <button onClick={handleAdd} disabled={loading} style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#818cf8", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Fetching..." : "+ Add"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 11, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function SummaryBar({ products }) {
  const approved = products.filter(function(p) { return p.status === "approved"; }).length;
  const pending = products.filter(function(p) { return p.status === "pending"; }).length;
  const rejected = products.filter(function(p) { return p.status === "rejected"; }).length;
  const elite = products.filter(function(p) { return p.grade === "A+" || p.grade === "A"; }).length;
  const avgScore = Math.round(products.reduce(function(a, p) { return a + p.score; }, 0) / products.length);
  const totalProfit = products.filter(function(p) { return p.status === "approved"; }).reduce(function(a, p) { return a + p.profit; }, 0);
  const stats = [
    { label: "Pending", val: pending, color: "#facc15" },
    { label: "Approved", val: approved, color: "#00ff88" },
    { label: "Rejected", val: rejected, color: "#f87171" },
    { label: "A/A+ Leads", val: elite, color: "#6366f1" },
    { label: "Avg Score", val: avgScore, color: "#aaa" },
    { label: "Est Profit", val: "$" + totalProfit.toFixed(0), color: "#4ade80" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 0 4px" }}>
      {stats.map(function(s) {
        return (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 14px" }}>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.val}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function OADashboard() {
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  function showToast(msg, color) {
    setToast({ msg, color: color || "#00ff88" });
    setTimeout(function() { setToast(null); }, 2500);
  }

  function handleAction(id, action) {
    if (action === "watch") { showToast("Added to watchlist", "#6366f1"); return; }
    setProducts(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { status: action }) : p; }); });
    showToast(action === "approved" ? "Product approved!" : "Product rejected", action === "approved" ? "#00ff88" : "#f87171");
  }

  const handleLookup = useCallback(async function(id, asin) {
    const data = await fetchKeepa(asin);
    if (!data) { showToast("Keepa fetch failed", "#f87171"); return; }
    setProducts(function(ps) {
      return ps.map(function(p) {
        if (p.id !== id) return p;
        const updated = Object.assign({}, p, data);
        const sg = computeScore(updated);
        return Object.assign({}, updated, sg);
      });
    });
    showToast("Keepa data loaded!", "#6366f1");
    setProducts(function(ps) { var updated = ps.find(function(p) { return p.id === id; }); if (updated) sendDiscordAlert(updated); return ps; });
  }, []);

  function handleAdd(product) {
    setProducts(function(ps) { return [product].concat(ps); });
    showToast("Added: " + product.title.slice(0, 25) + "...", "#00ff88");
    sendDiscordAlert(product);
  }

  function handleImport(products) {
    setProducts(function(ps) { return products.concat(ps); });
    showToast("Imported " + products.length + " SellerAmp products!", "#10b981");
    products.forEach(function(p) { sendDiscordAlert(p); });
  }

  const filtered = products
    .filter(function(p) { return gradeFilter === "All" || p.grade === gradeFilter; })
    .filter(function(p) { return statusFilter === "All" || p.status === statusFilter; })
    .filter(function(p) { return !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.asin.includes(search.toUpperCase()); })
    .sort(function(a, b) {
      const mult = sortDir === "desc" ? -1 : 1;
      return mult * (a[sortKey] - b[sortKey]);
    });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a10", color: "#ddd", fontFamily: "system-ui, sans-serif", paddingBottom: 40 }}>
      <style>{"::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}*{box-sizing:border-box;margin:0;padding:0}"}</style>

      <div style={{ background: "linear-gradient(180deg,rgba(99,102,241,0.12) 0%,transparent 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>OA Intelligence</div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>Sourcing Dashboard · Keepa Connected</div>
          </div>
          <div style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "6px 12px", fontSize: 11, color: "#818cf8", fontWeight: 700 }}>LIVE</div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <SummaryBar products={products} />
        <CSVImport onImport={handleImport} />
        <AsinLookup onAdd={handleAdd} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search by title or ASIN..." style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#ddd", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GRADE_FILTERS.map(function(g) {
              return <button key={g} onClick={function() { setGradeFilter(g); }} style={{ background: gradeFilter === g ? (GRADE_CONFIG[g] ? GRADE_CONFIG[g].bg : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)", border: "1px solid " + (gradeFilter === g ? (GRADE_CONFIG[g] ? GRADE_CONFIG[g].color : "#aaa") : "rgba(255,255,255,0.08)"), color: gradeFilter === g ? (GRADE_CONFIG[g] ? GRADE_CONFIG[g].color : "#fff") : "#666", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{g}</button>;
            })}
            {["All", "pending", "approved", "rejected"].map(function(s) {
              return <button key={s} onClick={function() { setStatusFilter(s); }} style={{ background: statusFilter === s ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", border: "1px solid " + (statusFilter === s ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"), color: statusFilter === s ? "#ddd" : "#555", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{s}</button>;
            })}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {SORT_OPTIONS.map(function(opt) {
              return <button key={opt.key} onClick={function() { setSortKey(opt.key); setSortDir(opt.dir); }} style={{ background: sortKey === opt.key ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)", border: "1px solid " + (sortKey === opt.key ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"), color: sortKey === opt.key ? "#818cf8" : "#555", borderRadius: 8, padding: "5px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{opt.label}</button>;
            })}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#444", marginBottom: 12 }}>{filtered.length} products</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(function(p) { return <ProductCard key={p.id} product={p} onAction={handleAction} onLookup={handleLookup} />; })}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: "#444", padding: 40 }}>No products match your filters</div>}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#111", border: "1px solid " + toast.color, color: toast.color, borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, zIndex: 999, whiteSpace: "nowrap" }}>{toast.msg}</div>
      )}
    </div>
  );
}