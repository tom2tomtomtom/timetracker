// currency-helper.js - Simple utility for currency conversion
// Note: Keep your API key in a .env file or input it manually

/**
 * Get exchange rate for a specific date using OpenAI API
 * @param {string} fromCurrency - Source currency code (e.g., 'AUD')
 * @param {string} toCurrency - Target currency code (e.g., 'USD')
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number>} - Exchange rate
 */
async function getExchangeRate(fromCurrency, toCurrency, date, apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a financial analysis assistant that provides exchange rate data. Reply ONLY with the numerical value, nothing else.'
                    },
                    {
                        role: 'user',
                        content: `What was the exchange rate from ${fromCurrency} to ${toCurrency} on ${date}? Provide only the numerical value, with 4 decimal places.`
                    }
                ],
                temperature: 0.1
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract the exchange rate from the response
        const rateText = data.choices[0].message.content.trim();
        const rate = parseFloat(rateText);
        
        if (isNaN(rate)) {
            throw new Error(`Could not parse exchange rate: ${rateText}`);
        }
        
        return rate;
    } catch (error) {
        console.error(`Error getting exchange rate for ${date}:`, error);
        // Fallback to a default rate if API fails
        return 0.7; // Example fallback AUD to USD rate
    }
}

/**
 * Convert all time entries in Supabase database from AUD to USD
 * @param {Object} supabase - Initialized Supabase client
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} - Result of conversion operation
 */
async function convertAllEntries(supabase, apiKey) {
    try {
        // Get all entries without USD amount
        const { data: entries, error } = await supabase
            .from('time_entries')
            .select('*')
            .is('amount_usd', null);
            
        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }
        
        if (!entries || entries.length === 0) {
            return { success: true, processed: 0, failed: 0, message: 'No entries to convert' };
        }
        
        let processed = 0;
        let failed = 0;
        
        // Cache for exchange rates to avoid redundant API calls
        const exchangeRateCache = {};
        
        // Show progress in UI
        updateConversionStatus(`Converting ${entries.length} entries...`, 'info');
        updateConversionProgress(0, entries.length);
        
        // Process entries in batches to avoid rate limits
        const batchSize = 3;
        const batches = [];
        for (let i = 0; i < entries.length; i += batchSize) {
            batches.push(entries.slice(i, i + batchSize));
        }
        
        let completedCount = 0;
        
        // Process batches sequentially
        for (const batch of batches) {
            await Promise.all(batch.map(async (entry) => {
                try {
                    // Get cached rate or fetch new rate
                    const cacheKey = `AUD_USD_${entry.date}`;
                    let rate = exchangeRateCache[cacheKey];
                    
                    if (!rate) {
                        rate = await getExchangeRate('AUD', 'USD', entry.date, apiKey);
                        exchangeRateCache[cacheKey] = rate;
                    }
                    
                    // Calculate USD amount
                    const amountUsd = parseFloat((entry.amount * rate).toFixed(2));
                    
                    // Update entry in database
                    const { error: updateError } = await supabase
                        .from('time_entries')
                        .update({ amount_usd: amountUsd })
                        .eq('id', entry.id);
                        
                    if (updateError) {
                        console.error(`Error updating entry ${entry.id}:`, updateError);
                        failed++;
                    } else {
                        processed++;
                        
                        // Update entry in UI if it's displayed
                        updateEntryInUI(entry.id, amountUsd);
                    }
                } catch (entryError) {
                    console.error(`Error processing entry ${entry.id}:`, entryError);
                    failed++;
                } finally {
                    completedCount++;
                    updateConversionProgress(completedCount, entries.length);
                }
            }));
            
            // Add delay between batches to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return { 
            success: true, 
            processed, 
            failed,
            message: `Processed ${processed} entries${failed > 0 ? ` with ${failed} errors` : ''}`
        };
    } catch (error) {
        console.error('Process entries error:', error);
        updateConversionStatus(`Error: ${error.message}`, 'error');
        return { 
            success: false, 
            processed: 0, 
            failed: 0,
            message: error.message || 'Unknown error processing entries'
        };
    }
}

/**
 * Update conversion status in UI
 * @param {string} message - Status message
 * @param {string} type - Message type (info, success, error)
 */
function updateConversionStatus(message, type = 'info') {
    const statusEl = document.getElementById('conversion-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}

/**
 * Update conversion progress in UI
 * @param {number} current - Current progress
 * @param {number} total - Total items
 */
function updateConversionProgress(current, total) {
    const progressEl = document.getElementById('conversion-progress');
    if (!progressEl) return;
    
    const percent = (current / total) * 100;
    progressEl.style.width = `${percent}%`;
    
    const progressTextEl = document.getElementById('conversion-progress-text');
    if (progressTextEl) {
        progressTextEl.textContent = `${current} / ${total} entries processed`;
    }
}

/**
 * Update entry USD amount in UI
 * @param {string} entryId - Entry ID
 * @param {number} amountUsd - USD amount
 */
function updateEntryInUI(entryId, amountUsd) {
    // Find entry row by ID
    const row = document.querySelector(`tr[data-entry-id="${entryId}"]`);
    if (!row) return;
    
    // Find or create USD amount cell
    let usdCell = row.querySelector('.entry-amount-usd');
    if (!usdCell) {
        const amountCell = row.querySelector('.entry-amount');
        if (!amountCell) return;
        
        // Create USD cell if it doesn't exist
        usdCell = document.createElement('td');
        usdCell.className = 'entry-amount-usd';
        amountCell.insertAdjacentElement('afterend', usdCell);
    }
    
    // Update USD amount
    usdCell.textContent = `$${amountUsd.toFixed(2)} USD`;
}

// Export functions for use in other scripts
window.CurrencyHelper = {
    getExchangeRate,
    convertAllEntries,
    updateConversionStatus,
    updateConversionProgress,
    updateEntryInUI
};
