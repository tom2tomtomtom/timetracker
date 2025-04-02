// App.js - Main application logic (Refactored - V6 Final)

// Imports
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

// --- Application State ---
const appState = {
    entries: [], expenses: [], recurringEntries: [], invoices: [], rates: [],
    settings: { // Default settings (camelCase)
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
    console.log("Initializing app V6..."); // Version log
    if (!(await checkSupabaseConnection())) {
        showNotification("Cannot initialize: Database connection issue.", "error");
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

// CORRECTED Connection Check
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
        // Ensure rates has a default if needed (or handle empty state in UI)
        appState.rates = ratesData || [];
        if (appState.rates.length === 0) {
             // Maybe add a default rate if none exist? Or rely on defaultRate setting?
             console.log("No custom rate templates found in database.");
        }

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

        // Populate UI
        populateSettingsForm();       // Includes updateRateDropdowns
        populateRateTemplates();      // Populates the list of templates
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        updateClientProjectDropdowns();
        updateRecurringEntriesUI();   // Includes addRecurringEntryActionListeners
        updateInvoiceHistoryTable();  // Includes addInvoiceHistoryActionListeners

        // Load auto-saved form data
        appState.currentFormData = loadedFormData || getFormDataFromLocalStorage(); // Helper now defined
        if (appState.currentFormData) {
            loadFormDataIntoForm(appState.currentFormData);
        }
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

// --- Event Listeners Setup --- (Main function calling specific setups)
function setupEventListeners() {
    setupAuthListeners(); setupNavigationListeners(); setupTimeEntryListeners();
    setupExpenseListeners(); setupInvoiceListeners(); setupReportListeners();
    setupSettingsListeners(); addRateActionListeners(); setupDataManagementListeners();
    setupDateRangeListeners(); setupAutoSave(); setupDarkModeToggle();
    setupDatabaseCheckListener(); addRecurringEntryActionListeners();
    addInvoiceHistoryActionListeners();
}

// --- Specific Listener Setup Functions --- (DEFINITIONS NOW INCLUDED) ---
function addListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
    else console.warn(`Listener Warning: Element ID "${id}" not found.`);
}
function addDelegatedListener(parentElementId, event, selector, handler) {
     const parent = document.getElementById(parentElementId);
     if (parent) {
         parent.addEventListener(event, (e) => {
             const targetElement = e.target.closest(selector);
             if (targetElement && parent.contains(targetElement)) {
                 const id = targetElement.getAttribute('data-id');
                 handler(id, targetElement, e);
             }
         });
     } else console.warn(`Delegation Warning: Parent ID "${parentElementId}" not found.`);
}
function setupAuthListeners() {
    addListener('login-form', 'submit', handleLogin);
    addListener('signup-form', 'submit', handleSignup);
    addListener('logout-button', 'click', handleLogout);
    addListener('show-signup-link', 'click', () => toggleAuthForms(true));
    addListener('show-login-link', 'click', () => toggleAuthForms(false));
}
function setupNavigationListeners() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-tab');
            if(tabName) openTab(e, tabName);
        });
    });
}
function setupTimeEntryListeners() {
    addListener('add-entry', 'click', addTimeEntry);
    addListener('update-entry', 'click', updateTimeEntry);
    addListener('cancel-edit', 'click', cancelEdit);
    addListener('save-recurring', 'click', saveRecurringEntry);
    addDelegatedListener('entries-body', 'click', '.edit-btn', editTimeEntry);
    addDelegatedListener('entries-body', 'click', '.delete-btn', deleteTimeEntry);
    // Timer listeners
    addListener('start-timer', 'click', startTimer);
    addListener('pause-timer', 'click', pauseTimer);
    addListener('resume-timer', 'click', resumeTimer);
    addListener('stop-timer', 'click', stopAndSaveTimer);
    addListener('cancel-timer', 'click', cancelTimer);
}
function setupExpenseListeners() {
    addListener('add-expense', 'click', addExpense);
    addDelegatedListener('expenses-body', 'click', '.edit-expense-btn', editExpense);
    addDelegatedListener('expenses-body', 'click', '.delete-expense-btn', deleteExpense);
}
function setupInvoiceListeners() {
    addListener('generate-invoice', 'click', handleGenerateInvoiceClick);
    addListener('view-invoice-entries', 'click', viewInvoiceEntries);
    addListener('confirm-invoice-items', 'click', handleGenerateInvoiceClick);
    const printBtn = document.getElementById('print-invoice');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    addListener('save-invoice-pdf', 'click', saveInvoicePdf);
    addListener('export-invoice-excel', 'click', exportInvoiceExcel);
    addListener('mark-as-paid', 'click', markCurrentlyGeneratedInvoicePaid);
    addDelegatedListener('invoice-entries-preview', 'change', '.include-entry, .include-expense', updateInvoiceTotalsFromPreview);
    // History listeners added separately
}
function addInvoiceHistoryActionListeners() {
     addDelegatedListener('invoice-history-body', 'click', '.view-invoice-btn', viewInvoiceFromHistory);
     addDelegatedListener('invoice-history-body', 'click', '.delete-invoice-btn', deleteInvoiceFromHistory);
     addDelegatedListener('invoice-history-body', 'click', '.mark-paid-hist-btn', markInvoicePaidFromHistory);
}
function setupReportListeners() {
    addListener('generate-report', 'click', generateReport);
    addListener('export-report', 'click', exportReport);
}
function setupSettingsListeners() {
    addListener('save-settings', 'click', saveCoreSettings);
    addListener('save-display-settings', 'click', saveDisplaySettings);
    addListener('add-rate', 'click', addRateTemplate);
    // Delegated listeners for rate items added separately
}
function addRateActionListeners() {
     addDelegatedListener('rates-container', 'click', '.edit-rate-btn', editRateTemplate);
     addDelegatedListener('rates-container', 'click', '.delete-rate-btn', deleteRateTemplate);
}
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
     addListener('clear-local-storage', 'click', clearLocalStorageData);
     addListener('clear-database-data', 'click', clearDatabaseData);
}
function setupDateRangeListeners() {
    const addRangeListener = (selectId, customRangeId) => { /* ... same ... */ };
    addRangeListener('date-range', 'custom-date-range');
    addRangeListener('dash-date-range', 'dash-custom-date-range');
    addRangeListener('invoice-date-range', 'invoice-custom-date-range');
    addRangeListener('report-date-range', 'report-custom-date-range');
}
function setupAutoSave() {
    const fields = ['date', 'description', 'client', 'project', 'hours', 'rate'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('input', handleAutoSaveInput);
            if (field.type === 'date') field.addEventListener('change', handleAutoSaveInput);
        }
    });
}
function setupDarkModeToggle() {
     addListener('dark-mode-toggle', 'click', toggleDarkMode);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (appState.settings.theme === 'auto') applyTheme('auto');
    });
}
function setupDatabaseCheckListener() {
     addListener('check-setup', 'click', showDatabaseSetupModal);
}
function addRecurringEntryActionListeners() {
    addDelegatedListener('recurring-entries-container', 'click', '.use-recurring-btn', useRecurringEntry);
    addDelegatedListener('recurring-entries-container', 'click', '.delete-recurring-btn', deleteRecurringEntry);
}
function getDashboardDependencies() {
    return { Chart: window.Chart, showNotification, formatCurrency, formatDate, getDateRangeFromOption };
}

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
// setupAutoSave defined within setupEventListeners now via call structure
function handleAutoSaveInput() { /* ... same ... */ }
async function saveCurrentFormData() { /* ... same ... */ }
function loadFormDataIntoForm(formData) { /* ... same ... */ }
async function clearSavedFormData() { /* ... same ... */ }
function showAutoSaveIndicator() { /* ... same ... */ }
// getFormDataFromLocalStorage defined in helpers section

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

