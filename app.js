// App.js - Main application logic (Refactored - V3 with Connection Fix)

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
    currentTimer: { // Placeholder for timer state
        intervalId: null,
        startTime: null,
        pausedTime: 0,
        isPaused: false
    },
    currentFormData: null, // For auto-saving manual entry form (camelCase)
    currentInvoicePreview: { // For managing invoice generation steps
        filteredEntries: [],
        filteredExpenses: [],
        includedEntryIds: new Set(),
        includedExpenseIds: new Set()
    },
    currentlyGeneratedInvoice: null, // Holds the final invoice object before saving
    autoSaveTimeout: null
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing app...");

    // ** Use the CORRECTED connection check **
    if (!(await checkSupabaseConnection())) {
        showNotification("Cannot initialize app due to database connection issue.", "error");
        // Optionally disable UI elements here
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
        showNotification("Error checking session. Please refresh.", "error");
        showLoginForm();
    }

    setupEventListeners();

    // Pass state/dependencies to dashboard init
    initDashboard(appState, getDashboardDependencies());

    setDefaultDates();

    // Apply initial theme based on potentially loaded settings or defaults
    applyTheme(appState.settings.theme);
}

// --- CORRECTED Connection Check ---
async function checkSupabaseConnection() {
    try {
        console.log("Checking Supabase connection & auth status...");
        // Use getSession as a reliable check instead of rpc('now')
        const { data: { session }, error } = await SupabaseAPI.supabase.auth.getSession();

        if (error) {
            // Handle potential errors during the session check
            console.error("Error checking Supabase connection/session:", error);
            alert(`Database connection error: ${error.message}. Check Supabase config and network.`);
            return false; // Indicate failure
        }

        // If no error, connection and basic auth interaction are working
        console.log("Supabase connection and auth check successful.");
        return true; // Indicate success

    } catch (err) {
        // Catch any unexpected errors during the check
        console.error("Critical Supabase connection check error:", err);
        alert(`Critical database error: ${err.message}.`);
        return false; // Indicate failure
    }
}
// --- End of Corrected Connection Check ---


function setDefaultDates() {
    const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });
}

async function loadUserData() {
    if (!appState.user) return;
    console.log("Loading user data...");
    try {
        // Fetch all data concurrently
        // Assumes SupabaseAPI functions now return camelCase
        const [entries, expensesData, settingsData, recurringData, ratesData, invoiceData, formData] = await Promise.all([
            SupabaseAPI.getTimeEntries(),
            SupabaseAPI.getExpenses(),
            SupabaseAPI.getSettings(appState.user.id),
            SupabaseAPI.getRecurringEntries(), // Assumes these exist in supabase.js
            SupabaseAPI.getRates(),             // Assumes these exist in supabase.js
            SupabaseAPI.getInvoices(),           // Assumes these exist in supabase.js
            SupabaseAPI.getFormDataFromDatabase(appState.user.id)
        ]);

        appState.entries = entries || [];
        appState.expenses = expensesData || [];
        appState.recurringEntries = recurringData || [];
        appState.rates = ratesData || [];
        appState.invoices = invoiceData || [];

        // Load Settings (expects camelCase from SupabaseAPI.getSettings)
        if (settingsData) {
            const validSettings = Object.entries(settingsData)
                .filter(([_, value]) => value !== null && value !== undefined)
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
            // Ensure form_data isn't accidentally overwritten if it exists at top level
            delete validSettings.formData;
            appState.settings = { ...appState.settings, ...validSettings };
        }

        // Apply theme (already loaded into appState.settings)
        applyTheme(appState.settings.theme);

        // Populate UI elements
        populateSettingsForm();
        populateRateTemplates();
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        updateClientProjectDropdowns();
        updateRecurringEntriesUI();
        updateInvoiceHistoryTable();

        // Load auto-saved form data (expects camelCase)
        let loadedFormData = formData;
        // The form_data field from DB might still be snake_case if getSettings wasn't mapped perfectly for JSONB
         if (formData && formData.form_data && !formData.description) { // Heuristic check if it's nested
             loadedFormData = formData.form_data;
         }
        appState.currentFormData = loadedFormData || getFormDataFromLocalStorage(); // Fallback to localStorage
        if (appState.currentFormData) {
            loadFormDataIntoForm(appState.currentFormData);
        }

        console.log("User data loaded successfully.");

    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading your data. Please try again.', 'error');
    }
}

