const fetch = require('node-fetch');

const KEEPA_API = 'https://api.keepa.com/product';

async function getProductData(asins) {
  const key = process.env.KEEPA_API_KEY;
  const asinList = asins.join(',');

  const url = `${KEEPA_API}?key=${key}&domain=1&asin=${asinList}&stats=90&offers=20`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.products) return [];

  return data.products.map(p => {
    const stats = p.stats || {};
    const offers = p.offers || [];

    const fbaOffers = offers.filter(o => o.isFBA);
    const sellerCount = fbaOffers.length;

    const amazonOnListing = p.availabilityAmazon === 0;
    const amazonPct = amazonOnListing ? 80 : 0;

    const currentPrice = stats.current?.[0] || 0;
    const costEstimate = currentPrice * 0.6;
    const fees = currentPrice * 0.15;
    const profit = (currentPrice / 100) - (costEstimate / 100) - (fees / 100);
    const roi = costEstimate > 0 ? ((profit / (costEstimate / 100)) * 100) : 0;

    const bsr = p.salesRanks?.[p.categoryTree?.[0]?.catId]?.[0] || 0;

    return {
      asin: p.asin,
      title: p.title || p.asin,
      roi: parseFloat(roi.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      sellers: sellerCount,
      amzPct: amazonPct,
      bsr,
      currentPrice: currentPrice / 100,
    };
  });
}

function gradeProduct(roi, profit, sellers, amzPct, bsr) {
  let score = 0;

  if (roi >= 100) score += 40;
  else if (roi >= 70) score += 32;
  else if (roi >= 40) score += 22;
  else if (roi >= 20) score += 10;
  else if (roi >= 0) score += 2;
  else score -= 10;

  if (profit >= 20) score += 20;
  else if (profit >= 10) score += 14;
  else if (profit >= 5) score += 7;
  else if (profit > 0) score += 2;

  if (sellers <= 3) score += 20;
  else if (sellers <= 7) score += 14;
  else if (sellers <= 15) score += 8;
  else if (sellers <= 30) score += 2;
  else score -= 5;

  if (amzPct === 0) score += 15;
  else if (amzPct < 10) score += 10;
  else if (amzPct < 30) score += 5;
  else if (amzPct < 60) score -= 5;
  else score -= 15;

  if (bsr > 0 && bsr <= 50000) score += 5;

  if (score >= 85) return { grade: 'A+', score };
  if (score >= 68) return { grade: 'A', score };
  if (score >= 50) return { grade: 'B', score };
  if (score >= 35) return { grade: 'C', score };
  if (score >= 20) return { grade: 'D', score };
  return { grade: 'F', score };
}

// Dashboard-shaped lookup for a single ASIN. The API key is read from the
// environment here on the server, so it is never shipped to the browser.
async function lookupForDashboard(asin) {
  const key = process.env.KEEPA_API_KEY;
  if (!key) throw new Error('KEEPA_API_KEY is not set');

  const url = `${KEEPA_API}?key=${key}&domain=1&asin=${encodeURIComponent(asin)}&stats=180&offers=20`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.products || !data.products.length) return null;

  const p = data.products[0];
  const stats = p.stats || {};
  const current = stats.current || [];

  const sellerCount = stats.offerCountFBA || 0;
  const amazonPresence = stats.buyBoxPercentage
    ? Math.round((stats.buyBoxPercentage[0] || 0) / 10) : 0;
  const currentPrice = current[18] > 0 ? current[18] / 100
    : current[0] > 0 ? current[0] / 100 : null;
  const salesRank = current[3] ? current[3] : p.salesRankCurrent || null;
  const monthSales = salesRank ? Math.max(10, Math.round(5000000 / (salesRank + 500))) : 50;
  const buyBoxStability = stats.buyBoxPercentage
    ? Math.min(99, Math.round(100 - (stats.buyBoxPercentage[0] || 50) / 10)) : 70;

  const priceHistory = (p.csv && p.csv[18]) ? p.csv[18] : (p.csv && p.csv[0]) ? p.csv[0] : [];
  let trend = 'stable';
  if (priceHistory.length >= 4) {
    const recent = priceHistory[priceHistory.length - 1];
    const older = priceHistory[priceHistory.length - 3];
    if (recent > older * 1.05) trend = 'up';
    else if (recent < older * 0.95) trend = 'down';
  }

  return {
    sellerCount, amazonPresence, currentPrice, salesRank,
    monthSales, buyBoxStability, trend,
    keepaTitle: p.title || null, keepaLoaded: true,
  };
}

module.exports = { getProductData, gradeProduct, lookupForDashboard };
