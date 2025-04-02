// App.js - Main application logic (Refactored - V7 Enhanced Debug)

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

async function initApp() {
    console.log("Initializing app V7+Debug..."); // Version log
    if (!(await checkSupabaseConnection())) {
        showNotification("Cannot initialize: Database connection issue.", "error"); return;
    }
    console.log("Checking session...");
    try {
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();
        if (session?.user) {
            appState.user = session.user; console.log("User logged in:", appState.user.email);
            await loadUserData(); showApp();
        } else { console.log("No session found, showing login."); showLoginForm(); }
    } catch (error) { console.error("Session check error:", error); showNotification("Error checking session.", "error"); showLoginForm(); }
    setupEventListeners();
    initDashboard(appState, getDashboardDependencies());
    setDefaultDates();
    applyTheme(appState.settings.theme);
}

// CORRECTED Connection Check
async function checkSupabaseConnection() {
    try {
        console.log("Checking Supabase connection & auth status...");
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();
        if (error) throw error; console.log("Supabase connection check successful."); return true;
    } catch (err) { console.error("Supabase connection check error:", err); alert(`Database connection error: ${err.message}.`); return false; }
}

function setDefaultDates() { /* ... same ... */ }

// Corrected loadUserData
async function loadUserData() {
    if (!appState.user) return; console.log("Loading user data..."); showLoadingIndicator(true);
    try {
        const [entries, expensesData, settingsData, recurringData, ratesData, invoiceData] = await Promise.all([
            SupabaseAPI.getTimeEntries(), SupabaseAPI.getExpenses(), SupabaseAPI.getSettings(appState.user.id),
            SupabaseAPI.getRecurringEntries(), SupabaseAPI.getRates(), SupabaseAPI.getInvoices(),
        ]);
        appState.entries = entries || []; appState.expenses = expensesData || []; appState.recurringEntries = recurringData || [];
        appState.rates = ratesData || [];
        if (appState.rates.length === 0) { console.log("No custom rate templates loaded."); }
        else if (!appState.rates.some(r => String(r.amount) === String(appState.settings.defaultRate))) { console.log("Default rate value not found in loaded rate templates."); }
        appState.invoices = invoiceData || [];
        let loadedFormData = null;
        if (settingsData) {
            loadedFormData = settingsData?.formData ?? settingsData?.form_data ?? null;
            const validSettings = Object.entries(settingsData).filter(([key, value]) => key !== 'formData' && key !== 'form_data' && value !== null && value !== undefined).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
            appState.settings = { ...appState.settings, ...validSettings };
        }
        applyTheme(appState.settings.theme);
        populateSettingsForm(); populateRateTemplates(); updateTimeEntriesTable(); updateExpensesTable(); updateSummary();
        updateClientProjectDropdowns(); updateRecurringEntriesUI(); updateInvoiceHistoryTable();
        appState.currentFormData = loadedFormData || getFormDataFromLocalStorage();
        if (appState.currentFormData) { loadFormDataIntoForm(appState.currentFormData); }
        console.log("User data loaded.");
    } catch (error) { console.error('Error loading user data:', error); showNotification('Error loading your data.', 'error'); }
    finally { showLoadingIndicator(false); }
}

// --- UI Updates ---
function showApp() { document.getElementById('login-container').style.display = 'none'; document.getElementById('app-container').style.display = 'block'; }
function showLoginForm() { document.getElementById('login-container').style.display = 'block'; document.getElementById('app-container').style.display = 'none'; }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same ... */ }
function populateRateTemplates() { /* ... same ... */ }
function updateRateDropdowns() { /* ... same ... */ }

// *** updateTimeEntriesTable with Enhanced DEBUG LOG ***
function updateTimeEntriesTable() {
    const tableBody = document.getElementById('entries-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // DEBUG LINE 1
    console.log(`DEBUG: Updating table. Found ${appState.entries.length} entries in appState. First entry:`, appState.entries[0]);

    const sortedEntries = [...appState.entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedEntries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--secondary-text);">No time entries recorded yet.</td></tr>';
        return;
    }

    sortedEntries.forEach((entry, index) => {
        // DEBUG LINE 2 (MODIFIED)
         if(index === 0) console.log('DEBUG: Keys of first entry object:', Object.keys(entry));

        const row = tableBody.insertRow();
        const formattedDate = formatDate(entry.date, appState.settings.dateFormat);
        const formattedRate = formatCurrency(entry.rate, appState.settings.currency);
        const formattedAmount = formatCurrency(entry.amount, appState.settings.currency);

        const rowHTML = `
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
        // DEBUG LINE 3
        if(index === 0) console.log('DEBUG: Generated HTML for first row (first 200 chars):', rowHTML.substring(0, 200));

        row.innerHTML = rowHTML;
    });
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
// --- Specific Listener Setup Function DEFINITIONS ---
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
console.log("app.js V7 with debug logs loaded."); // Updated version log