// --- UI Updates ---

function showApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('app-container').style.display = 'none';
}

function applyTheme(themePreference) {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    let activateDarkMode = false;
    if (themePreference === 'dark') {
        activateDarkMode = true;
    } else if (themePreference === 'auto') {
        activateDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.body.classList.toggle('dark-mode', activateDarkMode);
    if (darkModeToggle) {
        darkModeToggle.textContent = activateDarkMode ? '☀️' : '🌙';
    }
    // Dashboard charts updated via updateDashboard if needed
}

function populateSettingsForm() {
    setInputValue('default-rate', appState.settings.defaultRate);
    setInputValue('default-payment-terms', appState.settings.defaultPaymentTerms);
    setInputValue('your-name', appState.settings.name);
    setInputValue('your-email', appState.settings.email);
    setInputValue('your-address', appState.settings.address);
    setInputValue('payment-instructions', appState.settings.paymentInstructions);
    setInputValue('theme-selection', appState.settings.theme);
    setInputValue('date-format', appState.settings.dateFormat);
    setInputValue('currency-format', appState.settings.currency);
    updateRateDropdowns(); // Ensure default rate dropdown is populated
}

// Updated: Includes logic to populate and manage rate templates UI
function populateRateTemplates() {
    const container = document.getElementById('rates-container');
    if (!container) return;
    container.innerHTML = ''; // Clear existing
    if (!appState.rates || appState.rates.length === 0) {
        container.innerHTML = '<p>No custom rates defined yet.</p>';
    } else {
        appState.rates.forEach(rate => {
            const div = document.createElement('div');
            // Add a class for styling, e.g., 'rate-template-item'
            div.className = 'rate-template-item'; // Style this class in your CSS
            div.innerHTML = `
                <span>${escapeHtml(rate.name)}: ${formatCurrency(rate.amount, appState.settings.currency)}</span>
                <div>
                    <button class="edit-rate-btn blue-btn" data-id="${rate.id}" style="padding: 5px 8px; font-size: 0.9em;">Edit</button>
                    <button class="delete-rate-btn" data-id="${rate.id}" style="padding: 5px 8px; font-size: 0.9em;">Delete</button>
                </div>
            `;
            container.appendChild(div);
        });
    }
    // Listeners are attached via addRateActionListeners called in setup
}

// Updated: Includes logic to populate relevant rate dropdowns
function updateRateDropdowns() {
    const rateDropdownIds = ['default-rate', 'timer-rate']; // IDs of <select> elements
    const rateInputId = 'rate'; // ID of the <input type="number">

    // Update <select> dropdowns
    rateDropdownIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentValue = select.value; // Preserve selection if possible
        select.innerHTML = ''; // Clear existing options

        // Add a default/placeholder if needed (e.g., for timer)
        if (id === 'timer-rate') {
            // Maybe start with the default rate selected?
        }

        // Add options from appState.rates
        appState.rates.forEach(rate => {
            const option = document.createElement('option');
            option.value = rate.amount; // Value is the rate amount
            option.textContent = `${rate.name} (${formatCurrency(rate.amount, appState.settings.currency)})`;
            option.dataset.rateId = rate.id; // Store original ID if needed
            // Set selected if it matches the default rate from settings
            if (id === 'default-rate' && rate.amount === appState.settings.defaultRate) {
                 option.selected = true;
            }
            if (id === 'timer-rate' && rate.amount === appState.settings.defaultRate) {
                option.selected = true; // Default timer rate to default setting rate
            }

            select.appendChild(option);
        });

        // Try to restore previous selection if it still exists, otherwise use default
        if (select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        } else if (id === 'default-rate'){
             select.value = appState.settings.defaultRate; // Ensure default rate reflects setting
        } else if (id === 'timer-rate') {
             select.value = appState.settings.defaultRate; // Default timer rate
        }
         else if (select.options.length > 0) {
            select.selectedIndex = 0; // Fallback
        }
    });

    // Update the manual rate input to reflect the default rate setting initially
    const rateInput = document.getElementById(rateInputId);
    if (rateInput && !rateInput.value) { // Only set if empty
         rateInput.value = appState.settings.defaultRate;
    }

    // Optional: Add listener to rate template dropdowns to update the manual #rate input?
    // Example for timer rate select:
    const timerRateSelect = document.getElementById('timer-rate');
    const manualRateInput = document.getElementById('rate');
    if(timerRateSelect && manualRateInput && !timerRateSelect.dataset.listenerAdded) {
        timerRateSelect.addEventListener('change', (e) => {
             // Maybe update the manual rate input when timer rate changes? Decide UX.
             // manualRateInput.value = e.target.value;
        });
        timerRateSelect.dataset.listenerAdded = 'true'; // Prevent multiple listeners
    }

}


