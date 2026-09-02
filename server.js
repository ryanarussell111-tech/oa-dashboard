require("dotenv").config();

const cron = require("node-cron");
const fetch = require("node-fetch");

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TA_EMAIL = process.env.TA_EMAIL;
const TA_PASSWORD = process.env.TA_PASSWORD;

// Single guarded exit point for Discord. Everything that posts goes through
// here so a missing webhook degrades to a warning instead of a crash.
async function postToDiscord(payload) {
  if (!DISCORD_WEBHOOK) {
    console.warn("DISCORD_WEBHOOK not set — skipping Discord post");
    return false;
  }
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.error("Discord post failed:", e.message);
    return false;
  }
}

// Scoring engine (matches your dashboard)
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

// Send Discord alert for qualifying products. Fields are built defensively
// because this also serves requests coming from the browser.
async function sendDiscordAlert(product, footerText) {
  const num = (v, digits) => {
    const n = Number(v);
    return Number.isFinite(n) ? (digits === undefined ? String(n) : n.toFixed(digits)) : "—";
  };

  const fields = [
    { name: "ROI", value: `${num(product.roi)}%`, inline: true },
    { name: "Profit", value: `$${num(product.profit, 2)}`, inline: true },
    { name: "Score", value: `${num(product.score)}/100`, inline: true },
    { name: "Sellers", value: num(product.sellerCount), inline: true },
  ];
  if (product.buyBoxStability !== undefined) {
    fields.push({ name: "BB Stability", value: `${num(product.buyBoxStability)}%`, inline: true });
  }
  if (product.amazonPresence !== undefined) {
    fields.push({ name: "Amazon %", value: `${num(product.amazonPresence)}%`, inline: true });
  }
  fields.push({ name: "Retailer", value: String(product.retailer || "—"), inline: true });
  if (product.source) {
    fields.push({ name: "Source", value: String(product.source), inline: true });
  }
  fields.push({ name: "Cost", value: `$${num(product.cost, 2)}`, inline: true });

  const emoji = product.grade === "A+" ? "🟢" : "🔵";
  const asin = encodeURIComponent(product.asin || "");
  const sent = await postToDiscord({
    username: "OA Intelligence Bot",
    embeds: [{
      title: `${emoji} ${product.grade} LEAD — ${product.title}`,
      color: product.grade === "A+" ? 0x00ff88 : 0x4ade80,
      fields,
      description: `[View on Amazon](https://www.amazon.com/dp/${asin}) | [Keepa](https://keepa.com/#!product/1-${asin})`,
      footer: { text: footerText || "OA Intelligence — Auto Scan" },
      timestamp: new Date().toISOString(),
    }]
  });
  if (sent) console.log(`Alert sent: ${product.title}`);
  return sent;
}

// Parse TA CSV text into products
function parseTA(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());

  function col(row, name) {
    const idx = headers.indexOf(name);
    if (idx < 0) return "";
    return (row[idx] || "").replace(/^"|"$/g, "").trim();
  }

  const products = [];
  lines.slice(1).forEach((line, idx) => {
    const row = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { row.push(cur); cur = ""; }
      else { cur += ch; }
    }
    row.push(cur);

    const title = col(row, "Buy: Title");
    const asin = col(row, "Sell: Product ID");
    const retailer = col(row, "Buy: From").replace(".com", "");
    const cost = parseFloat(col(row, "Buy: Price").replace(/[$,]/g, "")) || 0;
    const sellPrice = parseFloat(col(row, "Sell: Price").replace(/[$,]/g, "")) || 0;
    const profit = parseFloat(col(row, "Gross Profit").replace(/[$,]/g, "")) || 0;
    const roi = parseInt(col(row, "Gross ROI").replace(/[^-\d]/g, "")) || 0;
    const salesRank = parseInt(col(row, "Sell: Sales Rank")) || 0;
    const monthSales = parseInt(col(row, "Sell: Estimated Monthly Sales")) || 0;
    const sellerCount = parseInt(col(row, "# Selling 'New'")) || 5;
    const amazonSells = col(row, "Sell: Official Store Sells and In Stock");
    const amazonPresence = amazonSells.toLowerCase().includes("in stock") ? 80 : amazonSells.toLowerCase().includes("out") ? 5 : 15;

    if (!asin || asin.length < 5 || !title || roi <= 0 || profit <= 0) return;

    const p = {
      id: idx, asin, title, retailer: retailer || "TA",
      cost, sellPrice, profit: parseFloat(profit.toFixed(2)), roi,
      monthSales: monthSales || Math.max(5, Math.round(5000000 / (salesRank + 500))),
      salesRank, sellerCount, buyBoxStability: 75, amazonPresence,
      trend: "stable", replenishable: false, ipRisk: false,
    };
    const sg = computeScore(p);
    products.push({ ...p, ...sg });
  });

  return products;
}

