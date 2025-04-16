// exchange.js
// Fetches AUD to USD exchange rate for a given date (YYYY-MM-DD) using exchangerate.host

// API key should be stored securely. Try to load from .env, fallback to hardcoded for now.
const EXCHANGE_API_KEY = '5c9848f4ab110c9c69f609cb1d9f8725';

export async function fetchAudUsdRate(dateStr) {
  const url = `https://api.exchangerate.host/historical?access_key=${EXCHANGE_API_KEY}&date=${dateStr}&base=AUD&symbols=USD`;
  let res, data;
  try {
    res = await fetch(url);
    if (!res.ok) {
      console.error('[EXCHANGE][ERROR] Fetch failed', { url, status: res.status, statusText: res.statusText });
      throw new Error('Failed to fetch exchange rate');
    }
    data = await res.json();
  } catch (err) {
    console.error('[EXCHANGE][ERROR] Network or parsing error', { url, error: err });
    throw err;
  }
  if (data && data.quotes) {
    if (typeof data.quotes.AUDUSD === 'number') {
      return data.quotes.AUDUSD;
    }
    if (typeof data.quotes.USDAUD === 'number') {
      // API returned USD as base, so invert to get AUD→USD
      return 1 / data.quotes.USDAUD;
    }
  }
  console.error('[EXCHANGE][ERROR] Invalid API response (no AUDUSD or USDAUD)', { url, data: JSON.stringify(data) });
  return null;
}



