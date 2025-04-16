// Apply USD patch to app.js

// Include the original app.js
document.write('<script src="app.js"></script>');

// After the original app.js is loaded, apply our patches
document.addEventListener('DOMContentLoaded', function() {
    // Wait for app.js to be fully loaded
    const checkAppLoaded = setInterval(() => {
        if (window.appState && window.updateTimeEntriesTable) {
            clearInterval(checkAppLoaded);
            applyUsdPatches();
        }
    }, 100);
});

function applyUsdPatches() {
    // 1. Modify time entry table header to include USD column
    function updateTimeEntryTableHeader() {
        const headerRow = document.querySelector('#time-entries-table thead tr');
        if (!headerRow) return;
        
        // Remove any existing USD RATE and AMOUNT (USD) headers to prevent duplicates
        headerRow.querySelectorAll('th.usd-rate-header, th.usd-amount-header').forEach(th => th.remove());
        // Add USD RATE and AMOUNT (USD) headers after Amount column
        const amountHeader = headerRow.querySelector('th:nth-child(6)');
        if (amountHeader) {
            // USD RATE header
            const usdRateHeader = document.createElement('th');
            usdRateHeader.className = 'usd-rate-header';
            usdRateHeader.textContent = 'USD RATE';
            amountHeader.insertAdjacentElement('afterend', usdRateHeader);
            // AMOUNT (USD) header
            const usdAmountHeader = document.createElement('th');
            usdAmountHeader.className = 'usd-amount-header';
            usdAmountHeader.textContent = 'AMOUNT (USD)';
            usdRateHeader.insertAdjacentElement('afterend', usdAmountHeader);
        }
    }

    // 2. Patch updateTimeEntriesTableWithData to always apply USD headers/cells after each render
    function patchUpdateTimeEntriesTableWithData() {
        const originalFn = window.updateTimeEntriesTableWithData;
        window.updateTimeEntriesTableWithData = function(entries) {
            originalFn.apply(this, arguments);
            // Patch header
            updateTimeEntryTableHeader();
            // Patch rows
            const entriesTable = document.getElementById('time-entries-table');
            if (!entriesTable) return;
            const rows = entriesTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const entryId = row.getAttribute('data-id');
                if (!entryId) return;
                // Find entry in app state
                const entry = window.appState.entries.find(e => e.id === entryId);
                if (!entry) return;
                // Find amount cell
                const amountCell = row.querySelector('td:nth-child(6)'); // Amount is usually the 6th column
                if (!amountCell) return;
                // Remove existing USD cells to prevent duplicates
                row.querySelectorAll('td.entry-usd-rate, td.entry-amount-usd').forEach(td => td.remove());
                // USD RATE cell
                const usdRateCell = document.createElement('td');
                usdRateCell.className = 'entry-usd-rate';
                // USD AMOUNT cell
                const usdCell = document.createElement('td');
                usdCell.className = 'entry-amount-usd';
                // Insert after amountCell
                amountCell.insertAdjacentElement('afterend', usdRateCell);
                usdRateCell.insertAdjacentElement('afterend', usdCell);
                // Update USD rate
                if (entry.usdRate !== null && entry.usdRate !== undefined && !isNaN(entry.usdRate)) {
                    usdRateCell.textContent = entry.usdRate.toFixed(6);
                    usdRateCell.style.color = '';
                    usdRateCell.style.fontStyle = '';
                } else {
                    usdRateCell.textContent = 'Rate not yet available (try again tomorrow)';
                    usdRateCell.style.color = '#6c757d';
                    usdRateCell.style.fontStyle = 'italic';
                }
                // Update USD amount
                if (entry.amountUsd !== null && entry.amountUsd !== undefined && !isNaN(entry.amountUsd)) {
                    usdCell.textContent = formatCurrency(entry.amountUsd, 'USD');
                    usdCell.style.color = '';
                    usdCell.style.fontStyle = '';
                } else {
                    usdCell.textContent = 'Rate not yet available (try again tomorrow)';
                    usdCell.style.color = '#6c757d';
                    usdCell.style.fontStyle = 'italic';
                }
                // Remove any Err text in these columns if present
                if (usdRateCell.textContent === 'Err') {
                    usdRateCell.textContent = 'Rate not yet available (try again tomorrow)';
                    usdRateCell.style.color = '#6c757d';
                    usdRateCell.style.fontStyle = 'italic';
                }
                if (usdCell.textContent === 'Err') {
                    usdCell.textContent = 'Rate not yet available (try again tomorrow)';
                    usdCell.style.color = '#6c757d';
                    usdCell.style.fontStyle = 'italic';
                }
            });
        };
    }

    // 3. Add a button to access the currency converter
    function addCurrencyConverterButton() {
        // Add to time tracking tab
        const actionsContainer = document.querySelector('#time-tracking-tab .actions');
        if (actionsContainer) {
            // Check if button already exists
            if (!document.getElementById('currency-convert-button')) {
                const convertButton = document.createElement('button');
                convertButton.id = 'currency-convert-button';
                convertButton.className = 'blue-btn';
                convertButton.innerHTML = '$ Convert Currency';
                convertButton.title = 'Convert AUD to USD for all entries';
                
                // Add click handler
                convertButton.addEventListener('click', () => {
                    window.location.href = 'currency-converter.html';
                });
                
                // Add to UI
                actionsContainer.appendChild(convertButton);
            }
        }
    }

    // Apply all patches
    patchUpdateTimeEntriesTableWithData();
    addCurrencyConverterButton();
    // Force update the table to show the changes
    if (window.updateTimeEntriesTable) {
        window.updateTimeEntriesTable();
    }
    console.log('USD display patches applied successfully');
}
