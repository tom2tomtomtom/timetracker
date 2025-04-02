// App.js - Main application logic (Refactored - V6 Final)

// Imports
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

// --- Application State ---
const appState = {
    entries: [], expenses: [], recurringEntries: [], invoices: [], rates: [],
    settings: {
        defaultRate: 350, defaultPaymentTerms: 'Net 30', name: '', email: '',
        address: '', paymentInstructions: '', theme: 'auto',
        dateFormat: 'MM/DD/YYYY', currency: 'USD',
    },
    user: null,
    currentTimer: { intervalId: null, startTime: null, pausedTime: 0, isPaused: false },
    currentFormData: null,
    currentInvoicePreview: { filteredEntries: [], filteredExpenses: [], includedEntryIds: new Set(), includedExpenseIds: new Set() },
    currentlyGeneratedInvoice: null,
    autoSaveTimeout: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing app V6...");
    if (!(await checkSupabaseConnection())) {
        showNotification("Cannot initialize: Database connection issue.", "error");
        // Consider disabling parts of the UI if connection fails
        return;
    }
    console.log("Checking session...");
    try {
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();
        if (session?.user) {
            appState.user = session.user;
            console.log("User logged in:", appState.user.email);
            await loadUserData();
            showApp();
        } else {
            console.log("No session found, showing login.");
            showLoginForm();
        }
    } catch (error) {
        console.error("Session check error:", error);
        showNotification("Error checking session.", "error");
        showLoginForm();
    }
    setupEventListeners();
    initDashboard(appState, getDashboardDependencies()); // Init dashboard module
    setDefaultDates();
    applyTheme(appState.settings.theme); // Apply theme after settings potentially loaded
}

// Corrected Connection Check
async function checkSupabaseConnection() {
    try {
        console.log("Checking Supabase connection & auth status...");
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();
        if (error) throw error; // Throw error if getSession fails
        console.log("Supabase connection check successful.");
        return true;
    } catch (err) {
        console.error("Supabase connection check error:", err);
        alert(`Database connection error: ${err.message}. Check Supabase config and network.`);
        return false;
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().substring(0, 10);
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });
}

// Corrected loadUserData (uses settings fetch for form_data)
async function loadUserData() {
    if (!appState.user) return;
    console.log("Loading user data...");
    showLoadingIndicator(true); // Show loading indicator
    try {
        const [entries, expensesData, settingsData, recurringData, ratesData, invoiceData] = await Promise.all([
            SupabaseAPI.getTimeEntries(), SupabaseAPI.getExpenses(),
            SupabaseAPI.getSettings(appState.user.id), SupabaseAPI.getRecurringEntries(),
            SupabaseAPI.getRates(), SupabaseAPI.getInvoices(),
        ]);

        appState.entries = entries || [];
        appState.expenses = expensesData || [];
        appState.recurringEntries = recurringData || [];
        appState.rates = ratesData || [];
        appState.invoices = invoiceData || [];

        let loadedFormData = null;
        if (settingsData) {
            loadedFormData = settingsData.formData || settingsData.form_data || null;
            const validSettings = Object.entries(settingsData)
                .filter(([key, value]) => key !== 'formData' && key !== 'form_data' && value !== null && value !== undefined)
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
            appState.settings = { ...appState.settings, ...validSettings };
        }

        applyTheme(appState.settings.theme);

        // Populate UI (order matters sometimes)
        populateSettingsForm();       // Includes updateRateDropdowns
        populateRateTemplates();      // Populates the list of templates
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        updateClientProjectDropdowns();
        updateRecurringEntriesUI();   // Includes addRecurringEntryActionListeners
        updateInvoiceHistoryTable();  // Includes addInvoiceHistoryActionListeners

        // Load auto-saved form data
        appState.currentFormData = loadedFormData || getFormDataFromLocalStorage();
        if (appState.currentFormData) loadFormDataIntoForm(appState.currentFormData);

        console.log("User data loaded.");
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading your data.', 'error');
    } finally {
        showLoadingIndicator(false); // Hide loading indicator
    }
}