function updateTimeEntriesTable() {
    const tableBody = document.getElementById('entries-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const sortedEntries = [...appState.entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedEntries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--secondary-text);">No time entries recorded yet.</td></tr>';
        return;
    }

    sortedEntries.forEach(entry => {
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


function updateExpensesTable() {
    const tableBody = document.getElementById('expenses-body');
     if (!tableBody) return;
    tableBody.innerHTML = '';
     const sortedExpenses = [...appState.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedExpenses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--secondary-text);">No expenses recorded yet.</td></tr>';
    } else {
         sortedExpenses.forEach(expense => {
             const row = tableBody.insertRow();
             const formattedDate = formatDate(expense.date, appState.settings.dateFormat);
             const formattedAmount = formatCurrency(expense.amount, appState.settings.currency);
             // TODO: Add logic for receipt URL link if implemented
             row.innerHTML = `
                 <td>${formattedDate}</td>
                 <td>${escapeHtml(expense.description)}</td>
                 <td>${formattedAmount}</td>
                 <td>${escapeHtml(expense.client || '-')}</td>
                 <td>${escapeHtml(expense.project || '-')}</td>
                 <td>
                     <button class="edit-expense-btn blue-btn" data-id="${expense.id}" style="padding: 5px 8px; font-size: 0.9em;">Edit</button>
                     <button class="delete-expense-btn" data-id="${expense.id}" style="padding: 5px 8px; font-size: 0.9em;">Delete</button>
                     </td>
             `;
         });
    }
    const totalExpensesAmount = appState.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    setTextContent('total-expenses', formatCurrency(totalExpensesAmount, appState.settings.currency));
    // Listeners added via delegation
}

function updateSummary() {
    // TODO: Use filtered entries if filtering is active
    const entriesToSummarize = appState.entries;
    const totalHours = entriesToSummarize.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const totalAmount = entriesToSummarize.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    setTextContent('total-hours', totalHours.toFixed(2));
    setTextContent('total-amount', formatCurrency(totalAmount, appState.settings.currency));
    setTextContent('filtered-hours', totalHours.toFixed(2)); // Update filtered too (until filtering implemented)
    setTextContent('filtered-amount', formatCurrency(totalAmount, appState.settings.currency));
}

function updateClientProjectDropdowns() {
    // ... (same as before, uses populateDropdown/populateDatalist) ...
     try {
        const allItems = [...appState.entries, ...appState.expenses];
        const clients = [...new Set(allItems.map(item => item.client).filter(Boolean))].sort();
        const projects = [...new Set(allItems.map(item => item.project).filter(Boolean))].sort();
        const clientDropdownIds = ['filter-client', 'dash-client', 'invoice-client', 'report-client', 'timer-client', 'expense-client'];
        const projectDropdownIds = ['filter-project', 'dash-project', 'invoice-project', 'report-project', 'timer-project', 'expense-project'];
        const clientDatalistIds = ['clients-list', 'clients-list-expense'];
        const projectDatalistIds = ['projects-list', 'projects-list-expense'];
        clientDropdownIds.forEach(id => populateDropdown(id, clients));
        projectDropdownIds.forEach(id => populateDropdown(id, projects, 'All Projects'));
        clientDatalistIds.forEach(id => populateDatalist(id, clients));
        projectDatalistIds.forEach(id => populateDatalist(id, projects));
    } catch (err) {
        console.error('Error populating dropdowns:', err);
    }
}

function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') {
    // ... (same as before) ...
    const dropdown = document.getElementById(elementId);
    if (!dropdown) return;
    const currentValue = dropdown.value;
    const firstOptionValue = dropdown.options[0]?.value || 'all';
    dropdown.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = firstOptionValue;
    if (elementId.includes('invoice-client')) defaultOption.textContent = 'Select Client';
    else if (elementId.includes('timer-client') || elementId.includes('timer-project')) defaultOption.textContent = `Select ${elementId.includes('client') ? 'Client' : 'Project'} (opt.)`;
    else if (elementId.includes('expense-client') || elementId.includes('expense-project')) defaultOption.textContent = `Select ${elementId.includes('client') ? 'Client' : 'Project'} (opt.)`;
    else defaultOption.textContent = `${defaultOptionText}`;
    dropdown.appendChild(defaultOption);
    optionsArray.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        dropdown.appendChild(option);
    });
    if (optionsArray.includes(currentValue)) {
        dropdown.value = currentValue;
    } else {
         dropdown.selectedIndex = 0;
    }
}

