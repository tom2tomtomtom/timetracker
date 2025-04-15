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
        
        // Check if USD header already exists
        if (!headerRow.querySelector('th.usd-amount-header')) {
            // Find Amount header
            const amountHeader = headerRow.querySelector('th:nth-child(6)'); // Amount is usually the 6th column
            if (amountHeader) {
                // Add USD header after Amount
                const usdHeader = document.createElement('th');
                usdHeader.className = 'usd-amount-header';
                usdHeader.textContent = 'Amount (USD)';
                amountHeader.insertAdjacentElement('afterend', usdHeader);
            }
        }
    }

    // 2. Modify updateTimeEntriesTable function to show USD amounts
    function patchUpdateTimeEntriesTable() {
        // Keep reference to original function
        const originalUpdateTimeEntriesTable = window.updateTimeEntriesTable;
        
        // Replace with patched version
        window.updateTimeEntriesTable = function() {
            // Call original function first
            originalUpdateTimeEntriesTable.apply(this, arguments);
            
            // Now add USD amounts to the table
            const entriesTable = document.getElementById('time-entries-table');
            if (!entriesTable) return;
            
            // Update header
            updateTimeEntryTableHeader();
            
            // Update rows
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
                
                // Check if USD cell already exists
                let usdCell = row.querySelector('td.entry-amount-usd');
                if (!usdCell) {
                    // Create USD cell
                    usdCell = document.createElement('td');
                    usdCell.className = 'entry-amount-usd';
                    amountCell.insertAdjacentElement('afterend', usdCell);
                }
                
                // Update USD amount
                if (entry.amountUsd !== null && entry.amountUsd !== undefined) {
                    usdCell.textContent = formatCurrency(entry.amountUsd, 'USD');
                } else {
                    usdCell.textContent = 'Not converted';
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
    patchUpdateTimeEntriesTable();
    addCurrencyConverterButton();
    
    // Force update the table to show the changes
    if (window.updateTimeEntriesTable) {
        window.updateTimeEntriesTable();
    }
    
    console.log('USD display patches applied successfully');
}
