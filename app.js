// App.js - Main application logic (Refactored - V5 with all fixes)

// Assumed imports from other modules
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
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
        name: '', email: '', address: '', paymentInstructions: '',
        theme: 'auto', dateFormat: 'MM/DD/YYYY', currency: 'USD',
    },
    user: null,
    currentTimer: { intervalId: null, startTime: null, pausedTime: 0, isPaused: false },
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
    console.log("Initializing app V5...");
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
    setupEventListeners(); // Setup listeners regardless of login state
    initDashboard(appState, getDashboardDependencies()); // Init dashboard module
    setDefaultDates();
    applyTheme(appState.settings.theme); // Apply theme after settings potentially loaded
}

// Corrected Connection Check
async function checkSupabaseConnection() {
    try {
        console.log("Checking Supabase connection...");
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();
        if (error) throw error; // Throw error if getSession fails
        console.log("Supabase connection check successful.");
        return true;
    } catch (err) {
        console.error("Supabase connection check error:", err);
        alert(`Database connection error: ${err.message}. Check config/network.`);
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
    try {
        const [entries, expensesData, settingsData, recurringData, ratesData, invoiceData] = await Promise.all([
            SupabaseAPI.getTimeEntries(),
            SupabaseAPI.getExpenses(),
            SupabaseAPI.getSettings(appState.user.id), // Fetches settings including form_data
            SupabaseAPI.getRecurringEntries(),
            SupabaseAPI.getRates(),
            SupabaseAPI.getInvoices(),
        ]);

        appState.entries = entries || [];
        appState.expenses = expensesData || [];
        appState.recurringEntries = recurringData || [];
        appState.rates = ratesData || [];
        appState.invoices = invoiceData || [];

        let loadedFormData = null;
        if (settingsData) {
            // Extract form_data before merging other settings
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

        // Load auto-saved form data (use data from settings fetch, fallback to localStorage)
        appState.currentFormData = loadedFormData || getFormDataFromLocalStorage(); // Now defined
        if (appState.currentFormData) {
            loadFormDataIntoForm(appState.currentFormData);
        }
        console.log("User data loaded.");
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading your data.', 'error'); // Now defined
    }
}

// --- UI Updates ---
function showApp() { /* ... same ... */ }
function showLoginForm() { /* ... same ... */ }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same, calls setInputValue/updateRateDropdowns ... */ }
function populateRateTemplates() { /* ... same, calls escapeHtml/formatCurrency/addRateActionListeners ... */ }
function updateRateDropdowns() { /* ... same, calls formatCurrency ... */ }
function updateTimeEntriesTable() { /* ... same, calls formatDate/formatCurrency/escapeHtml ... */ }
function updateExpensesTable() { /* ... same, calls formatDate/formatCurrency/escapeHtml/setTextContent ... */ }
function updateSummary() { /* ... same, calls formatCurrency/setTextContent ... */ }
function updateClientProjectDropdowns() { /* ... same, calls populateDropdown/populateDatalist ... */ }
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... same ... */ }
function populateDatalist(elementId, optionsArray) { /* ... same ... */ }
function updateRecurringEntriesUI() { /* ... same, calls escapeHtml/formatCurrency/addRecurringEntryActionListeners ... */ }
function updateInvoiceHistoryTable() { /* ... same, calls escapeHtml/formatDate/formatCurrency/addInvoiceHistoryActionListeners ... */ }


// --- Event Listeners Setup --- (Main function calling specific setups)

function setupEventListeners() {
    setupAuthListeners();
    setupNavigationListeners();
    setupTimeEntryListeners();
    setupExpenseListeners();
    setupInvoiceListeners();
    setupReportListeners();
    setupSettingsListeners(); // Includes Rate Template Add/Save
    addRateActionListeners(); // Adds listeners for dynamically created rate items
    setupDataManagementListeners(); // Includes Filters & Danger Zone
    setupDateRangeListeners();
    setupAutoSave();
    setupDarkModeToggle();
    setupDatabaseCheckListener();
    addRecurringEntryActionListeners(); // Adds listeners for dynamic recurring items
    addInvoiceHistoryActionListeners(); // Adds listeners for dynamic history items
}

// --- Specific Listener Setup Functions --- (DEFINITIONS ADDED) ---

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
    addListener('start-timer', 'click', startTimer); // TODO: Implement startTimer
    addListener('pause-timer', 'click', pauseTimer); // TODO: Implement pauseTimer
    addListener('resume-timer', 'click', resumeTimer); // TODO: Implement resumeTimer
    addListener('stop-timer', 'click', stopAndSaveTimer); // TODO: Implement stopAndSaveTimer
    addListener('cancel-timer', 'click', cancelTimer); // TODO: Implement cancelTimer
}

