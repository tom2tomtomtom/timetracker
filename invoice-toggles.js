// invoice-toggles.js
// Modern currency and status toggle logic for invoice screen
import { convertAudToUsd } from './usd-converter.js';

/**
 * Injects the currency and status toggles into the invoice UI.
 * Hooks up event listeners for live conversion and status persistence.
 */
export function setupInvoiceToggles() {
  const invoiceDetailsSection = document.querySelector('#invoice-tab .invoice-generator .filter-section');
  if (!invoiceDetailsSection) return;

  // --- Currency Toggle ---
  let currencyToggleRow = document.createElement('div');
  currencyToggleRow.className = 'filter-row';
  currencyToggleRow.innerHTML = `
    <div class="filter-group">
      <label class="toggle-label" for="invoice-currency-toggle">Invoice Currency:</label>
      <label class="toggle-switch">
        <input type="checkbox" id="invoice-currency-toggle">
        <span class="toggle-slider"></span>
        <span class="toggle-label" id="currency-toggle-label">AUD</span>
      </label>
    </div>
    <div class="filter-group">
      <label class="toggle-label" for="invoice-invoiced-toggle">Invoiced:</label>
      <label class="toggle-switch">
        <input type="checkbox" id="invoice-invoiced-toggle">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="filter-group">
      <label class="toggle-label" for="invoice-paid-toggle">Paid:</label>
      <label class="toggle-switch">
        <input type="checkbox" id="invoice-paid-toggle">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;

  // Insert after the last filter-row in invoice details
  invoiceDetailsSection.appendChild(currencyToggleRow);

  // --- Event Listeners ---
  const currencyToggle = document.getElementById('invoice-currency-toggle');
  const currencyLabel = document.getElementById('currency-toggle-label');
  currencyToggle.addEventListener('change', async () => {
    currencyLabel.textContent = currencyToggle.checked ? 'USD' : 'AUD';
    await updateInvoiceCurrency(currencyToggle.checked ? 'USD' : 'AUD');
  });

  // Status toggles (persist logic to be implemented in app.js)
  document.getElementById('invoice-invoiced-toggle').addEventListener('change', (e) => {
    window.setInvoiceStatus && window.setInvoiceStatus('invoiced', e.target.checked);
  });
  document.getElementById('invoice-paid-toggle').addEventListener('change', (e) => {
    window.setInvoiceStatus && window.setInvoiceStatus('paid', e.target.checked);
  });
}

/**
 * Updates the invoice preview and totals to reflect the selected currency.
 * @param {string} currency 'AUD' or 'USD'
 */
async function updateInvoiceCurrency(currency) {
  // This function should call the invoice rendering logic in app.js
  if (window.updateInvoiceCurrency) {
    await window.updateInvoiceCurrency(currency);
  }
}

// Auto-run if on invoice tab
if (document.readyState !== 'loading') setupInvoiceToggles();
else document.addEventListener('DOMContentLoaded', setupInvoiceToggles);
