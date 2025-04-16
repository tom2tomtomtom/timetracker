// usd-converter.js
// Historical USD conversion utility for TimeTracker
// Uses exchangerate.host API by default (free, no key required, but you can supply your own API key for other providers)

/**
 * Fetches the AUD to USD exchange rate for a specific date.
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string} [apiKey] - Optional API key for premium providers
 * @returns {Promise<number>} The AUD to USD rate for that date
 */
export async function fetchAudUsdRate(date, apiKey) {
  // Default: exchangerate.host (no key needed)
  const url = `https://api.exchangerate.host/${date}?base=AUD&symbols=USD`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch exchange rate');
  const data = await response.json();
  return data.rates.USD;
}

/**
 * Caches rates in localStorage for fast lookup
 */
export async function getCachedAudUsdRate(date, apiKey) {
  const cacheKey = `aud_usd_rate_${date}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return parseFloat(cached);
  const rate = await fetchAudUsdRate(date, apiKey);
  localStorage.setItem(cacheKey, rate);
  return rate;
}

/**
 * Converts an amount in AUD to USD using the historical rate for the entry date
 * @param {number} audAmount
 * @param {string} date - YYYY-MM-DD
 * @param {string} [apiKey]
 * @returns {Promise<number>} USD amount
 */
export async function convertAudToUsd(audAmount, date, apiKey) {
  const rate = await getCachedAudUsdRate(date, apiKey);
  return +(audAmount * rate).toFixed(2);
}