// --- UI Updates ---
function showApp() { document.getElementById('login-container').style.display = 'none'; document.getElementById('app-container').style.display = 'block'; }
function showLoginForm() { document.getElementById('login-container').style.display = 'block'; document.getElementById('app-container').style.display = 'none'; }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same ... */ }
function populateRateTemplates() { /* ... same ... */ }
function updateRateDropdowns() { /* ... same ... */ }
function updateTimeEntriesTable() { /* ... same ... */ }
function updateExpensesTable() { /* ... same ... */ }
function updateSummary() { /* ... same ... */ }
function updateClientProjectDropdowns() { /* ... same ... */ }
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... same ... */ }
function populateDatalist(elementId, optionsArray) { /* ... same ... */ }
function updateRecurringEntriesUI() { /* ... same ... */ }
function updateInvoiceHistoryTable() { /* ... same ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() {
    setupAuthListeners(); setupNavigationListeners(); setupTimeEntryListeners();
    setupExpenseListeners(); setupInvoiceListeners(); setupReportListeners();
    setupSettingsListeners(); addRateActionListeners(); setupDataManagementListeners();
    setupDateRangeListeners(); setupAutoSave(); setupDarkModeToggle();
    setupDatabaseCheckListener(); addRecurringEntryActionListeners();
    addInvoiceHistoryActionListeners();
}
// Definitions for ALL setup... and add... Listener functions
function addListener(id, event, handler) { /* ... same ... */ }
function addDelegatedListener(parentElementId, event, selector, handler) { /* ... same ... */ }
function setupAuthListeners() { /* ... same ... */ }
function setupNavigationListeners() { /* ... same ... */ }
function setupTimeEntryListeners() { /* ... same ... */ }
function setupExpenseListeners() { /* ... same ... */ }
function setupInvoiceListeners() { /* ... same, includes confirm button ... */ }
function addInvoiceHistoryActionListeners() { /* ... same ... */ }
function setupReportListeners() { /* ... same ... */ }
function setupSettingsListeners() { /* ... same ... */ }
function addRateActionListeners() { /* ... same ... */ }
function setupDataManagementListeners() { /* ... same, includes danger zone ... */ }
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
async function addRateTemplate() { /* ... same (with basic logic) ... */ }
function editRateTemplate(id) { /* ... same (basic logic) ... */ }
async function deleteRateTemplate(id) { /* ... same (basic logic) ... */ }

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
function setupAutoSave() { /* ... same ... */ }
function handleAutoSaveInput() { /* ... same ... */ }
async function saveCurrentFormData() { /* ... same ... */ }
function loadFormDataIntoForm(formData) { /* ... same ... */ }
async function clearSavedFormData() { /* ... same ... */ }
function showAutoSaveIndicator() {
    let indicator = document.getElementById('autosave-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autosave-indicator'; indicator.textContent = 'Auto-saved';
        indicator.classList.add('autosave-indicator'); // Style with CSS
        document.body.appendChild(indicator);
    }
    indicator.classList.add('visible');
    if (indicator.hideTimeout) clearTimeout(indicator.hideTimeout);
    indicator.hideTimeout = setTimeout(() => {
        indicator.classList.remove('visible');
        indicator.hideTimeout = null;
    }, 2000);
}
// Added missing helper definition
function getFormDataFromLocalStorage() {
    if (!appState.user) return null;
    const saved = localStorage.getItem(`formData_${appState.user.id}`);
    try { return saved ? JSON.parse(saved) : null; }
    catch (e) { console.error("Error parsing localStorage form data", e); return null; }
}


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

// --- Invoice Generation --- (Ensure handleGenerateInvoiceClick definition is present)
function filterInvoiceItems(client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses) { /* ... same ... */ }
function viewInvoiceEntries() { /* ... same ... */ }
function updateInvoiceTotalsFromPreview() { /* ... same ... */ }
// Definition added here
function handleGenerateInvoiceClick() { // Renamed handler
     if (!appState.currentInvoicePreview || (appState.currentInvoicePreview.includedEntryIds.size === 0 && appState.currentInvoicePreview.includedExpenseIds.size === 0)) {
         // If called from Confirm button without viewing first, show preview items
         if (document.getElementById('invoice-entries-preview').style.display === 'none') {
             viewInvoiceEntries(); // Show the preview items first
             if (!appState.currentInvoicePreview || (appState.currentInvoicePreview.includedEntryIds.size === 0 && appState.currentInvoicePreview.includedExpenseIds.size === 0)) {
                return showNotification('View entries first, or no billable items found.', 'warning');
             } else {
                 // If viewInvoiceEntries found items, instruct user to confirm
                 return showNotification('Review items below and click "Confirm Items & Generate Preview" or "Generate Preview" again.', 'info');
             }
         } else {
            // If preview was visible but nothing selected
            return showNotification('No items selected to include in the invoice.', 'warning');
         }
     }
     // If preview data exists and items are selected, proceed
     generateInvoicePreview(); // Proceed with generation using selected items
}
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
function showNotification(message, type = 'info') { /* ... same ... */ }
function escapeHtml(unsafe) { /* ... same ... */ }
function formatCurrency(amount, currencyCode = appState.settings.currency) { /* ... same ... */ }
function formatDate(dateString, format = appState.settings.dateFormat) { /* ... same ... */ }
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... same ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... same ... */ }
function getInputValue(id) { /* ... same ... */ }
function setInputValue(id, value) { /* ... same ... */ }
function setTextContent(id, text) { /* ... same ... */ }
function triggerDownload(content, filename, contentType) { /* ... same ... */ }
function readFileAsText(file) { /* ... same ... */ }
function showLoadingIndicator(show) { // Added basic loading indicator
    // TODO: Add a proper loading indicator element to your HTML/CSS
    console.log(`Loading indicator: ${show ? 'SHOW' : 'HIDE'}`);
    // Example: document.getElementById('loading-spinner').style.display = show ? 'block' : 'none';
}


// --- Final Log ---
console.log("app.js V6 with fixes loaded.");