function setupExpenseListeners() {
    addListener('add-expense', 'click', addExpense);
    addDelegatedListener('expenses-body', 'click', '.edit-expense-btn', editExpense);
    addDelegatedListener('expenses-body', 'click', '.delete-expense-btn', deleteExpense);
}

function setupInvoiceListeners() {
    addListener('generate-invoice', 'click', handleGenerateInvoiceClick);
    addListener('view-invoice-entries', 'click', viewInvoiceEntries);
    addListener('confirm-invoice-items', 'click', handleGenerateInvoiceClick); // Confirm also generates preview
    const printBtn = document.getElementById('print-invoice');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    addListener('save-invoice-pdf', 'click', saveInvoicePdf);
    addListener('export-invoice-excel', 'click', exportInvoiceExcel);
    addListener('mark-as-paid', 'click', markCurrentlyGeneratedInvoicePaid);
    addDelegatedListener('invoice-entries-preview', 'change', '.include-entry, .include-expense', updateInvoiceTotalsFromPreview);
    // History listeners added separately after table population
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
    // Delegated listeners for rate items added by addRateActionListeners
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
    const addRangeListener = (selectId, customRangeId) => {
        const select = document.getElementById(selectId);
        const customRange = document.getElementById(customRangeId);
        if (select && customRange) {
            select.addEventListener('change', () => {
                customRange.style.display = select.value === 'custom' ? 'flex' : 'none';
            });
            customRange.style.display = select.value === 'custom' ? 'flex' : 'none'; // Initial state
        }
    };
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

// Helper to get dependencies for dashboard
function getDashboardDependencies() {
    return {
        Chart: window.Chart, showNotification, formatCurrency, formatDate, getDateRangeFromOption
    };
}

// --- Authentication --- (No changes needed)
async function handleLogin(e) { /* ... */ }
async function handleSignup(e) { /* ... */ }
async function handleLogout() { /* ... */ }
function clearUIOnLogout() { /* ... */ }
function toggleAuthForms(showSignup) { /* ... */ }

// --- Settings --- (No changes needed)
async function saveCoreSettings() { /* ... */ }
async function saveDisplaySettings() { /* ... */ }
function toggleDarkMode() { /* ... */ }

// --- Rate Templates ---
async function addRateTemplate() { /* ... (basic implementation added previously) ... */ }
function editRateTemplate(id) { /* ... (basic implementation added previously) ... */ }
async function deleteRateTemplate(id) { /* ... (basic implementation added previously) ... */ }

// --- Data Management ---
function exportData() { /* ... */ }
async function importData(e) { /* ... */ }
function exportCSV() { /* ... TODO ... */ }
function applyFilters() { /* ... TODO ... */ }
function clearFilters() { /* ... TODO ... */ }
function clearLocalStorageData() { /* ... */ }
async function clearDatabaseData() { /* ... */ }

// --- Auto Save ---
// ... setupAutoSave, handleAutoSaveInput, saveCurrentFormData, loadFormDataIntoForm, clearSavedFormData, showAutoSaveIndicator ...
// Added getFormDataFromLocalStorage helper below

// --- Time Entry CRUD ---
async function addTimeEntry() { /* ... (implementation from V3) ... */ }
async function updateTimeEntry() { /* ... (implementation from V3) ... */ }
function editTimeEntry(id) { /* ... (implementation from V3) ... */ }
async function deleteTimeEntry(id) { /* ... (implementation from V3) ... */ }
function cancelEdit() { /* ... (implementation from V3) ... */ }
function resetTimeEntryForm() { /* ... (implementation from V3) ... */ }
function setEditModeUI(isEditing) { /* ... (implementation from V3) ... */ }

// --- Timer Functions (Placeholders) --- TODO: Implement fully
function startTimer() { console.log("TODO: Start Timer"); showNotification("Timer Started (Not Implemented)", "info"); }
function pauseTimer() { console.log("TODO: Pause Timer"); showNotification("Timer Paused (Not Implemented)", "info"); }
function resumeTimer() { console.log("TODO: Resume Timer"); showNotification("Timer Resumed (Not Implemented)", "info"); }
function stopAndSaveTimer() { console.log("TODO: Stop & Save Timer"); showNotification("Timer Stopped (Not Implemented)", "info"); }
function cancelTimer() { console.log("TODO: Cancel Timer"); showNotification("Timer Cancelled (Not Implemented)", "info"); }


// --- Expense CRUD --- (Basic implementations)
async function addExpense() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    const expenseData = {
        userId: appState.user.id, date: getInputValue('expense-date'),
        description: getInputValue('expense-description').trim(),
        amount: parseFloat(getInputValue('expense-amount')),
        client: getInputValue('expense-client').trim() || null,
        project: getInputValue('expense-project').trim() || null,
    };
    if (!expenseData.date || !expenseData.description || isNaN(expenseData.amount) || expenseData.amount <= 0) {
        return showNotification("Valid date, description, and positive amount required.", "error");
    }
    // TODO: Handle file upload for #expense-receipt
    try {
        const newExpense = await SupabaseAPI.addExpense(expenseData);
        if (newExpense) {
            appState.expenses.push(newExpense); updateExpensesTable(); updateClientProjectDropdowns();
            setInputValue('expense-date', new Date().toISOString().substring(0, 10));
            setInputValue('expense-description', ''); setInputValue('expense-amount', '');
            setInputValue('expense-client', ''); setInputValue('expense-project', '');
            setInputValue('expense-receipt', ''); // Clear file input
            showNotification("Expense added!", "success");
        } else { showNotification("Failed to add expense.", "error"); }
    } catch(error) { showNotification(error.message, "error"); }
}
// TODO: Implement fully
function editExpense(id) {
     console.log("TODO: Edit expense", id); showNotification('Edit Expense - Not Implemented', 'info');
     const expense = appState.expenses.find(e => e.id === id); if(expense) {/* Populate form */}
}
// TODO: Implement fully
async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return; console.log("Deleting expense", id);
    try {
        if (await SupabaseAPI.deleteExpense(id)) {
            appState.expenses = appState.expenses.filter(e => e.id !== id);
            updateExpensesTable(); updateClientProjectDropdowns();
            showNotification('Expense deleted.', 'success');
        } else { showNotification('Failed to delete expense.', 'error');}
    } catch (error) { showNotification(error.message, 'error'); }
}

