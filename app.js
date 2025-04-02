// App.js - Main application logic (Refactored - V4 with fixes)

// Assumed imports from other modules
// Ensure these modules exist and export the necessary functions
import * as SupabaseAPI from './supabase.js'; // Assumes this now handles case mapping
import { initDashboard, updateDashboard } from './dashboard.js'; // Will receive appState
import { runSetupChecks } from './setup-check.js';

// --- Application State ---
const appState = {
    entries: [],
    expenses: [],
    recurringEntries: [],
    invoices: [],
    rates: [],
    settings: { // Default settings (camelCase)
        defaultRate: 350,
        defaultPaymentTerms: 'Net 30',
        name: '',
        email: '',
        address: '',
        paymentInstructions: '',
        theme: 'auto',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD',
    },
    user: null,
    currentTimer: { /* ... placeholder ... */ },
    currentFormData: null,
    currentInvoicePreview: {
        filteredEntries: [], filteredExpenses: [],
        includedEntryIds: new Set(), includedExpenseIds: new Set()
    },
    currentlyGeneratedInvoice: null,
    autoSaveTimeout: null
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing app...");

    // Use the CORRECTED connection check
    if (!(await checkSupabaseConnection())) {
        showNotification("Cannot initialize app due to database connection issue.", "error");
        return;
    }

    console.log("Checking for existing user session...");
    try {
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();
        if (session?.user) {
            appState.user = session.user;
            console.log("User is logged in:", appState.user.email);
            await loadUserData(); // Load data relevant to the user
            showApp();
        } else {
            console.log("No user session found, showing login form");
            showLoginForm();
        }
    } catch (error) {
        console.error("Error checking user session:", error);
        showNotification("Error checking session. Please refresh.", "error"); // Now defined
        showLoginForm();
    }

    setupEventListeners();
    initDashboard(appState, getDashboardDependencies());
    setDefaultDates();
    applyTheme(appState.settings.theme);
}

// CORRECTED Connection Check using getSession
async function checkSupabaseConnection() {
    try {
        console.log("Checking Supabase connection & auth status...");
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();
        if (error) {
            console.error("Error checking Supabase connection/session:", error);
            alert(`Database connection error: ${error.message}. Check Supabase config and network.`);
            return false; // Indicate failure
        }
        console.log("Supabase connection and auth check successful.");
        return true; // Indicate success
    } catch (err) {
        console.error("Critical Supabase connection check error:", err);
        alert(`Critical database error: ${err.message}.`);
        return false; // Indicate failure
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().substring(0, 10);
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });
}

// UPDATED loadUserData to simplify form_data fetching
async function loadUserData() {
    if (!appState.user) return;
    console.log("Loading user data...");
    try {
        // Fetch all data concurrently
        // Assumes SupabaseAPI functions return camelCase
        const [entries, expensesData, settingsData, recurringData, ratesData, invoiceData] = await Promise.all([
            SupabaseAPI.getTimeEntries(),
            SupabaseAPI.getExpenses(),
            SupabaseAPI.getSettings(appState.user.id), // Fetches settings including form_data if exists
            SupabaseAPI.getRecurringEntries(),
            SupabaseAPI.getRates(),
            SupabaseAPI.getInvoices(),
            // REMOVED separate call to getFormDataFromDatabase
        ]);

        appState.entries = entries || [];
        appState.expenses = expensesData || [];
        appState.recurringEntries = recurringData || [];
        appState.rates = ratesData || [];
        appState.invoices = invoiceData || [];

        // Load Settings (expects camelCase from SupabaseAPI.getSettings)
        let loadedFormData = null;
        if (settingsData) {
            // Extract form_data before processing/merging other settings
            // Assumes getSettings returns the raw DB column name 'form_data' if not mapped by mapToCamelCase helper
            loadedFormData = settingsData.formData || settingsData.form_data || null; // Handle both cases

            const validSettings = Object.entries(settingsData)
                .filter(([key, value]) => key !== 'formData' && key !== 'form_data' && value !== null && value !== undefined) // Exclude form data field itself
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
            appState.settings = { ...appState.settings, ...validSettings };
        }

        applyTheme(appState.settings.theme);

        // Populate UI
        populateSettingsForm();
        populateRateTemplates();
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        updateClientProjectDropdowns();
        updateRecurringEntriesUI();
        updateInvoiceHistoryTable();

        // Load auto-saved form data (use data from settings fetch, fallback to localStorage)
        appState.currentFormData = loadedFormData || getFormDataFromLocalStorage();
        if (appState.currentFormData) {
            loadFormDataIntoForm(appState.currentFormData);
        }

        console.log("User data loaded successfully.");

    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading your data. Please try again.', 'error'); // Now defined
    }
}