function populateDatalist(elementId, optionsArray) {
    // ... (same as before) ...
     const datalist = document.getElementById(elementId);
    if (!datalist) return;
    datalist.innerHTML = '';
    optionsArray.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        datalist.appendChild(option);
    });
}

// Updated: Basic UI for recurring entries
function updateRecurringEntriesUI() {
     const container = document.getElementById('recurring-entries-container');
     const noRecurringMsg = document.getElementById('no-recurring');
     if (!container || !noRecurringMsg) return;
     container.innerHTML = ''; // Clear previous items

     if (!appState.recurringEntries || appState.recurringEntries.length === 0) {
        noRecurringMsg.style.display = 'block';
        container.appendChild(noRecurringMsg); // Append the message element itself
     } else {
         noRecurringMsg.style.display = 'none';
         appState.recurringEntries.forEach(entry => {
             const div = document.createElement('div');
             div.className = 'recurring-entry-item'; // Style this class
             div.innerHTML = `
                <span>
                    ${escapeHtml(entry.description)}
                    ${entry.client ? `(${escapeHtml(entry.client)})` : ''}
                    - ${entry.hours} hrs @ ${formatCurrency(entry.rate)}
                </span>
                <div>
                     <button class="use-recurring-btn blue-btn" data-id="${entry.id}" style="padding: 5px 8px; font-size: 0.9em;">Use</button>
                     <button class="delete-recurring-btn" data-id="${entry.id}" style="padding: 5px 8px; font-size: 0.9em;">Delete</button>
                </div>
             `;
             container.appendChild(div);
         });
         // Add listeners using delegation
         addRecurringEntryActionListeners();
     }
}

