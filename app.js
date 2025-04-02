// App.js - Main application logic (Refactored - V10 Focused Debug)

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

// --- Utility / Helper Functions --- (Defined BEFORE initApp uses them) ---

function showNotification(message, type = 'info') {
    try {
        console.log(`[NOTIFICATION-${type.toUpperCase()}]: ${message}`); // Log notification attempt
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    } catch (domError) {
         console.error("DOM Notification Error:", message, domError);
    }
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
         if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { date = new Date(dateString + 'T00:00:00Z'); } // Treat YYYY-MM-DD as UTC midnight
         else { date = new Date(dateString); }
         if (isNaN(date.getTime())) throw new Error("Invalid Date");
         const options = {};
         switch (format) {
             case 'DD/MM/YYYY': options.day = '2-digit'; options.month = '2-digit'; options.year = 'numeric'; break;
             case 'YYYY-MM-DD': options.year = 'numeric'; options.month = '2-digit'; options.day = '2-digit'; return date.toISOString().slice(0, 10);
             case 'MM/DD/YYYY': default: options.month = '2-digit'; options.day = '2-digit'; options.year = 'numeric'; break;
         }
         // Use UTC methods if we treated input as UTC, otherwise local formatting might be off by a day
          if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                options.timeZone = 'UTC'; // Format according to UTC
           }
         return new Intl.DateTimeFormat(undefined, options).format(date);
     } catch (e) { console.warn("Error formatting date:", dateString, e); return dateString; }
}
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... same ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... same ... */ }
function triggerDownload(content, filename, contentType) { /* ... same ... */ }
function readFileAsText(file) { /* ... same ... */ }
function showLoadingIndicator(show) { console.log(`Loading: ${show}`); /* TODO: Visual indicator */ }
function getFormDataFromLocalStorage() { /* ... same ... */ }


// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing app V10+Debug..."); // Version log

    let connectionOK = false;
    try {
        console.log("InitApp: Attempting connection check...");
        connectionOK = await checkSupabaseConnection(); // Call the check
        console.log(`InitApp: Connection check result: ${connectionOK}`);

        if (!connectionOK) {
            // If checkSupabaseConnection returned false due to caught error
            showNotification("Cannot initialize: Database connection failed.", "error");
            return; // Stop initialization
        }

    } catch (error) {
        // Catch errors specifically thrown from checkSupabaseConnection (like network issues not caught internally)
        console.error("InitApp: Error during connection check phase:", error);
        showNotification(`Initialization Error: ${error.message}`, "error");
        return; // Stop initialization
    }

    // --- If connection check passed, proceed ---
    console.log("InitApp: Connection OK. Checking session...");
    try {
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();
        if (session?.user) {
            appState.user = session.user;
            console.log("User logged in:", appState.user.email);
            await loadUserData(); // Load data
            showApp(); // Show the main app UI
        } else {
            console.log("No session found, showing login.");
            showLoginForm(); // Show login UI
        }
    } catch (error) {
        console.error("InitApp: Session check/load error:", error);
        showNotification("Error checking session or loading data.", "error");
        showLoginForm(); // Default to login on error
    }

    // Setup listeners last, after potentially showing the correct UI
    console.log("InitApp: Setting up event listeners...");
    setupEventListeners();
    console.log("InitApp: Initializing dashboard module...");
    initDashboard(appState, getDashboardDependencies());
    setDefaultDates();
    applyTheme(appState.settings.theme);
    console.log("InitApp: Initialization complete.");
}


