// App.js - Main application logic (Refactored - V11 Final)

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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

// initApp with More Logging around potentially failing calls
async function initApp() {
    console.log("Initializing app V11 Final..."); // Version log
    try {
        if (!(await checkSupabaseConnection())) {
             showNotification("Cannot initialize: Database connection issue.", "error"); return;
        }
        console.log("Connection OK. Checking session...");
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();

        if (session?.user) {
            appState.user = session.user; console.log("User logged in:", appState.user.email);
            console.log("InitApp: Attempting to call loadUserData...");
            await loadUserData(); // Load data
            console.log("InitApp: loadUserData finished. Attempting to call showApp...");
            showApp(); // Show the main app UI
             console.log("InitApp: showApp finished.");
        } else {
            console.log("No session found, showing login.");
            showLoginForm(); // Show login UI
        }
    } catch (error) {
        console.error("InitApp: Error during initialization:", error);
        showNotification(`Initialization Error: ${error.message || error}`, "error");
        // Attempt to show login form as a fallback on error
        try { showLoginForm(); } catch (e) { console.error("Failed to show login form after error:", e)}
    }

    // Setup listeners last, after potentially showing the correct UI
    try {
         console.log("InitApp: Setting up event listeners...");
         setupEventListeners();
         console.log("InitApp: Initializing dashboard module...");
         initDashboard(appState, getDashboardDependencies());
         setDefaultDates();
         applyTheme(appState.settings.theme); // Apply theme based on loaded/default settings
         console.log("InitApp: Initialization complete.");
    } catch (setupError) {
         console.error("InitApp: Error during setup phase:", setupError);
         showNotification(`Error during app setup: ${setupError.message}`, "error");
    }
}

// CORRECTED Connection Check
async function checkSupabaseConnection() {
    try {
        console.log("checkSupabaseConnection: Checking...");
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();
        if (error) throw error;
        console.log("checkSupabaseConnection: OK.");
        return true;
    } catch (err) {
        console.error("checkSupabaseConnection: FAILED:", err);
        return false; // Let initApp handle notification
    }
}

function setDefaultDates() { /* ... same ... */ }
async function loadUserData() { /* ... same ... */ }
function showApp() { /* ... same ... */ }
function showLoginForm() { /* ... same ... */ }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same ... */ }
function populateRateTemplates() { /* ... same ... */ }
function updateRateDropdowns() { /* ... same ... */ }
function updateTimeEntriesTable() { /* ... same V8 with debug logs REMOVED for final ... */
     const tableBody = document.getElementById('entries-body');
    if (!tableBody) { console.error("Table body #entries-body not found!"); return; }
    tableBody.innerHTML = '';
    const sortedEntries = [...appState.entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedEntries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--secondary-text);">No time entries recorded yet.</td></tr>';
        return;
    }
    sortedEntries.forEach((entry) => {
        const row = tableBody.insertRow();
        const formattedDate = formatDate(entry.date, appState.settings.dateFormat);
        const formattedRate = formatCurrency(entry.rate, appState.settings.currency);
        const formattedAmount = formatCurrency(entry.amount, appState.settings.currency);
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHtml(entry.description)}</td>
            <td>${escapeHtml(entry.client || '-')}</td>
            <td>${escapeHtml(entry.project || '-')}</td>
            <td>${(entry.hours || 0).toFixed(2)}</td>
            <td>${formattedRate}</td>
            <td>${formattedAmount}</td>
            <td>
                <button class="edit-btn blue-btn" data-id="${entry.id}" style="margin-right: 5px; padding: 5px 10px; font-size: 0.9em;">Edit</button>
                <button class="delete-btn" data-id="${entry.id}" style="padding: 5px 10px; font-size: 0.9em;">Delete</button>
            </td>
        `;
    });
    // Listeners added via delegation
}
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
function exportCSV() { console.log("TODO: Export CSV"); showNotification('Export CSV - Not Implemented', 'info'); }
function applyFilters() { console.log("TODO: Apply Filters"); showNotification('Apply Filters - Not Implemented', 'info'); }
function clearFilters() { console.log("TODO: Clear Filters"); showNotification('Clear Filters - Not Implemented', 'info'); }
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
console.log("app.js V11 Final loaded."); // Updated version log