// --- Recurring Entries --- (Basic Implementations)
async function saveRecurringEntry() {
    // ... (implementation from V3, calls SupabaseAPI.saveRecurringEntry - TODO) ...
     if (!appState.user) return showNotification('You must be logged in.', 'error');
    const recurringData = { /* ... data from form ... */ };
    // ... validation ...
     console.log("TODO: Save recurring entry", recurringData);
     showNotification("TODO: Save recurring entry functionality", "info");
}
function useRecurringEntry(id) {
    // ... (implementation from V3) ...
     console.log("Using recurring entry", id);
     const entry = appState.recurringEntries.find(r => r.id === id);
     if (entry) { /* Populate form */ }
}
async function deleteRecurringEntry(id) {
    // ... (implementation from V3, calls SupabaseAPI.deleteRecurringEntry - TODO) ...
     if (!confirm("Delete this recurring entry template?")) return;
     console.log("TODO: Delete recurring entry", id);
}

// --- Invoice Generation --- (No changes needed here, uses helpers)
// ... filterInvoiceItems, viewInvoiceEntries, updateInvoiceTotalsFromPreview, handleGenerateInvoiceClick, generateInvoicePreview ...
// ... generateInvoiceHtml, generateInvoiceNumber, saveInvoicePdf, exportInvoiceExcel, markCurrentlyGeneratedInvoicePaid ...
// ... viewInvoiceFromHistory, deleteInvoiceFromHistory, markInvoicePaidFromHistory ...

// --- Reports (Stubs) ---
function generateReport() { console.log("TODO: Generate Report"); showNotification('Generate Report - Not Implemented', 'info'); }
function exportReport() { console.log("TODO: Export Report"); showNotification('Export Report - Not Implemented', 'info'); }

// --- Database Setup Check ---
async function showDatabaseSetupModal() {
     const setupResults = document.getElementById('setup-results'); if (!setupResults) return;
     setupResults.style.display = 'block'; setupResults.innerHTML = 'Running checks...\n\n';
     try { const result = await runSetupChecks(); /* Display result.results in setupResults */ }
     catch (error) { setupResults.innerHTML += `\nError: ${error.message}`; }
}

// --- Tab Navigation ---
function openTab(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    const tabToShow = document.getElementById(tabName);
    if (tabToShow) {
        tabToShow.style.display = 'block';
        evt?.currentTarget?.classList.add('active'); // Add to clicked button
        if (tabName === 'dashboard-tab') updateDashboard(appState, getDashboardDependencies());
        if (tabName === 'invoice-tab') updateInvoiceHistoryTable(); // Refresh history on tab open
        if (tabName === 'settings-tab') { populateRateTemplates(); updateRateDropdowns(); } // Refresh rates
    } else console.error(`Tab content ID not found: ${tabName}`);
}


// --- Utility / Helper Functions --- (ALL DEFINED HERE) ---

// Added missing helper
function getFormDataFromLocalStorage() {
    if (!appState.user) return null;
    const saved = localStorage.getItem(`formData_${appState.user.id}`);
    try { return saved ? JSON.parse(saved) : null; }
    catch (e) { console.error("Error parsing localStorage form data", e); return null; }
}

function showNotification(message, type = 'info') {
    try {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`; // Use classes for styling
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    } catch (domError) { console.error("DOM Notification Error:", message, domError); }
}

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

// --- Final Log ---
console.log("app.js V5 with fixes loaded.");