// Login to TA and fetch latest results
async function fetchTAResults() {
  console.log("Starting TA auto-fetch...", new Date().toISOString());

  if (!TA_EMAIL || !TA_PASSWORD) {
    console.error("TA credentials not set in environment variables");
    return;
  }

  try {
    // Step 1: Login to TA
    const loginRes = await fetch("https://tacticalarbitrage.threecolts.com/users/sign_in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: TA_EMAIL, password: TA_PASSWORD } }),
      redirect: "follow",
    });

    const cookies = loginRes.headers.get("set-cookie");
    if (!cookies) {
      console.error("Login failed — no cookies returned");
      return;
    }

    // Step 2: Fetch latest search results
    const resultsRes = await fetch("https://tacticalarbitrage.threecolts.com/v2/results/product-finder.csv", {
      headers: { "Cookie": cookies },
    });

    if (!resultsRes.ok) {
      console.error("Failed to fetch TA results:", resultsRes.status);
      return;
    }

    const csvText = await resultsRes.text();
    const products = parseTA(csvText);
    console.log(`Parsed ${products.length} products from TA`);

    // Step 3: Filter and alert qualifying products
    const qualified = products.filter(p => (p.grade === "A+" || p.grade === "A") && p.roi >= 40 && p.amazonPresence <= 30);
    console.log(`${qualified.length} products qualify for alerts`);

    // Send alerts with delay to avoid rate limiting
    for (const product of qualified.slice(0, 10)) {
      await sendDiscordAlert(product);
      await new Promise(r => setTimeout(r, 1000));
    }

    // Send summary
    if (qualified.length > 0) {
      await postToDiscord({
        username: "OA Intelligence Bot",
        content: `📊 **Scan complete** — Found **${qualified.length}** qualifying leads from ${products.length} total products. ${new Date().toLocaleString()}`,
      });
    }

  } catch (e) {
    console.error("Auto-fetch error:", e.message);
  }
}

// Run twice daily at 8am and 8pm
cron.schedule("0 9,21 * * *", () => {
  fetchTAResults();
});

// Also run once on startup
fetchTAResults();

console.log("OA Intelligence auto-fetch service running — checks at 8am and 8pm daily");

// Keep process alive
const express = require("express");
const app = express();
app.use(express.json());

app.listen(process.env.PORT || 4000, () => console.log("Health check server running"));
// Keepa grading endpoint
app.post("/api/grade-asins", async (req, res) => {
  try {
    const { asins } = req.body;
    if (!asins || !Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({ error: "No ASINs provided" });
    }
    const { getProductData, gradeProduct } = require("./keepa");
    const chunks = [];
    for (let i = 0; i < asins.length; i += 20) chunks.push(asins.slice(i, i + 20));
    let allProducts = [];
    for (const chunk of chunks) {
      const products = await getProductData(chunk);
      allProducts = allProducts.concat(products);
    }
    const graded = allProducts.map(p => ({
      ...p,
      ...gradeProduct(p.roi, p.profit, p.sellers, p.amzPct, p.bsr)
    }));
    const topPicks = graded.filter(p => (p.grade === "A+" || p.grade === "A") && p.roi >= 40);
    for (const p of topPicks) {
      await sendDiscordAlert(p);
    }
    res.json({ total: graded.length, topPicks: topPicks.length, products: graded });
  } catch (err) {
    console.error("Grade ASINs error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Keepa lookup proxy. The browser calls this instead of api.keepa.com so the
// API key stays server-side.
app.post("/api/keepa/lookup", async (req, res) => {
  try {
    const { asin } = req.body || {};
    if (typeof asin !== "string" || !/^[A-Za-z0-9]{8,14}$/.test(asin.trim())) {
      return res.status(400).json({ error: "A valid ASIN is required" });
    }
    if (!process.env.KEEPA_API_KEY) {
      return res.status(503).json({ error: "Keepa lookup is not configured on the server" });
    }
    const { lookupForDashboard } = require("./keepa");
    const product = await lookupForDashboard(asin.trim().toUpperCase());
    if (!product) return res.status(404).json({ error: "No Keepa data for that ASIN" });
    res.json({ product });
  } catch (err) {
    console.error("Keepa lookup error:", err.message);
    res.status(500).json({ error: "Keepa lookup failed" });
  }
});

// Discord alert proxy. The webhook URL stays server-side, and the qualifying
// filter is re-applied here rather than trusted from the caller.
app.post("/api/alert", async (req, res) => {
  try {
    const { product } = req.body || {};
    if (!product || typeof product !== "object" || !product.asin || !product.title) {
      return res.status(400).json({ error: "A product with asin and title is required" });
    }
    const qualifies =
      (product.grade === "A+" || product.grade === "A") &&
      Number(product.roi) >= 40 &&
      Number(product.amazonPresence) <= 30;
    if (!qualifies) return res.json({ sent: false, reason: "does not qualify" });

    const sent = await sendDiscordAlert(product, "OA Intelligence Dashboard");
    res.json({ sent });
  } catch (err) {
    console.error("Alert error:", err.message);
    res.status(500).json({ error: "Alert failed" });
  }
});

// Serve React frontend
const path = require("path");
app.use(express.static(path.join(__dirname, "build")));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});