// Updated: Shows history section based on data
function updateInvoiceHistoryTable() {
     const tableBody = document.getElementById('invoice-history-body');
     const section = document.querySelector('.invoice-history');
     if (!tableBody || !section) return;
     tableBody.innerHTML = '';
     const sortedInvoices = [...appState.invoices].sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

     if (sortedInvoices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--secondary-text);">No invoices saved yet.</td></tr>';
        section.style.display = 'none'; // Hide section if empty
     } else {
         section.style.display = 'block'; // Show section if not empty
         sortedInvoices.forEach(invoice => {
             const row = tableBody.insertRow();
             // Add CSS classes for status for styling: .status-paid, .status-unpaid, .status-draft
             const statusClass = `status-${(invoice.status || 'unknown').toLowerCase()}`;
             row.innerHTML = `
                <td>${escapeHtml(invoice.invoiceNumber)}</td>
                <td>${escapeHtml(invoice.client)}</td>
                <td>${formatDate(invoice.invoiceDate, appState.settings.dateFormat)}</td>
                <td>${formatCurrency(invoice.grandTotal, appState.settings.currency)}</td>
                <td><span class="${statusClass}">${escapeHtml(invoice.status || 'unknown')}</span></td>
                 <td>
                     <button class="view-invoice-btn blue-btn" data-id="${invoice.id}" style="padding: 5px 8px; font-size: 0.9em;">View</button>
                     <button class="delete-invoice-btn" data-id="${invoice.id}" style="padding: 5px 8px; font-size: 0.9em;">Delete</button>
                     ${invoice.status !== 'paid' ? `<button class="mark-paid-hist-btn" data-id="${invoice.id}" style="padding: 5px 8px; font-size: 0.9em;">Mark Paid</button>` : ''}
                 </td>
             `;
         });
         addInvoiceHistoryActionListeners();
     }
}


// --- Event Listeners Setup --- (Includes new listeners)

function setupEventListeners() {
    setupAuthListeners();
    setupNavigationListeners();
    setupTimeEntryListeners();
    setupExpenseListeners(); // Existing
    setupInvoiceListeners(); // Existing
    setupReportListeners(); // Existing
    setupSettingsListeners(); // Existing
    setupDataManagementListeners(); // Updated
    setupDateRangeListeners(); // Existing
    setupAutoSave(); // Existing
    setupDarkModeToggle(); // Existing
    setupDatabaseCheckListener(); // Existing
    // Added listeners specific to newly populated UI elements
    addRecurringEntryActionListeners(); // Call here if container exists on load
    addRateActionListeners(); // Call here if container exists on load
    addInvoiceHistoryActionListeners(); // Call here if container exists on load
}

// ... (other setup functions remain mostly the same) ...
function setupAuthListeners() { /* ... same ... */ }
function setupNavigationListeners() { /* ... same ... */ }
function setupTimeEntryListeners() { /* ... same ... */ }
function setupExpenseListeners() { /* ... same ... */ }
function setupInvoiceListeners() { /* ... updated confirm button listener ... */
    addListener('generate-invoice', 'click', handleGenerateInvoiceClick); // Renamed handler
    addListener('view-invoice-entries', 'click', viewInvoiceEntries);
    addListener('confirm-invoice-items', 'click', handleGenerateInvoiceClick); // Added: Confirm button also triggers generate
    const printBtn = document.getElementById('print-invoice');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    addListener('save-invoice-pdf', 'click', saveInvoicePdf);
    addListener('export-invoice-excel', 'click', exportInvoiceExcel);
    addListener('mark-as-paid', 'click', markCurrentlyGeneratedInvoicePaid);
    addDelegatedListener('invoice-entries-preview', 'change', '.include-entry, .include-expense', updateInvoiceTotalsFromPreview);
    // History listeners called separately
}
function setupReportListeners() { /* ... same ... */ }
function setupSettingsListeners() { /* ... same ... */ }
function addRateActionListeners() { // Changed from setup... to add...
     addDelegatedListener('rates-container', 'click', '.edit-rate-btn', editRateTemplate);
     addDelegatedListener('rates-container', 'click', '.delete-rate-btn', deleteRateTemplate);
}
function setupDataManagementListeners() { /* ... Added Danger Zone listeners ... */
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
     addListener('clear-database-data', 'click', clearDatabaseData);
}
function setupDateRangeListeners() { /* ... same ... */ }
function setupAutoSave() { /* ... same ... */ }
function setupDarkModeToggle() { /* ... same ... */ }
function setupDatabaseCheckListener() { /* ... same ... */ }
function getDashboardDependencies() { /* ... same ... */ }
function addInvoiceHistoryActionListeners() { // Changed from setup... to add...
     addDelegatedListener('invoice-history-body', 'click', '.view-invoice-btn', viewInvoiceFromHistory);
     addDelegatedListener('invoice-history-body', 'click', '.delete-invoice-btn', deleteInvoiceFromHistory);
     addDelegatedListener('invoice-history-body', 'click', '.mark-paid-hist-btn', markInvoicePaidFromHistory);
}
function addRecurringEntryActionListeners() { // New function
    addDelegatedListener('recurring-entries-container', 'click', '.use-recurring-btn', useRecurringEntry);
    addDelegatedListener('recurring-entries-container', 'click', '.delete-recurring-btn', deleteRecurringEntry);
}


