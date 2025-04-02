// App.js - TEST VERSION - Check if initApp runs at all

// Keep imports to see if they cause issues
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

// --- Application State (keep for now) ---
const appState = { /* ... keep appState definition ... */ };

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    // --- VERY SIMPLE TEST ---
    console.log("--- initApp TEST: Function Entered ---");
    alert("DEBUG: If you see this alert, initApp was called!");
    // --- END OF TEST ---

    // Original initApp logic commented out below for testing:
    /*
    console.log("Initializing app V8+Debug...");
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
    */
}

// --- Keep function definitions below (even if not called by simple initApp) ---
// --- This helps ensure there isn't a syntax error in their definitions ---

async function checkSupabaseConnection() { /* ... definition ... */ }
function setDefaultDates() { /* ... definition ... */ }
async function loadUserData() { /* ... definition ... */ }
function showApp() { /* ... definition ... */ }
function showLoginForm() { /* ... definition ... */ }
function applyTheme(themePreference) { /* ... definition ... */ }
function populateSettingsForm() { /* ... definition ... */ }
function populateRateTemplates() { /* ... definition ... */ }
function updateRateDropdowns() { /* ... definition ... */ }
function updateTimeEntriesTable() { /* ... definition with DEBUG logs ... */ }
function updateExpensesTable() { /* ... definition ... */ }
function updateSummary() { /* ... definition ... */ }
function updateClientProjectDropdowns() { /* ... definition ... */ }
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... definition ... */ }
function populateDatalist(elementId, optionsArray) { /* ... definition ... */ }
function updateRecurringEntriesUI() { /* ... definition ... */ }
function updateInvoiceHistoryTable() { /* ... definition ... */ }
function setupEventListeners() { /* ... definition ... */ }
function addListener(id, event, handler) { /* ... definition ... */ }
function addDelegatedListener(parentElementId, event, selector, handler) { /* ... definition ... */ }
function setupAuthListeners() { /* ... definition ... */ }
function setupNavigationListeners() { /* ... definition ... */ }
function setupTimeEntryListeners() { /* ... definition ... */ }
function setupExpenseListeners() { /* ... definition ... */ }
function setupInvoiceListeners() { /* ... definition ... */ }
function addInvoiceHistoryActionListeners() { /* ... definition ... */ }
function setupReportListeners() { /* ... definition ... */ }
function setupSettingsListeners() { /* ... definition ... */ }
function addRateActionListeners() { /* ... definition ... */ }
function setupDataManagementListeners() { /* ... definition ... */ }
function setupDateRangeListeners() { /* ... definition ... */ }
function setupAutoSave() { /* ... definition ... */ }
function setupDarkModeToggle() { /* ... definition ... */ }
function setupDatabaseCheckListener() { /* ... definition ... */ }
function addRecurringEntryActionListeners() { /* ... definition ... */ }
function getDashboardDependencies() { /* ... definition ... */ }
async function handleLogin(e) { /* ... definition ... */ }
async function handleSignup(e) { /* ... definition ... */ }
async function handleLogout() { /* ... definition ... */ }
function clearUIOnLogout() { /* ... definition ... */ }
function toggleAuthForms(showSignup) { /* ... definition ... */ }
async function saveCoreSettings() { /* ... definition ... */ }
async function saveDisplaySettings() { /* ... definition ... */ }
function toggleDarkMode() { /* ... definition ... */ }
async function addRateTemplate() { /* ... definition ... */ }
function editRateTemplate(id) { /* ... definition ... */ }
async function deleteRateTemplate(id) { /* ... definition ... */ }
function exportData() { /* ... definition ... */ }
async function importData(e) { /* ... definition ... */ }
function exportCSV() { /* ... definition ... */ }
function applyFilters() { /* ... definition ... */ }
function clearFilters() { /* ... definition ... */ }
function clearLocalStorageData() { /* ... definition ... */ }
async function clearDatabaseData() { /* ... definition ... */ }
const AUTO_SAVE_DELAY = 2500;
function handleAutoSaveInput() { /* ... definition ... */ }
async function saveCurrentFormData() { /* ... definition ... */ }
function loadFormDataIntoForm(formData) { /* ... definition ... */ }
async function clearSavedFormData() { /* ... definition ... */ }
function showAutoSaveIndicator() { /* ... definition ... */ }
async function addTimeEntry() { /* ... definition ... */ }
async function updateTimeEntry() { /* ... definition ... */ }
function editTimeEntry(id) { /* ... definition ... */ }
async function deleteTimeEntry(id) { /* ... definition ... */ }
function cancelEdit() { /* ... definition ... */ }
function resetTimeEntryForm() { /* ... definition ... */ }
function setEditModeUI(isEditing) { /* ... definition ... */ }
function startTimer() { console.log("TODO: Start Timer"); showNotification("Timer Started (Not Implemented)", "info"); }
function pauseTimer() { console.log("TODO: Pause Timer"); showNotification("Timer Paused (Not Implemented)", "info"); }
function resumeTimer() { console.log("TODO: Resume Timer"); showNotification("Timer Resumed (Not Implemented)", "info"); }
function stopAndSaveTimer() { console.log("TODO: Stop & Save Timer"); showNotification("Timer Stopped (Not Implemented)", "info"); }
function cancelTimer() { console.log("TODO: Cancel Timer"); showNotification("Timer Cancelled (Not Implemented)", "info"); }
async function addExpense() { /* ... definition ... */ }
function editExpense(id) { /* ... definition ... */ }
async function deleteExpense(id) { /* ... definition ... */ }
async function saveRecurringEntry() { /* ... definition ... */ }
function useRecurringEntry(id) { /* ... definition ... */ }
async function deleteRecurringEntry(id) { /* ... definition ... */ }
function filterInvoiceItems(client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses) { /* ... definition ... */ }
function viewInvoiceEntries() { /* ... definition ... */ }
function updateInvoiceTotalsFromPreview() { /* ... definition ... */ }
function handleGenerateInvoiceClick() { /* ... definition ... */ }
function generateInvoicePreview() { /* ... definition ... */ }
function generateInvoiceHtml(invoiceData) { /* ... definition ... */ }
function generateInvoiceNumber() { /* ... definition ... */ }
function saveInvoicePdf() { console.log("TODO: Save PDF"); showNotification('Save PDF - Not Implemented', 'info'); }
function exportInvoiceExcel() { console.log("TODO: Export Excel"); showNotification('Export Excel - Not Implemented', 'info'); }
async function markCurrentlyGeneratedInvoicePaid() { /* ... definition ... */ }
function viewInvoiceFromHistory(id) { console.log("TODO: View invoice", id); showNotification('View History - Not Implemented', 'info'); }
async function deleteInvoiceFromHistory(id) { console.log("TODO: Delete invoice", id); showNotification('Delete History - Not Implemented', 'info'); }
async function markInvoicePaidFromHistory(id) { console.log("TODO: Mark paid", id); showNotification('Mark Paid History - Not Implemented', 'info'); }
function generateReport() { console.log("TODO: Generate Report"); showNotification('Generate Report - Not Implemented', 'info'); }
function exportReport() { console.log("TODO: Export Report"); showNotification('Export Report - Not Implemented', 'info'); }
async function showDatabaseSetupModal() { /* ... definition ... */ }
function openTab(evt, tabName) { /* ... definition ... */ }
function getFormDataFromLocalStorage() { /* ... definition ... */ }
function showNotification(message, type = 'info') { /* ... definition ... */ }
function escapeHtml(unsafe) { /* ... definition ... */ }
function formatCurrency(amount, currencyCode = appState.settings.currency) { /* ... definition ... */ }
function formatDate(dateString, format = appState.settings.dateFormat) { /* ... definition ... */ }
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... definition ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... definition ... */ }
function getInputValue(id) { /* ... definition ... */ }
function setInputValue(id, value) { /* ... definition ... */ }
function setTextContent(id, text) { /* ... definition ... */ }
function triggerDownload(content, filename, contentType) { /* ... definition ... */ }
function readFileAsText(file) { /* ... definition ... */ }
function showLoadingIndicator(show) { /* ... definition ... */ }

// --- Final Log ---
console.log("app.js TEST VERSION loaded."); // Updated version log
