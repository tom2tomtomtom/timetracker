// App.js - Main application logic (Refactored - V12 Final Debug)

// Imports
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

// --- Application State ---
const appState = {
    entries: [], expenses: [], recurringEntries: [], invoices: [], rates: [],
    settings: { defaultRate: 350, defaultPaymentTerms: 'Net 30', name: '', email: '', address: '', paymentInstructions: '', theme: 'auto', dateFormat: 'MM/DD/YYYY', currency: 'USD' },
    user: null,
    currentTimer: { intervalId: null, startTime: null, pausedTime: 0, isPaused: false },
    currentFormData: null,
    currentInvoicePreview: { filteredEntries: [], filteredExpenses: [], includedEntryIds: new Set(), includedExpenseIds: new Set() },
    currentlyGeneratedInvoice: null,
    autoSaveTimeout: null
};

// --- Utility / Helper Functions --- (Defined FIRST) ---
function showNotification(message, type = 'info') {
    try {
        console.log(`[NOTIFICATION-${type.toUpperCase()}]: ${message}`);
        const notification = document.createElement('div');
        notification.className = `notification ${type}`; // Style with CSS
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3500); // Slightly longer display
    } catch (domError) { console.error("DOM Notification Error:", message, domError); }
}
function getInputValue(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setInputValue(id, value) { const el = document.getElementById(id); if (el) el.value = value ?? ''; }
function setTextContent(id, text) { const el = document.getElementById(id); if (el) el.textContent = text ?? ''; }
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function formatCurrency(amount, currencyCode = appState.settings.currency) {
     if (amount == null || isNaN(amount)) return '$0.00'; // Default fallback
     try {
         return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
     } catch (e) { console.warn(`Currency formatting error for code ${currencyCode}:`, e); return `$${Number(amount).toFixed(2)}`; }
}
function formatDate(dateString, format = appState.settings.dateFormat) {
     if (!dateString) return '';
     try {
         let date;
         if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { date = new Date(dateString + 'T00:00:00Z'); } // Treat YYYY-MM-DD as UTC
         else { date = new Date(dateString); }
         if (isNaN(date.getTime())) throw new Error("Invalid Date");
         const options = {}; const locale = undefined; // Use browser default locale
         switch (format) {
             case 'DD/MM/YYYY': options.day = '2-digit'; options.month = '2-digit'; options.year = 'numeric'; break;
             case 'YYYY-MM-DD': options.year = 'numeric'; options.month = '2-digit'; options.day = '2-digit'; return date.toISOString().slice(0, 10); // ISO is already YYYY-MM-DD
             case 'MM/DD/YYYY': default: options.month = '2-digit'; options.day = '2-digit'; options.year = 'numeric'; break;
         }
          if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { options.timeZone = 'UTC'; } // Format according to UTC if input was date only
         return new Intl.DateTimeFormat(locale, options).format(date);
     } catch (e) { console.warn("Error formatting date:", dateString, e); return dateString; }
}
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... same ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... same ... */ }
function triggerDownload(content, filename, contentType) { /* ... same ... */ }
function readFileAsText(file) { /* ... same ... */ }
function showLoadingIndicator(show) { console.log(`Loading: ${show}`); /* TODO: Visual indicator */ }
function getFormDataFromLocalStorage() { /* ... same ... */ }
function addListener(id, event, handler) { /* ... same ... */ }
function addDelegatedListener(parentElementId, event, selector, handler) { /* ... same ... */ }


// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing app V12 Final Debug...");
    try {
        if (!(await checkSupabaseConnection())) {
            showNotification("Cannot initialize: Database connection issue.", "error"); return;
        }
        console.log("Connection OK. Checking session...");
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();

        if (session?.user) {
            appState.user = session.user; console.log("User logged in:", appState.user.email);
            console.log("InitApp: Attempting to call loadUserData...");
            await loadUserData();
            console.log("InitApp: loadUserData finished. Attempting to call showApp...");
            showApp();
            console.log("InitApp: showApp finished.");
        } else {
            console.log("No session found, showing login.");
            showLoginForm();
        }
    } catch (error) {
        console.error("InitApp: Error during initialization:", error);
        showNotification(`Initialization Error: ${error.message || error}`, "error");
        try { showLoginForm(); } catch (e) { console.error("Failed to show login form after error:", e)}
    }

    try {
         console.log("InitApp: Setting up event listeners...");
         setupEventListeners(); // Setup ALL listeners
         console.log("InitApp: Initializing dashboard module...");
         initDashboard(appState, getDashboardDependencies()); // Init dashboard AFTER listeners maybe? Or check if elements exist first
         setDefaultDates();
         applyTheme(appState.settings.theme);
         console.log("InitApp: Initialization complete.");
    } catch (setupError) {
         console.error("InitApp: Error during setup phase:", setupError);
         showNotification(`Error during app setup: ${setupError.message}`, "error");
    }
}

async function checkSupabaseConnection() { /* ... same ... */ }
function setDefaultDates() { /* ... same ... */ }
async function loadUserData() { /* ... same ... */ }
function showApp() { /* ... same ... */ }
function showLoginForm() { /* ... same ... */ }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same ... */ }
function populateRateTemplates() { /* ... same ... */ }
function updateRateDropdowns() { /* ... same ... */ }

// *** updateTimeEntriesTable with Re-verified DEBUG LOGS ***
function updateTimeEntriesTable() {
    const tableBody = document.getElementById('entries-body');
    if (!tableBody) { console.error("Table body #entries-body not found!"); return; }
    tableBody.innerHTML = '';

    // DEBUG LINE 1
    console.log(`DEBUG: Updating table. Found ${appState.entries?.length ?? 0} entries in appState.`); // Safer length check

    // DEBUG LINE 1.1 - Check if entries array actually has items
    if (!appState.entries || appState.entries.length === 0) {
         console.log("DEBUG: No entries found in appState to display.");
         tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--secondary-text);">No time entries recorded yet.</td></tr>';
         return;
    }

    // Log first entry only if it exists
    if (appState.entries.length > 0) {
        console.log("DEBUG: First entry raw object in appState:", appState.entries[0]);
    }

    const sortedEntries = [...appState.entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedEntries.forEach((entry, index) => {
        // Ensure entry is an object
        if (typeof entry !== 'object' || entry === null) {
            console.error(`DEBUG: Entry at index ${index} is not a valid object:`, entry);
            return; // Skip this invalid entry
        }

        // --- ADDED/MODIFIED DEBUG LINES ---
         if(index === 0) { // Only log details for the first entry
             console.log('DEBUG: Keys of first entry object: ' + Object.keys(entry).join(', ')); // Force string output
             console.log('--- DEBUG: Values for first entry ---');
             console.log('  -> entry.description:', entry.description, `(Type: ${typeof entry.description})`); // Log value AND type
             console.log('  -> entry.client:', entry.client, `(Type: ${typeof entry.client})`);
             console.log('  -> entry.project:', entry.project, `(Type: ${typeof entry.project})`);
             console.log('  -> entry.hours:', entry.hours, `(Type: ${typeof entry.hours})`);
             console.log('  -> entry.rate:', entry.rate, `(Type: ${typeof entry.rate})`);
             console.log('  -> entry.amount:', entry.amount, `(Type: ${typeof entry.amount})`);
             console.log('  -> entry.date:', entry.date, `(Type: ${typeof entry.date})`);
             console.log('  -> entry.id:', entry.id, `(Type: ${typeof entry.id})`);
             console.log('--- End DEBUG Values ---');
         }
         // --- END OF ADDED/MODIFIED DEBUG ---

        const row = tableBody.insertRow();
        // Add checks before formatting/accessing
        const hoursValue = typeof entry.hours === 'number' ? entry.hours : 0;
        const rateValue = typeof entry.rate === 'number' ? entry.rate : 0;
        const amountValue = typeof entry.amount === 'number' ? entry.amount : 0;

        const formattedDate = formatDate(entry.date, appState.settings.dateFormat);
        const formattedRate = formatCurrency(rateValue, appState.settings.currency);
        const formattedAmount = formatCurrency(amountValue, appState.settings.currency);
        const escapedDescription = escapeHtml(entry.description);

        // Log helpers output for first row
         if (index === 0) {
            console.log(`DEBUG HELPERS Out: Date='${formattedDate}', Rate='${formattedRate}', Amount='${formattedAmount}', Desc='${escapedDescription}'`);
         }

        const rowHTML = `
            <td>${formattedDate}</td>
            <td>${escapedDescription}</td>
            <td>${escapeHtml(entry.client || '-')}</td>
            <td>${escapeHtml(entry.project || '-')}</td>
            <td>${hoursValue.toFixed(2)}</td>
            <td>${formattedRate}</td>
            <td>${formattedAmount}</td>
            <td>
                <button class="edit-btn blue-btn" data-id="${entry.id}" style="margin-right: 5px; padding: 5px 10px; font-size: 0.9em;">Edit</button>
                <button class="delete-btn" data-id="${entry.id}" style="padding: 5px 10px; font-size: 0.9em;">Delete</button>
            </td>
        `;

        try {
             row.innerHTML = rowHTML;
        } catch (e) {
            console.error(`Error setting innerHTML for row ${index}:`, e, rowHTML);
        }
    });

    console.log("DEBUG: updateTimeEntriesTable finished populating attempts.");
    console.log("DEBUG: Table body first 300 chars after loop:", tableBody.innerHTML.substring(0, 300));
    // Listeners added via delegation
}
// *** End of modified updateTimeEntriesTable ***