// --- Invoice Generation --- (handleGenerateInvoiceClick DEFINITION included)
function filterInvoiceItems(client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses) { /* ... same ... */ }
function viewInvoiceEntries() { /* ... same ... */ }
function updateInvoiceTotalsFromPreview() { /* ... same ... */ }
function handleGenerateInvoiceClick() { // Definition is here
     if (!appState.currentInvoicePreview || (appState.currentInvoicePreview.includedEntryIds.size === 0 && appState.currentInvoicePreview.includedExpenseIds.size === 0)) {
         if (document.getElementById('invoice-entries-preview').style.display === 'none') {
             viewInvoiceEntries();
             if (!appState.currentInvoicePreview || (appState.currentInvoicePreview.includedEntryIds.size === 0 && appState.currentInvoicePreview.includedExpenseIds.size === 0)) {
                return showNotification('View entries first, or no billable items found.', 'warning');
             } else { return showNotification('Review items below and click "Confirm Items & Generate Preview" or "Generate Preview" again.', 'info'); }
         } else { return showNotification('No items selected to include in the invoice.', 'warning'); }
     }
     generateInvoicePreview();
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
function getFormDataFromLocalStorage() { // Definition included
    if (!appState.user) return null;
    const saved = localStorage.getItem(`formData_${appState.user.id}`);
    try { return saved ? JSON.parse(saved) : null; }
    catch (e) { console.error("Error parsing localStorage form data", e); return null; }
}
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
function showLoadingIndicator(show) { /* ... same ... */ }

// --- Final Log ---
console.log("app.js V6 with fixes loaded.");