// --- UI Updates ---

function showApp() { /* ... same ... */ }
function showLoginForm() { /* ... same ... */ }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same, calls setInputValue ... */ }
function populateRateTemplates() { /* ... same, calls escapeHtml/formatCurrency ... */ }
function updateRateDropdowns() { /* ... same, calls formatCurrency ... */ }
function updateTimeEntriesTable() { /* ... same, calls formatDate/formatCurrency/escapeHtml ... */ }
function updateExpensesTable() { /* ... same, calls formatDate/formatCurrency/escapeHtml/setTextContent ... */ }
function updateSummary() { /* ... same, calls formatCurrency/setTextContent ... */ }
function updateClientProjectDropdowns() { /* ... same, calls populateDropdown/populateDatalist ... */ }
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... same ... */ }
function populateDatalist(elementId, optionsArray) { /* ... same ... */ }
function updateRecurringEntriesUI() { /* ... same, calls escapeHtml/formatCurrency ... */ }
function updateInvoiceHistoryTable() { /* ... same, calls escapeHtml/formatDate/formatCurrency ... */ }


// --- Event Listeners Setup --- (Includes setup for Danger Zone)

function setupEventListeners() {
    setupAuthListeners();
    setupNavigationListeners();
    setupTimeEntryListeners();
    setupExpenseListeners();
    setupInvoiceListeners();
    setupReportListeners();
    setupSettingsListeners();
    setupDataManagementListeners(); // Includes Danger Zone listeners
    setupDateRangeListeners();
    setupAutoSave();
    setupDarkModeToggle();
    setupDatabaseCheckListener();
    addRecurringEntryActionListeners();
    addRateActionListeners();
    addInvoiceHistoryActionListeners();
}
// ... All other setup... functions remain the same ...
// Example: setupDataManagementListeners includes Danger Zone now
function setupDataManagementListeners() {
    addListener('export-data', 'click', exportData);
    addListener('import-data', 'click', () => document.getElementById('file-input')?.click());
    addListener('file-input', 'change', importData);
    addListener('export-csv', 'click', exportCSV);
    addListener('apply-filters', 'click', applyFilters);
    addListener('clear-filters', 'click', clearFilters);
    addListener('refresh-dashboard', 'click', () => {
        console.log("Refreshing dashboard data...");
        updateDashboard(appState, getDashboardDependencies());
    });
     // Danger Zone
     addListener('clear-local-storage', 'click', clearLocalStorageData);
     addListener('clear-database-data', 'click', clearDatabaseData); // Added listener
}


// --- Authentication --- (No changes)
async function handleLogin(e) { /* ... same ... */ }
async function handleSignup(e) { /* ... same ... */ }
async function handleLogout() { /* ... same ... */ }
function clearUIOnLogout() { /* ... same ... */ }
function toggleAuthForms(showSignup) { /* ... same ... */ }

// --- Settings --- (No changes)
async function saveCoreSettings() { /* ... same ... */ }
async function saveDisplaySettings() { /* ... same ... */ }
function toggleDarkMode() { /* ... same ... */ }

// --- Rate Templates --- (No changes)
async function addRateTemplate() { /* ... same ... */ }
function editRateTemplate(id) { /* ... same ... */ }
async function deleteRateTemplate(id) { /* ... same ... */ }

// --- Data Management --- (Includes Danger Zone functions)
function exportData() { /* ... same ... */ }
async function importData(e) { /* ... same ... */ }
function exportCSV() { /* ... TODO ... */ }
function applyFilters() { /* ... TODO ... */ }
function clearFilters() { /* ... TODO ... */ }

