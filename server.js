const cron = require("node-cron");
const fetch = require("node-fetch");

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1503406445725483160/AjIRSxPqr1Cr3iHhxO-3WytpTqo-4T-9ZjBXcKHIBo6Nda6TuVyukJIf8n9_OKtzv-zV";
const TA_EMAIL = process.env.TA_EMAIL;
const TA_PASSWORD = process.env.TA_PASSWORD;

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

// Send Discord alert for qualifying products
async function sendDiscordAlert(product) {
  const emoji = product.grade === "A+" ? "🟢" : "🔵";
  const message = {
    username: "OA Intelligence Bot",
    embeds: [{
      title: `${emoji} ${product.grade} LEAD — ${product.title}`,
      color: product.grade === "A+" ? 0x00ff88 : 0x4ade80,
      fields: [
        { name: "ROI", value: `${product.roi}%`, inline: true },
        { name: "Profit", value: `$${product.profit.toFixed(2)}`, inline: true },
        { name: "Score", value: `${product.score}/100`, inline: true },
        { name: "Sellers", value: String(product.sellerCount), inline: true },
        { name: "Retailer", value: product.retailer, inline: true },
        { name: "Cost", value: `$${product.cost}`, inline: true },
      ],
      description: `[View on Amazon](https://www.amazon.com/dp/${product.asin}) | [Keepa](https://keepa.com/#!product/1-${product.asin})`,
      footer: { text: "OA Intelligence — Auto Scan" },
      timestamp: new Date().toISOString(),
    }]
  };
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    console.log(`Alert sent: ${product.title}`);
  } catch (e) {
    console.error("Discord alert failed:", e.message);
  }
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
    // Step 1: Get login page and CSRF token
const loginPage = await fetch("https://tacticalarbitrage.threecolts.com/users/sign_in");
const loginHtml = await loginPage.text();
const csrfMatch = loginHtml.match(/name="authenticity_token" value="([^"]+)"/);
if (!csrfMatch) { console.error("Could not find CSRF token"); return; }
const csrfToken = csrfMatch[1];
const initialCookies = loginPage.headers.get("set-cookie") || "";

// Step 2: Submit login form
const loginRes = await fetch("https://tacticalarbitrage.threecolts.com/users/sign_in", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": initialCookies,
  },
  body: new URLSearchParams({
    authenticity_token: csrfToken,
    "user[email]": TA_EMAIL,
    "user[password]": TA_PASSWORD,
    commit: "Log in",
  }).toString(),
  redirect: "manual",
});

const cookies = loginRes.headers.get("set-cookie");
if (!cookies) { console.error("Login failed — no cookies returned"); return; }

    // Step 2: Fetch latest search results
    const resultsRes = await fetch("https://tacticalarbitrage.threecolts.com/v2/results/product-finder.csv", {
      headers: { "Cookie": cookies },
    });

    if (!resultsRes.ok) {
      console.error("Failed to fetch TA results:", resultsRes.status);
      return;
    }

    const csvText = await resultsRes.text();
    console.log("CSV preview:", csvText.slice(0, 300));
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
      await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "OA Intelligence Bot",
          content: `📊 **Scan complete** — Found **${qualified.length}** qualifying leads from ${products.length} total products. ${new Date().toLocaleString()}`,
        }),
      });
    }

  } catch (e) {
    console.error("Auto-fetch error:", e.message);
  }
}

// Run twice daily at 9am and 9pm
cron.schedule("0 9,21 * * *", () => {
  fetchTAResults();
});

// Also run once on startup
fetchTAResults();

console.log("OA Intelligence auto-fetch service running — checks at 8am and 8pm daily");

// Keep process alive
const express = require("express");
const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname, "build")));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, "build", "index.html")));
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => console.log("Health check server running on port " + PORT));