function updateExpensesTable() { /* ... same ... */ }
function updateSummary() { /* ... same ... */ }
function updateClientProjectDropdowns() { /* ... same ... */ }
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... same ... */ }
function populateDatalist(elementId, optionsArray) { /* ... same ... */ }
function updateRecurringEntriesUI() { /* ... same ... */ }
function updateInvoiceHistoryTable() { /* ... same ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() { /* ... same ... */ }
function addListener(id, event, handler) { /* ... same ... */ }
function addDelegatedListener(parentElementId, event, selector, handler) { /* ... same ... */ }
function setupAuthListeners() { /* ... same ... */ }
function setupNavigationListeners() { /* ... same ... */ }
function setupTimeEntryListeners() { /* ... same ... */ }
function setupExpenseListeners() { /* ... same ... */ }
function setupInvoiceListeners() { /* ... same ... */ }
function addInvoiceHistoryActionListeners() { /* ... same ... */ }
function setupReportListeners() { /* ... same ... */ }
function setupSettingsListeners() { /* ... same ... */ }
function addRateActionListeners() { /* ... same ... */ }
function setupDataManagementListeners() { /* ... same ... */ }
function setupDateRangeListeners() { /* ... same ... */ }
function setupAutoSave() { /* ... same ... */ }
function setupDarkModeToggle() { /* ... same ... */ }
function setupDatabaseCheckListener() { /* ... same ... */ }
function addRecurringEntryActionListeners() { /* ... same ... */ }
function getDashboardDependencies() { /* ... same ... */ }

// --- Authentication ---
async function handleLogin(e) { /* ... same ... */ }
async function handleSignup(e) { /* ... same ... */ }
async function handleLogout() { /* ... same ... */ }
function clearUIOnLogout() { /* ... same ... */ }
function toggleAuthForms(showSignup) { /* ... same ... */ }

// --- Settings ---
async function saveCoreSettings() { /* ... same ... */ }
async function saveDisplaySettings() { /* ... same ... */ }
function toggleDarkMode() { /* ... same ... */ }

// --- Rate Templates ---
async function addRateTemplate() { /* ... same ... */ }
function editRateTemplate(id) { /* ... same ... */ }
async function deleteRateTemplate(id) { /* ... same ... */ }

// --- Data Management ---
function exportData() { /* ... same ... */ }
async function importData(e) { /* ... same ... */ }
function exportCSV() { /* ... TODO ... */ }
function applyFilters() { /* ... TODO ... */ }
function clearFilters() { /* ... TODO ... */ }
function clearLocalStorageData() { /* ... same ... */ }
async function clearDatabaseData() { /* ... same ... */ }

// --- Auto Save ---
const AUTO_SAVE_DELAY = 2500;
function handleAutoSaveInput() { /* ... same ... */ }
async function saveCurrentFormData() { /* ... same ... */ }
function loadFormDataIntoForm(formData) { /* ... same ... */ }
async function clearSavedFormData() { /* ... same ... */ }
function showAutoSaveIndicator() { /* ... same ... */ }

