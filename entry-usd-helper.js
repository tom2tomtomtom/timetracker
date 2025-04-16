// entry-usd-helper.js
// Helper to fetch and update USD rate/amount for a time entry after creation
import { fetchAudUsdRate } from './exchange.js';
import * as SupabaseAPI from './supabase.js';

export async function updateEntryUsdFields(entry) {
  try {
    if (!entry || !entry.id || !entry.date || typeof entry.amount !== 'number') {
      console.warn('updateEntryUsdFields: Missing required entry fields', entry);
      return;
    }
    const rate = await fetchAudUsdRate(entry.date);
    if (!rate) {
      console.warn('No exchange rate found for entry:', entry);
      return;
    }
    const amountUsd = entry.amount * rate;
    // Update in DB
    await SupabaseAPI.updateTimeEntry(entry.id, {
      exchange_rate_usd: rate,
      amount_usd: amountUsd,
    });
    // Update in local state if needed
    entry.exchangeRateUsd = rate;
    entry.amountUsd = amountUsd;
    // Optionally, re-render the table/UI
    if (typeof updateTimeEntriesTable === 'function') {
      updateTimeEntriesTable();
    }
  } catch (err) {
    console.error('Failed to update USD fields for entry:', entry, err);
  }
}