// --- Danger Zone Functions --- (Added)
function clearLocalStorageData() {
    if (confirm("DANGER ZONE! Clear data stored ONLY in this browser (settings, unsaved forms)? Does NOT affect database. Continue?")) {
        const userId = appState.user?.id;
        const currentTheme = appState.settings.theme; // Keep theme maybe?
        localStorage.clear();
        if(userId) localStorage.setItem('userIdForDebug', userId); // Optional debug helper
        // Optionally restore theme preference if desired
        // localStorage.setItem('settings', JSON.stringify({ theme: currentTheme }));
        alert("Local storage cleared for this site. Refreshing...");
        window.location.reload();
    }
}
async function clearDatabaseData() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    if (prompt(`DANGER ZONE! Delete ALL your data (entries, expenses, invoices, rates, etc.) from the database PERMANENTLY? Type DELETE to confirm.`) === 'DELETE') {
         if (confirm("FINAL CONFIRMATION: Are you absolutely sure? This cannot be undone!")) {
             showNotification("Attempting to clear database data...", "warning");
             console.log("TODO: Implement SupabaseAPI.deleteAllUserData(userId)");
             alert("Clear Database Data function not fully implemented in supabase.js yet."); // Placeholder
             // Example:
             // try {
             //    await SupabaseAPI.deleteAllUserData(appState.user.id);
             //    await loadUserData(); // Reload empty state
             //    showNotification("All database data cleared.", "success");
             // } catch (error) { showNotification(`Error clearing data: ${error.message}`, "error"); }
         } else {
             alert("Clear data cancelled.");
         }
    } else {
        alert("Clear data cancelled. Confirmation phrase not entered correctly.");
    }
}


// --- Auto Save --- (No changes)
// ... setupAutoSave, handleAutoSaveInput, saveCurrentFormData, getFormDataFromLocalStorage, loadFormDataIntoForm, clearSavedFormData, showAutoSaveIndicator ...

// --- Time Entry CRUD --- (No changes)
// ... addTimeEntry, updateTimeEntry, editTimeEntry, deleteTimeEntry, cancelEdit, resetTimeEntryForm, setEditModeUI ...

// --- Expense CRUD (Stubs/Basic Implementation) --- (No changes)
async function addExpense() { /* ... same ... */ }
function editExpense(id) { /* ... same ... */ }
async function deleteExpense(id) { /* ... same ... */ }

// --- Recurring Entries (Stubs/Basic Implementation) --- (No changes)
async function saveRecurringEntry() { /* ... same ... */ }
function useRecurringEntry(id) { /* ... same ... */ }
async function deleteRecurringEntry(id) { /* ... same ... */ }

// --- Invoice Generation --- (No changes)
// ... filterInvoiceItems, viewInvoiceEntries, updateInvoiceTotalsFromPreview, handleGenerateInvoiceClick, generateInvoicePreview ...
// ... generateInvoiceHtml, generateInvoiceNumber, saveInvoicePdf, exportInvoiceExcel, markCurrentlyGeneratedInvoicePaid ...
// ... viewInvoiceFromHistory, deleteInvoiceFromHistory, markInvoicePaidFromHistory ...


// --- Reports (Stubs) ---
function generateReport() { /* ... TODO ... */ }
function exportReport() { /* ... TODO ... */ }

// --- Database Setup Check ---
async function showDatabaseSetupModal() { /* ... same as before ... */ }

// --- Tab Navigation ---
function openTab(evt, tabName) { /* ... same as before ... */ }


// --- Utility / Helper Functions --- (Ensure ALL are present) ---