// --- Authentication --- (No changes needed)
async function handleLogin(e) { /* ... same ... */ }
async function handleSignup(e) { /* ... same ... */ }
async function handleLogout() { /* ... same ... */ }
function clearUIOnLogout() { /* ... same, ensures new UI parts are cleared ... */ }
function toggleAuthForms(showSignup) { /* ... same ... */ }

// --- Settings --- (No changes needed to save functions)
async function saveCoreSettings() { /* ... same ... */ }
async function saveDisplaySettings() { /* ... same ... */ }
function toggleDarkMode() { /* ... same ... */ }

// --- Rate Templates --- (TODO Placeholders)
async function addRateTemplate() {
    // ... (logic using SupabaseAPI.addRate) ...
     if (!appState.user) return showNotification('You must be logged in.', 'error');
     const name = getInputValue('rate-name').trim();
     const amount = parseFloat(getInputValue('rate-amount'));
     if (!name || isNaN(amount) || amount <= 0) return showNotification('Valid name & positive amount required.', 'error');

     console.log("Adding Rate:", { name, amount });
     try {
        const newRate = await SupabaseAPI.addRate({ userId: appState.user.id, name, amount });
        if (newRate) {
           appState.rates.push(newRate);
           appState.rates.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
           populateRateTemplates(); // Updates UI list and dropdowns
           setInputValue('rate-name', '');
           setInputValue('rate-amount', '');
           showNotification('Rate template added!', 'success');
        } else {
             showNotification('Failed to add rate template.', 'error');
        }
     } catch (error) { showNotification(error.message, 'error'); }
}

// TODO: Implement fully
function editRateTemplate(id) {
     console.log("TODO: Edit rate template", id);
     const rate = appState.rates.find(r => r.id === id);
     if (rate) {
         setInputValue('rate-name', rate.name);
         setInputValue('rate-amount', rate.amount);
         // Need UI change to show "Update Rate" button and maybe store the ID
         showNotification('Populated form for editing. Update logic TBD.', 'info');
     }
}
// TODO: Implement fully
async function deleteRateTemplate(id) {
     if (!confirm('Delete this rate template? This cannot be undone.')) return;
     console.log("Deleting rate template", id);
     try {
         const success = await SupabaseAPI.deleteRate(id); // Assumes deleteRate exists
         if (success) {
             appState.rates = appState.rates.filter(r => r.id !== id);
             populateRateTemplates(); // Update UI list and dropdowns
             showNotification('Rate template deleted.', 'success');
         } else {
              showNotification('Failed to delete rate template.', 'error');
         }
     } catch (error) { showNotification(error.message, 'error'); }
}