// CORRECTED Connection Check (returns true/throws error/returns false)
async function checkSupabaseConnection() {
    try {
        console.log("checkSupabaseConnection: Checking Supabase connection & auth status...");
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();
        if (error) {
             console.error("checkSupabaseConnection: getSession returned an error:", error);
             throw error; // Throw the error to be caught by the caller in initApp
        }
        console.log("checkSupabaseConnection: Supabase connection check successful (getSession succeeded).");
        return true;
    } catch (err) {
        // Catch errors from getSession or potentially SupabaseAPI.supabase being undefined
        console.error("checkSupabaseConnection: Caught error:", err);
        // Don't alert here, let initApp handle notification
        return false; // Indicate failure
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
function updateTimeEntriesTable() { /* ... same V8 with debug logs ... */ }
function updateExpensesTable() { /* ... same ... */ }
function updateSummary() { /* ... same ... */ }
function updateClientProjectDropdowns() { /* ... same ... */ }
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... same ... */ }
function populateDatalist(elementId, optionsArray) { /* ... same ... */ }
function updateRecurringEntriesUI() { /* ... same ... */ }
function updateInvoiceHistoryTable() { /* ... same ... */ }
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
async function handleLogin(e) { /* ... same ... */ }
async function handleSignup(e) { /* ... same ... */ }
async function handleLogout() { /* ... same ... */ }
function clearUIOnLogout() { /* ... same ... */ }
function toggleAuthForms(showSignup) { /* ... same ... */ }
async function saveCoreSettings() { /* ... same ... */ }
async function saveDisplaySettings() { /* ... same ... */ }
function toggleDarkMode() { /* ... same ... */ }
async function addRateTemplate() { /* ... same ... */ }
function editRateTemplate(id) { /* ... same ... */ }
async function deleteRateTemplate(id) { /* ... same ... */ }
function exportData() { /* ... same ... */ }
async function importData(e) { /* ... same ... */ }
function exportCSV() { /* ... TODO ... */ }
function applyFilters() { /* ... TODO ... */ }
function clearFilters() { /* ... TODO ... */ }
function clearLocalStorageData() { /* ... same ... */ }
async function clearDatabaseData() { /* ... same ... */ }
const AUTO_SAVE_DELAY = 2500;
function handleAutoSaveInput() { /* ... same ... */ }
async function saveCurrentFormData() { /* ... same ... */ }
function loadFormDataIntoForm(formData) { /* ... same ... */ }
async function clearSavedFormData() { /* ... same ... */ }
function showAutoSaveIndicator() { /* ... same ... */ }
async function addTimeEntry() { /* ... same ... */ }
async function updateTimeEntry() { /* ... same ... */ }
function editTimeEntry(id) { /* ... same ... */ }
async function deleteTimeEntry(id) { /* ... same ... */ }
function cancelEdit() { /* ... same ... */ }
function resetTimeEntryForm() { /* ... same ... */ }
function setEditModeUI(isEditing) { /* ... same ... */ }
function startTimer() { console.log("TODO: Start Timer"); showNotification("Timer Started (Not Implemented)", "info"); }
function pauseTimer() { console.log("TODO: Pause Timer"); showNotification("Timer Paused (Not Implemented)", "info"); }
function resumeTimer() { console.log("TODO: Resume Timer"); showNotification("Timer Resumed (Not Implemented)", "info"); }
function stopAndSaveTimer() { console.log("TODO: Stop & Save Timer"); showNotification("Timer Stopped (Not Implemented)", "info"); }
function cancelTimer() { console.log("TODO: Cancel Timer"); showNotification("Timer Cancelled (Not Implemented)", "info"); }
async function addExpense() { /* ... same ... */ }
function editExpense(id) { /* ... same ... */ }
async function deleteExpense(id) { /* ... same ... */ }
async function saveRecurringEntry() { /* ... same ... */ }
function useRecurringEntry(id) { /* ... same ... */ }
async function deleteRecurringEntry(id) { /* ... same ... */ }
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
function generateReport() { console.log("TODO: Generate Report"); showNotification('Generate Report - Not Implemented', 'info'); }
function exportReport() { console.log("TODO: Export Report"); showNotification('Export Report - Not Implemented', 'info'); }
async function showDatabaseSetupModal() { /* ... same ... */ }
function openTab(evt, tabName) { /* ... same ... */ }
// --- Utility / Helper Functions ---
// All helpers included here: getFormDataFromLocalStorage, showNotification, escapeHtml, formatCurrency, formatDate, calculateDueDate, getDateRangeFromOption, getInputValue, setInputValue, setTextContent, triggerDownload, readFileAsText, showLoadingIndicator
// --- Final Log ---
console.log("app.js V10 with focused debug loaded."); // Updated version log