function showNotification(message, type = 'info') {
    try {
        const notification = document.createElement('div');
        // Use classes for styling via CSS: .notification.info, .notification.success, .notification.error
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto remove after ~3 seconds
        setTimeout(() => {
            notification.style.opacity = '0'; // Start fade out
            setTimeout(() => notification.remove(), 500); // Remove after fade
        }, 3000);
    } catch (domError) {
         console.error("Failed to display DOM notification:", message, domError);
         console.log(`[${type.toUpperCase()}] ${message}`); // Fallback log
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatCurrency(amount, currencyCode = appState.settings.currency) {
     if (amount == null || isNaN(amount)) return '$0.00'; // Default fallback
     try {
         return new Intl.NumberFormat(undefined, {
             style: 'currency', currency: currencyCode,
             minimumFractionDigits: 2, maximumFractionDigits: 2
         }).format(amount);
     } catch (e) {
         console.warn(`Currency formatting error for code ${currencyCode}:`, e);
         return `$${Number(amount).toFixed(2)}`; // Basic fallback
     }
}

function formatDate(dateString, format = appState.settings.dateFormat) {
     if (!dateString) return '';
     try {
         // Attempt to handle YYYY-MM-DD strings correctly regardless of local timezone
         let date;
         if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
             date = new Date(dateString + 'T00:00:00Z'); // Treat as UTC midnight
         } else {
             date = new Date(dateString); // Try standard parsing
         }
         if (isNaN(date.getTime())) throw new Error("Invalid Date"); // Check if date is valid

         // Use Intl.DateTimeFormat for locale-aware formatting if possible
         const options = {};
         switch (format) {
             case 'DD/MM/YYYY': options.day = '2-digit'; options.month = '2-digit'; options.year = 'numeric'; break;
             case 'YYYY-MM-DD': options.year = 'numeric'; options.month = '2-digit'; options.day = '2-digit'; return date.toISOString().slice(0, 10); // ISO is already YYYY-MM-DD
             case 'MM/DD/YYYY':
             default: options.month = '2-digit'; options.day = '2-digit'; options.year = 'numeric'; break;
         }
         return new Intl.DateTimeFormat(undefined, options).format(date); // Use browser locale

     } catch (e) {
         console.warn("Error formatting date:", dateString, e);
         return dateString; // Return original on error
     }
}

function calculateDueDate(invoiceDateStr, paymentTerms) {
    try {
        let date;
         if (typeof invoiceDateStr === 'string' && invoiceDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
             date = new Date(invoiceDateStr + 'T00:00:00Z'); // Treat as UTC midnight
         } else {
             date = new Date(invoiceDateStr);
         }
         if (isNaN(date.getTime())) throw new Error("Invalid Date");

        const daysMatch = paymentTerms?.match(/\d+/);
        const days = daysMatch ? parseInt(daysMatch[0], 10) : 30;
        date.setUTCDate(date.getUTCDate() + days); // Add days in UTC

        return formatDate(date, appState.settings.dateFormat); // Format using user pref
    } catch (e) {
        console.warn("Error calculating due date:", e);
        return "N/A";
    }
}

// Note: This uses local time for date comparisons based on options like 'today', 'this-week'
// Consider using a library like date-fns with UTC functions for more robust range handling if needed.
function getDateRangeFromOption(option, fromDateStr, toDateStr) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    let from = new Date(todayStart);
    let to = new Date(todayStart); to.setHours(23, 59, 59, 999); // End of today LOCAL

    switch (option) {
        case 'today': break;
        case 'yesterday':
            from.setDate(from.getDate() - 1);
            to.setDate(to.getDate() - 1);
            break;
        case 'this-week':
            from.setDate(from.getDate() - from.getDay()); // Assumes week starts Sunday
            // to remains end of today
            break;
        case 'last-week':
            to.setDate(to.getDate() - to.getDay() - 1); // End of last Saturday
            from.setDate(to.getDate() - 6); // Start of previous Sunday
             from.setHours(0,0,0,0);
             to.setHours(23,59,59,999);
            break;
        case 'this-month':
            from.setDate(1);
            // to remains end of today
            break;
        case 'last-month':
            to.setDate(0); // End of last day of previous month
            from.setTime(to.getTime()); from.setDate(1); // First day of previous month
            from.setHours(0,0,0,0);
            to.setHours(23,59,59,999);
            break;
        case 'this-year':
            from.setMonth(0, 1); // Jan 1st
            // to remains end of today
            break;
        case 'custom':
            if (fromDateStr && toDateStr) {
                 try {
                    // Parse YYYY-MM-DD as local time start/end
                    from = new Date(fromDateStr + 'T00:00:00');
                    to = new Date(toDateStr + 'T23:59:59.999');
                    if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error("Invalid custom dates");
                 } catch(e) {
                     console.error("Invalid custom date range:", e);
                      from = new Date(todayStart); // Fallback to today
                      to = new Date(todayStart); to.setHours(23,59,59,999);
                 }
            } else { console.warn("Custom dates missing."); }
            break;
        case 'all':
        default:
            from = new Date(2000, 0, 1); // Far past
            to = new Date(2099, 11, 31); // Far future
            break;
    }
    if (from > to) [from, to] = [to, from]; // Swap if needed
    return { from, to };
}

function getInputValue(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setInputValue(id, value) { const el = document.getElementById(id); if (el) el.value = value ?? ''; }
function setTextContent(id, text) { const el = document.getElementById(id); if (el) el.textContent = text ?? ''; }
function triggerDownload(content, filename, contentType) { /* ... same ... */ }
function readFileAsText(file) { /* ... same ... */ }

// --- Final Log ---
console.log("app.js V4 with fixes loaded.");