// --- Data Management --- (No changes needed here)
function exportData() { /* ... same ... */ }
async function importData(e) { /* ... same - NOTE: DB save part is still TODO ... */ }
function exportCSV() { /* ... TODO ... */ }
function applyFilters() { /* ... TODO ... */ }
function clearFilters() { /* ... TODO ... */ }

// --- Danger Zone Functions ---
function clearLocalStorageData() {
    if (confirm("DANGER ZONE! This will clear settings and unsaved form data stored ONLY in this browser. It will NOT affect data saved in the database. Continue?")) {
        const userId = appState.user?.id; // Keep user id if logged in
        localStorage.clear(); // Clears everything
        if(userId) localStorage.setItem('userId', userId); // Optionally restore userId if needed?
        alert("Local storage cleared. You may need to log in again or refresh.");
        window.location.reload(); // Force reload
    }
}
async function clearDatabaseData() {
    if (!appState.user) return showNotification('You must be logged in to clear database data.', 'error');
    if (prompt(`DANGER ZONE! This will delete ALL your time entries, expenses, invoices, rates, and recurring entries from the database PERMANENTLY. Type DELETE to confirm.`) === 'DELETE') {
         if (confirm("Are you absolutely sure? This cannot be undone!")) {
             showNotification("Attempting to clear database data... Please wait.", "info");
             console.log("TODO: Implement clearing ALL user data via SupabaseAPI calls (e.g., delete from all tables where user_id matches). Requires careful implementation in supabase.js.");
             // Example (Needs functions in supabase.js):
             // try {
             //    await SupabaseAPI.deleteAllUserData(appState.user.id);
             //    await loadUserData(); // Reload empty state
             //    showNotification("All database data cleared.", "success");
             // } catch (error) { showNotification(`Error clearing data: ${error.message}`, "error"); }
             alert("Clear Database Data function not fully implemented yet."); // Placeholder
         }
    } else {
        alert("Clear data cancelled.");
    }
}


// --- Auto Save --- (No changes needed)
// ... handleAutoSaveInput, saveCurrentFormData, getFormDataFromLocalStorage, loadFormDataIntoForm, clearSavedFormData, showAutoSaveIndicator ...

// --- Time Entry CRUD --- (No changes needed to core logic)
// ... addTimeEntry, updateTimeEntry, editTimeEntry, deleteTimeEntry, cancelEdit, resetTimeEntryForm, setEditModeUI ...

// --- Expense CRUD (Stubs/Basic Implementation) ---
// TODO: Add full implementation, especially file upload if needed
async function addExpense() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    const expenseData = {
        userId: appState.user.id,
        date: getInputValue('expense-date'),
        description: getInputValue('expense-description').trim(),
        amount: parseFloat(getInputValue('expense-amount')),
        client: getInputValue('expense-client').trim() || null, // Use null if empty
        project: getInputValue('expense-project').trim() || null,
        // receiptUrl: ?? // Handle file upload separately
    };
    if (!expenseData.date || !expenseData.description || isNaN(expenseData.amount) || expenseData.amount <= 0) {
        return showNotification("Valid date, description, and positive amount required.", "error");
    }
    // TODO: Handle file upload for receipt
    // 1. Get file from #expense-receipt
    // 2. Upload to Supabase Storage (requires bucket setup and RLS)
    // 3. Get the public URL
    // 4. Add URL to expenseData.receiptUrl

    try {
        const newExpense = await SupabaseAPI.addExpense(expenseData); // Assumes API exists and handles case
        if (newExpense) {
            appState.expenses.push(newExpense);
            updateExpensesTable();
            updateClientProjectDropdowns(); // Update lists
            // Clear expense form
            setInputValue('expense-date', new Date().toISOString().substring(0, 10));
            setInputValue('expense-description', '');
            setInputValue('expense-amount', '');
            setInputValue('expense-client', '');
            setInputValue('expense-project', '');
            setInputValue('expense-receipt', ''); // Clear file input
            showNotification("Expense added!", "success");
        } else {
             showNotification("Failed to add expense.", "error");
        }
    } catch(error) { showNotification(error.message, "error"); }
}

