// App.js - Main application logic (Refactored - V11 Focused initApp Debug)

// Imports
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

// --- Application State ---
const appState = { /* ... same as V8 ... */ };

// --- Utility / Helper Functions --- (Defined BEFORE initApp uses them) ---
function showNotification(message, type = 'info') { /* ... same as V8 ... */ }
function getInputValue(id) { /* ... same as V8 ... */ }
function setInputValue(id, value) { /* ... same as V8 ... */ }
function setTextContent(id, text) { /* ... same as V8 ... */ }
function escapeHtml(unsafe) { /* ... same as V8 ... */ }
function formatCurrency(amount, currencyCode = appState.settings.currency) { /* ... same as V8 ... */ }
function formatDate(dateString, format = appState.settings.dateFormat) { /* ... same as V8 ... */ }
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... same as V8 ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... same as V8 ... */ }
function triggerDownload(content, filename, contentType) { /* ... same as V8 ... */ }
function readFileAsText(file) { /* ... same ... */ }
function showLoadingIndicator(show) { /* ... same ... */ }
function getFormDataFromLocalStorage() { /* ... same ... */ }


// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

// *** initApp with More Logging ***
async function initApp() {
    console.log("Initializing app V11+Debug..."); // Version log
    if (!(await checkSupabaseConnection())) {
        showNotification("Cannot initialize: Database connection issue.", "error"); return;
    }
    console.log("Checking session...");
    try {
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();

        if (session?.user) {
            appState.user = session.user;
            console.log("User logged in:", appState.user.email); // We see this

            // --- DETAILED LOGGING HERE ---
            console.log("InitApp: Attempting to call loadUserData...");
            try {
                await loadUserData(); // Load data
                console.log("InitApp: loadUserData finished successfully.");
            } catch (loadError) {
                 console.error("InitApp: Error occurred WITHIN loadUserData:", loadError);
                 showNotification("Error loading user data. Check console.", "error");
                 // Decide if we should proceed or stop here
                 // Maybe show login form if data load fails?
                 showLoginForm();
                 return; // Stop init if data load fails critically
            }

            console.log("InitApp: Attempting to call showApp...");
            try {
                 showApp(); // Show the main app UI
                 console.log("InitApp: showApp finished successfully.");
            } catch (showAppError) {
                 console.error("InitApp: Error occurred WITHIN showApp:", showAppError);
                 showNotification("Error displaying application UI.", "error");
                 // If showing app fails, maybe try showing login as fallback?
                 showLoginForm();
                 return; // Stop init
            }
             // --- END OF DETAILED LOGGING ---

        } else {
            console.log("No session found, showing login.");
            showLoginForm(); // Show login UI
        }
    } catch (error) {
        // Catch errors from getSession itself
        console.error("InitApp: Session check block error:", error);
        showNotification("Error checking session.", "error");
        showLoginForm(); // Default to login on error
    }

    // These should run *after* either showApp or showLoginForm has been called
    console.log("InitApp: Setting up event listeners...");
    setupEventListeners();
    console.log("InitApp: Initializing dashboard module...");
    initDashboard(appState, getDashboardDependencies());
    setDefaultDates();
    applyTheme(appState.settings.theme);
    console.log("InitApp: Initialization complete.");
}
// *** End of modified initApp ***

async function checkSupabaseConnection() { /* ... same as V10 ... */ }
function setDefaultDates() { /* ... same as V10 ... */ }
async function loadUserData() { /* ... same as V10 ... */ }
function showApp() { /* ... same V8 with log ... */ }
function showLoginForm() { /* ... same V8 with log ... */ }
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
function setupEventListeners() { /* ... same structure calling smaller setup functions ... */ }
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
console.log("app.js V11 with initApp debug loaded."); // Updated version log