// --- Time Entry CRUD ---
async function addTimeEntry() { /* ... same ... */ }
async function updateTimeEntry() { /* ... same ... */ }
function editTimeEntry(id) { /* ... same ... */ }
async function deleteTimeEntry(id) { /* ... same ... */ }
function cancelEdit() { /* ... same ... */ }
function resetTimeEntryForm() { /* ... same ... */ }
function setEditModeUI(isEditing) { /* ... same ... */ }

// --- Timer Functions (Placeholders) ---
function startTimer() { console.log("TODO: Start Timer"); showNotification("Timer Started (Not Implemented)", "info"); }
function pauseTimer() { console.log("TODO: Pause Timer"); showNotification("Timer Paused (Not Implemented)", "info"); }
function resumeTimer() { console.log("TODO: Resume Timer"); showNotification("Timer Resumed (Not Implemented)", "info"); }
function stopAndSaveTimer() { console.log("TODO: Stop & Save Timer"); showNotification("Timer Stopped (Not Implemented)", "info"); }
function cancelTimer() { console.log("TODO: Cancel Timer"); showNotification("Timer Cancelled (Not Implemented)", "info"); }

// --- Expense CRUD --- (Basic implementations)
async function addExpense() { /* ... same ... */ }
function editExpense(id) { /* ... same ... */ }
async function deleteExpense(id) { /* ... same ... */ }

// --- Recurring Entries --- (Basic implementations)
async function saveRecurringEntry() { /* ... same ... */ }
function useRecurringEntry(id) { /* ... same ... */ }
async function deleteRecurringEntry(id) { /* ... same ... */ }

// --- Invoice Generation ---
function filterInvoiceItems(client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses) { /* ... same ... */ }
function viewInvoiceEntries() { /* ... same ... */ }
function updateInvoiceTotalsFromPreview() { /* ... same ... */ }
function handleGenerateInvoiceClick() { /* ... same ... */ }
function generateInvoicePreview() { /* ... same ... */ }
function generateInvoiceHtml(invoiceData) { /* ... same ... */ }
function generateInvoiceNumber() { /* ... same ... */ }
function saveInvoicePdf() { console.log("TODO: Save PDF"); showNotification('Save PDF - Not Implemented', 'info'); }
function exportInvoiceExcel() { console.log("TODO: Export Excel"); showNotification('Export Excel - Not Implemented', 'info'); }
async function markCurrentlyGeneratedInvoicePaid() { /* ... same ... */ }
function viewInvoiceFromHistory(id) { console.log("TODO: View invoice", id); showNotification('View History - Not Implemented', 'info'); }
async function deleteInvoiceFromHistory(id) { console.log("TODO: Delete invoice", id); showNotification('Delete History - Not Implemented', 'info'); }
async function markInvoicePaidFromHistory(id) { console.log("TODO: Mark paid", id); showNotification('Mark Paid History - Not Implemented', 'info'); }

// --- Reports (Stubs) ---
function generateReport() { console.log("TODO: Generate Report"); showNotification('Generate Report - Not Implemented', 'info'); }
function exportReport() { console.log("TODO: Export Report"); showNotification('Export Report - Not Implemented', 'info'); }

// --- Database Setup Check ---
async function showDatabaseSetupModal() { /* ... same ... */ }

// --- Tab Navigation ---
function openTab(evt, tabName) { /* ... same ... */ }

// --- Utility / Helper Functions --- (ALL DEFINED HERE) ---
function getFormDataFromLocalStorage() { /* ... same ... */ }
// showNotification defined earlier
// escapeHtml defined earlier
// formatCurrency defined earlier
// formatDate defined earlier
// calculateDueDate defined earlier
// getDateRangeFromOption defined earlier
// getInputValue defined earlier
// setInputValue defined earlier
// setTextContent defined earlier
// triggerDownload defined earlier
// readFileAsText defined earlier
// showLoadingIndicator defined earlier

// --- Final Log ---
console.log("app.js V12 Final Debug loaded."); // Updated version log