function editExpense(id) {
     console.log("TODO: Edit expense", id);
     const expense = appState.expenses.find(e => e.id === id);
     if(expense) {
         // Populate form (need to potentially switch form mode)
         setInputValue('expense-date', expense.date);
         setInputValue('expense-description', expense.description);
         setInputValue('expense-amount', expense.amount);
         setInputValue('expense-client', expense.client || '');
         setInputValue('expense-project', expense.project || '');
         // Need hidden field for ID and Update button
         showNotification("Populated form for editing expense. Update logic TBD.", "info");
     }
}
async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
     console.log("Deleting expense", id);
      try {
         const success = await SupabaseAPI.deleteExpense(id); // Assumes API exists
         if (success) {
             appState.expenses = appState.expenses.filter(e => e.id !== id);
             updateExpensesTable();
             updateClientProjectDropdowns();
             showNotification('Expense deleted.', 'success');
         } else {
              showNotification('Failed to delete expense.', 'error');
         }
     } catch (error) { showNotification(error.message, 'error'); }
}

// --- Recurring Entries (Stubs/Basic Implementation) ---
// TODO: Add full implementation
async function saveRecurringEntry() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    const recurringData = {
         userId: appState.user.id,
         description: getInputValue('description').trim(),
         client: getInputValue('client').trim() || null,
         project: getInputValue('project').trim() || null,
         hours: parseFloat(getInputValue('hours')),
         rate: parseFloat(getInputValue('rate')),
    };
    if (!recurringData.description || isNaN(recurringData.hours) || isNaN(recurringData.rate)) {
         return showNotification("Description, hours, and rate required to save recurring.", "warning");
    }
    console.log("TODO: Save recurring entry", recurringData);
     try {
         // const newRecurring = await SupabaseAPI.saveRecurringEntry(recurringData); // Assumes API exists
         // if (newRecurring) {
         //     appState.recurringEntries.push(newRecurring);
         //     updateRecurringEntriesUI();
         //     showNotification("Recurring entry saved!", "success");
         // }
         showNotification("TODO: Save recurring entry functionality", "info");
     } catch (error) { showNotification(error.message, "error"); }
}
// TODO: Implement
function useRecurringEntry(id) {
     console.log("TODO: Use recurring entry", id);
     const entry = appState.recurringEntries.find(r => r.id === id);
     if (entry) {
         // Populate the main time entry form
         setInputValue('description', entry.description);
         setInputValue('client', entry.client || '');
         setInputValue('project', entry.project || '');
         setInputValue('hours', entry.hours);
         setInputValue('rate', entry.rate);
         // Maybe set date to today?
         setInputValue('date', new Date().toISOString().substring(0, 10));
         // Clear edit ID
         setInputValue('edit-id', '');
         setEditModeUI(false);
         showNotification("Form populated from recurring entry.", "info");
         document.querySelector('.time-entry')?.scrollIntoView({ behavior: 'smooth' });
     }
}
// TODO: Implement
async function deleteRecurringEntry(id) {
     if (!confirm("Delete this recurring entry template?")) return;
     console.log("TODO: Delete recurring entry", id);
     // Call SupabaseAPI.deleteRecurringEntry(id);
     // If success: remove from appState.recurringEntries, updateRecurringEntriesUI()
}


// --- Invoice Generation --- (No changes needed)
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

// --- Utility Functions --- (No changes needed)
// ... showNotification, escapeHtml, formatCurrency, formatDate, calculateDueDate, getDateRangeFromOption ...
// ... getInputValue, setInputValue, setTextContent, triggerDownload, readFileAsText ...

// --- Final Log ---
console.log("app.js with connection fix loaded.");
