// App.js - Main application logic (Refactored - V2)

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
        // Removed form_data from here, managed separately
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

    if (!(await checkSupabaseConnection())) return;

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

    // Apply initial theme based on potentially loaded settings
    applyTheme(appState.settings.theme);
}

async function checkSupabaseConnection() {
    // Basic check if Supabase client can be reached
    try {
        // A simple query that doesn't rely on specific tables initially
        const { error } = await SupabaseAPI.supabase.rpc('now'); // Example: Call a built-in function
        if (error) {
            // Only fail hard if it's not a permissions/missing function error likely solved by setup
             if (error.code && !error.code.startsWith('42')) { // Postgres codes starting 42 are often syntax/schema related
                 throw new Error(`Database connection error: ${error.message}`);
             }
             console.warn("Supabase RPC check failed (might be permissions), proceeding...");
        }
        console.log("Supabase connection check passed.");
        return true;
    } catch (err) {
        console.error("Critical Supabase connection error:", err);
        alert(`Cannot connect to database: ${err.message}. Check config and network.`);
        return false;
    }
}

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
            SupabaseAPI.getRecurringEntries(),
            SupabaseAPI.getRates(),
            SupabaseAPI.getInvoices(),
            SupabaseAPI.getFormDataFromDatabase(appState.user.id) // Still might return snake_case 'form_data' depending on supabase.js implementation
        ]);

        appState.entries = entries || [];
        appState.expenses = expensesData || [];
        appState.recurringEntries = recurringData || [];
        appState.rates = ratesData || [];
        appState.invoices = invoiceData || [];

        // Load Settings (now expects camelCase from SupabaseAPI.getSettings)
        if (settingsData) {
             // Filter out null/undefined values before merging
            const validSettings = Object.entries(settingsData)
                .filter(([_, value]) => value !== null && value !== undefined)
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
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
        // Handle potential snake_case 'form_data' field if getFormData... wasn't mapped
        let loadedFormData = formData;
        if (formData && formData.form_data) { // Check if the JSONB field itself was returned
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
    // Update dashboard charts for theme if necessary (called from updateDashboard now)
}

function populateSettingsForm() {
    // Assumes appState.settings uses camelCase
    setInputValue('default-rate', appState.settings.defaultRate);
    setInputValue('default-payment-terms', appState.settings.defaultPaymentTerms);
    setInputValue('your-name', appState.settings.name);
    setInputValue('your-email', appState.settings.email);
    setInputValue('your-address', appState.settings.address);
    setInputValue('payment-instructions', appState.settings.paymentInstructions);
    setInputValue('theme-selection', appState.settings.theme);
    setInputValue('date-format', appState.settings.dateFormat);
    setInputValue('currency-format', appState.settings.currency);
    // TODO: Populate default rate dropdown from appState.rates
}

// TODO: Implement fully
function populateRateTemplates() {
    const container = document.getElementById('rates-container');
    if (!container) return;
    container.innerHTML = ''; // Clear existing
    console.log("TODO: Populate rate templates UI from appState.rates", appState.rates);
    if (!appState.rates || appState.rates.length === 0) {
        container.innerHTML = '<p>No custom rates defined yet.</p>';
    } else {
        appState.rates.forEach(rate => {
             const div = document.createElement('div');
             div.className = 'rate-template-item'; // Add styling for this class
             div.innerHTML = `
                <span>${escapeHtml(rate.name)}: ${formatCurrency(rate.amount, appState.settings.currency)}</span>
                <div>
                    <button class="edit-rate-btn blue-btn" data-id="${rate.id}">Edit</button>
                    <button class="delete-rate-btn" data-id="${rate.id}">Delete</button>
                </div>
             `;
             container.appendChild(div);
        });
        // Add listeners for edit/delete buttons using delegation
         addRateActionListeners();
    }
    // TODO: Update #default-rate and #timer-rate select dropdowns
    updateRateDropdowns();
}

// TODO: Implement fully
function updateRateDropdowns() {
    const rateDropdowns = ['default-rate', 'timer-rate', 'rate']; // Add #rate from manual entry
    rateDropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = ''; // Clear existing options (except maybe a default placeholder if needed)

        // Add options from appState.rates
        appState.rates.forEach(rate => {
            const option = document.createElement('option');
            option.value = rate.amount; // Use amount as value
            option.textContent = `${rate.name} (${formatCurrency(rate.amount, appState.settings.currency)})`;
            option.dataset.rateId = rate.id; // Store ID if needed
            select.appendChild(option);
        });
        // Try to restore selection or select default
         if (select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
         } else if (select.querySelector(`option[value="${appState.settings.defaultRate}"]`)) {
            select.value = appState.settings.defaultRate;
         } else if (select.options.length > 0) {
             select.selectedIndex = 0;
         }

         // Special handling for #rate input (if it should also reflect dropdown choice)
         if (id === 'rate' && select.tagName !== 'SELECT') {
             // If #rate is an input, maybe don't populate it as a dropdown
             // Or, add a datalist instead
             // Or, update its value when a rate template dropdown changes
             console.warn("#rate input might need different handling than a select dropdown for rate templates.");
         }

    });
}

function updateTimeEntriesTable() {
    const tableBody = document.getElementById('entries-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const sortedEntries = [...appState.entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedEntries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8">No time entries recorded yet.</td></tr>';
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
            <td>${escapeHtml(entry.client || '')}</td>
            <td>${escapeHtml(entry.project || '')}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${formattedRate}</td>
            <td>${formattedAmount}</td>
            <td>
                <button class="edit-btn blue-btn" data-id="${entry.id}" style="margin-right: 5px; padding: 5px 10px;">Edit</button>
                <button class="delete-btn" data-id="${entry.id}" style="padding: 5px 10px;">Delete</button>
            </td>
        `;
    });
    // Listeners are added via delegation in setupExpenseListeners
}

// TODO: Implement fully
function updateExpensesTable() {
    const tableBody = document.getElementById('expenses-body');
     if (!tableBody) return;
    tableBody.innerHTML = '';
     const sortedExpenses = [...appState.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedExpenses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No expenses recorded yet.</td></tr>';
    } else {
         sortedExpenses.forEach(expense => {
             const row = tableBody.insertRow();
             const formattedDate = formatDate(expense.date, appState.settings.dateFormat);
             const formattedAmount = formatCurrency(expense.amount, appState.settings.currency);
             row.innerHTML = `
                 <td>${formattedDate}</td>
                 <td>${escapeHtml(expense.description)}</td>
                 <td>${formattedAmount}</td>
                 <td>${escapeHtml(expense.client || '')}</td>
                 <td>${escapeHtml(expense.project || '')}</td>
                 <td>
                     <button class="edit-expense-btn blue-btn" data-id="${expense.id}">Edit</button>
                     <button class="delete-expense-btn" data-id="${expense.id}">Delete</button>
                     ${expense.receiptUrl ? `<a href="${escapeHtml(expense.receiptUrl)}" target="_blank" class="receipt-link">View Receipt</a>` : ''}
                 </td>
             `;
         });
    }
    // Update total expenses display
    const totalExpensesAmount = appState.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    setTextContent('total-expenses', formatCurrency(totalExpensesAmount, appState.settings.currency));
     // Listeners are added via delegation in setupExpenseListeners
}

function updateSummary() {
    // Calculate totals based on potentially filtered data (if applyFilters is implemented)
    // For now, using all entries
    const entriesToSummarize = appState.entries; // Replace with filtered entries if filtering is active
    const totalHours = entriesToSummarize.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = entriesToSummarize.reduce((sum, entry) => sum + entry.amount, 0);

    setTextContent('total-hours', totalHours.toFixed(2));
    setTextContent('total-amount', formatCurrency(totalAmount, appState.settings.currency));

    // Update filtered summary (example - replace with actual filtered values)
    if (/* filters are active */ false) {
         // const filteredHours = ...
         // const filteredAmount = ...
        // setTextContent('filtered-hours', filteredHours.toFixed(2));
        // setTextContent('filtered-amount', formatCurrency(filteredAmount, appState.settings.currency));
    } else {
         // If no filters, filtered equals total
         setTextContent('filtered-hours', totalHours.toFixed(2));
         setTextContent('filtered-amount', formatCurrency(totalAmount, appState.settings.currency));
    }
}

function updateClientProjectDropdowns() {
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
    const dropdown = document.getElementById(elementId);
    if (!dropdown) return;
    const currentValue = dropdown.value;
    const firstOptionValue = dropdown.options[0]?.value || 'all'; // Get value of first option ('all', '' etc)
    dropdown.innerHTML = '';
    // Add the default "All" or "Select" option back
    const defaultOption = document.createElement('option');
    defaultOption.value = firstOptionValue; // Use original value
    // Adjust text based on context
    if (elementId.includes('invoice-client')) defaultOption.textContent = 'Select Client';
    else if (elementId.includes('timer')) defaultOption.textContent = `Select ${elementId.includes('client') ? 'Client' : 'Project'} (optional)`;
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
    const datalist = document.getElementById(elementId);
    if (!datalist) return;
    datalist.innerHTML = '';
    optionsArray.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        datalist.appendChild(option);
    });
}

// TODO: Implement fully
function updateRecurringEntriesUI() {
     const container = document.getElementById('recurring-entries-container');
     const noRecurringMsg = document.getElementById('no-recurring');
     if (!container || !noRecurringMsg) return;
     container.innerHTML = '';
     console.log("TODO: Populate recurring entries UI", appState.recurringEntries);
     if (!appState.recurringEntries || appState.recurringEntries.length === 0) {
        noRecurringMsg.style.display = 'block';
        container.appendChild(noRecurringMsg);
     } else {
         noRecurringMsg.style.display = 'none';
         // Example: appState.recurringEntries.forEach(entry => { ... create elements ... });
         // Add "Use" and "Delete" buttons?
     }
}

// TODO: Implement fully
function updateInvoiceHistoryTable() {
     const tableBody = document.getElementById('invoice-history-body');
     const section = document.querySelector('.invoice-history'); // Get the section itself
     if (!tableBody || !section) return;
     tableBody.innerHTML = '';
     const sortedInvoices = [...appState.invoices].sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate)); // Use camelCase

     console.log("TODO: Populate invoice history table", sortedInvoices);
     if (sortedInvoices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No invoices saved yet.</td></tr>';
        section.style.display = 'none';
     } else {
         section.style.display = 'block';
         sortedInvoices.forEach(invoice => {
             const row = tableBody.insertRow();
             row.innerHTML = `
                <td>${escapeHtml(invoice.invoiceNumber)}</td>
                <td>${escapeHtml(invoice.client)}</td>
                <td>${formatDate(invoice.invoiceDate, appState.settings.dateFormat)}</td>
                <td>${formatCurrency(invoice.grandTotal, appState.settings.currency)}</td>
                <td><span class="status-${invoice.status || 'unknown'}">${escapeHtml(invoice.status || 'unknown')}</span></td>
                 <td>
                     <button class="view-invoice-btn blue-btn" data-id="${invoice.id}">View</button>
                     <button class="delete-invoice-btn" data-id="${invoice.id}">Delete</button>
                     ${invoice.status !== 'paid' ? `<button class="mark-paid-hist-btn" data-id="${invoice.id}">Mark Paid</button>` : ''}
                 </td>
             `;
         });
         // Add listeners for view/delete/mark paid using delegation
         addInvoiceHistoryActionListeners();
     }
}


// --- Event Listeners Setup ---

function setupEventListeners() {
    setupAuthListeners();
    setupNavigationListeners();
    setupTimeEntryListeners();
    setupExpenseListeners();
    setupInvoiceListeners();
    setupReportListeners();
    setupSettingsListeners();
    setupDataManagementListeners();
    setupDateRangeListeners();
    setupAutoSave();
    setupDarkModeToggle();
    setupDatabaseCheckListener();
}

// Helper to add event listeners safely
function addListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Element with ID "${id}" not found for listener.`);
    }
}

// Helper for attaching listeners using event delegation
function addDelegatedListener(parentElementId, event, selector, handler) {
     const parent = document.getElementById(parentElementId);
     if (parent) {
         parent.addEventListener(event, (e) => {
             const targetElement = e.target.closest(selector);
             if (targetElement && parent.contains(targetElement)) {
                  // Pass relevant data, like data-id attribute
                 const id = targetElement.getAttribute('data-id');
                 handler(id, targetElement, e); // Pass id, element, and event
             }
         });
     } else {
         console.warn(`Parent element with ID "${parentElementId}" not found for delegated listener.`);
     }
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
            openTab(e, tabName);
        });
    });
}

function setupTimeEntryListeners() {
    addListener('add-entry', 'click', addTimeEntry);
    addListener('update-entry', 'click', updateTimeEntry);
    addListener('cancel-edit', 'click', cancelEdit);
    addListener('save-recurring', 'click', saveRecurringEntry);

    // Add delegated listeners for edit/delete buttons in the time log table
    addDelegatedListener('entries-body', 'click', '.edit-btn', editTimeEntry);
    addDelegatedListener('entries-body', 'click', '.delete-btn', deleteTimeEntry);

    // TODO: Timer listeners
    addListener('start-timer', 'click', () => console.log("TODO: Start Timer"));
    addListener('pause-timer', 'click', () => console.log("TODO: Pause Timer"));
    addListener('resume-timer', 'click', () => console.log("TODO: Resume Timer"));
    addListener('stop-timer', 'click', () => console.log("TODO: Stop Timer & Save"));
    addListener('cancel-timer', 'click', () => console.log("TODO: Cancel Timer"));
}

function setupExpenseListeners() {
    addListener('add-expense', 'click', addExpense);
    // Add delegated listeners for edit/delete buttons in the expenses table
    addDelegatedListener('expenses-body', 'click', '.edit-expense-btn', editExpense);
    addDelegatedListener('expenses-body', 'click', '.delete-expense-btn', deleteExpense);
}

function setupInvoiceListeners() {
    addListener('generate-invoice', 'click', handleGenerateInvoiceClick);
    addListener('view-invoice-entries', 'click', viewInvoiceEntries);
    const printBtn = document.getElementById('print-invoice');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    addListener('save-invoice-pdf', 'click', saveInvoicePdf);
    addListener('export-invoice-excel', 'click', exportInvoiceExcel);
    addListener('mark-as-paid', 'click', markCurrentlyGeneratedInvoicePaid); // Renamed handler

    // Listener for checkboxes in invoice preview using delegation
    addDelegatedListener('invoice-entries-preview', 'change', '.include-entry, .include-expense', updateInvoiceTotalsFromPreview);

    // Add delegated listeners for invoice history actions
    addInvoiceHistoryActionListeners();
}

// TODO: Implement fully
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
    // Add delegated listeners for rate template edit/delete
    addRateActionListeners();
}

// TODO: Implement fully
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
        updateDashboard(appState, getDashboardDependencies()); // Pass state/deps
    });
}

function setupDateRangeListeners() {
    const addRangeListener = (selectId, customRangeId) => {
        const select = document.getElementById(selectId);
        const customRange = document.getElementById(customRangeId);
        if (select && customRange) {
            select.addEventListener('change', () => {
                customRange.style.display = select.value === 'custom' ? 'flex' : 'none'; // Use flex for layout
            });
            customRange.style.display = select.value === 'custom' ? 'flex' : 'none';
        }
    };
    addRangeListener('date-range', 'custom-date-range');
    addRangeListener('dash-date-range', 'dash-custom-date-range');
    addRangeListener('invoice-date-range', 'invoice-custom-date-range');
    addRangeListener('report-date-range', 'report-custom-date-range');
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

// Helper to get dependencies for dashboard
function getDashboardDependencies() {
    return {
        Chart: window.Chart, // Assuming Chart is global
        showNotification: showNotification,
        formatCurrency: formatCurrency,
        formatDate: formatDate, // Pass formatting helpers
        getDateRangeFromOption: getDateRangeFromOption // Pass date range helper
    };
}


// --- Authentication ---

async function handleLogin(e) {
    e.preventDefault();
    const email = getInputValue('login-email');
    const password = getInputValue('login-password');
    if (!email || !password) return showNotification('Enter email and password.', 'error');

    try {
        // Assumes SupabaseAPI.signIn returns { success, user, error } and handles case mapping
        const result = await SupabaseAPI.signIn(email, password);
        if (!result.success) throw result.error;

        appState.user = result.user;
        await loadUserData(); // Load user-specific data
        showApp();
        showNotification('Logged in!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message || 'Login failed.', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const email = getInputValue('signup-email');
    const password = getInputValue('signup-password');
    const confirmPassword = getInputValue('signup-confirm-password');

    if (!email || !password) return showNotification('Please fill all fields.', 'error');
    if (password !== confirmPassword) return showNotification('Passwords do not match.', 'error');
    if (password.length < 6) return showNotification('Password >= 6 characters.', 'error');

    try {
        // Assumes SupabaseAPI.signUp returns { success, error }
        const result = await SupabaseAPI.signUp(email, password);
        if (!result.success) throw result.error;

        showNotification('Account created! Check email to confirm.', 'success');
        toggleAuthForms(false); // Show login
    } catch (error) {
        console.error('Signup error:', error);
        showNotification(error.message || 'Signup failed.', 'error');
    }
}

async function handleLogout() {
    try {
        // Assumes SupabaseAPI.signOut returns true/false or throws
        const success = await SupabaseAPI.signOut();
        if (!success) throw new Error("Sign out failed.");

        appState.user = null;
        appState.entries = [];
        appState.expenses = [];
        appState.invoices = [];
        appState.recurringEntries = [];
        appState.rates = []; // Clear rates or keep defaults?
        // Reset settings to defaults
        appState.settings = { /* ... default settings object ... */ };
        appState.currentFormData = null;
        appState.currentInvoicePreview = { filteredEntries: [], filteredExpenses: [], includedEntryIds: new Set(), includedExpenseIds: new Set() };
        appState.currentlyGeneratedInvoice = null;

        showLoginForm();
        clearUIOnLogout(); // Clear tables, summaries etc.
        showNotification('Logged out.', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed.', 'error');
    }
}

function clearUIOnLogout() {
     // Clear tables
     ['entries-body', 'expenses-body', 'invoice-history-body', 'rates-container', 'recurring-entries-container', 'report-container', 'invoice-preview', 'invoice-entries-body', 'invoice-expenses-body'].forEach(id => {
         const el = document.getElementById(id);
         if (el) el.innerHTML = '';
     });
     // Add "No data" messages back if appropriate
     document.getElementById('no-recurring').style.display = 'block';
     document.getElementById('no-report').style.display = 'block';
     document.querySelector('.invoice-history').style.display = 'none';
     document.getElementById('invoice-entries-preview').style.display = 'none';


     // Clear summaries
     ['total-hours', 'filtered-hours', 'dash-total-hours', 'dash-avg-hours', 'dash-days-tracked'].forEach(id => setTextContent(id, '0'));
     ['total-amount', 'filtered-amount', 'total-expenses', 'dash-total-revenue', 'dash-avg-revenue', 'dash-avg-rate', 'dash-total-expenses', 'dash-net-income'].forEach(id => setTextContent(id, formatCurrency(0)));

     // Clear dropdowns
     updateClientProjectDropdowns();
     updateRateDropdowns();

     // Clear forms
     cancelEdit(); // Clears time entry form
     // TODO: Clear expense form, invoice form, report form, settings form (or repopulate with defaults)
     populateSettingsForm(); // Repopulate with defaults
}

function toggleAuthForms(showSignup) {
    document.getElementById('login-form-container').style.display = showSignup ? 'none' : 'block';
    document.getElementById('signup-form-container').style.display = showSignup ? 'block' : 'none';
}

// --- Settings ---

async function saveCoreSettings() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    // Data fetched using camelCase from form
    const settingsData = {
        defaultRate: parseFloat(getInputValue('default-rate')) || 350,
        defaultPaymentTerms: getInputValue('default-payment-terms'),
        name: getInputValue('your-name'),
        email: getInputValue('your-email'),
        address: getInputValue('your-address'),
        paymentInstructions: getInputValue('payment-instructions'),
    };
    if (isNaN(settingsData.defaultRate) || settingsData.defaultRate <= 0) {
        return showNotification('Invalid Default Rate.', 'error');
    }
    try {
        // Pass camelCase data to SupabaseAPI.saveSettings (expects it to handle mapping)
        const saved = await SupabaseAPI.saveSettings({ userId: appState.user.id, ...settingsData });
        if (!saved) throw new Error("API returned no data or error.");
        // Update local state with potentially returned data (already camelCase)
        appState.settings = { ...appState.settings, ...saved };
        populateSettingsForm(); // Refresh form with potentially corrected values
        showNotification('Settings saved!', 'success');
    } catch (error) {
        console.error('Error saving core settings:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function saveDisplaySettings() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    const settingsData = {
        theme: getInputValue('theme-selection'),
        dateFormat: getInputValue('date-format'),
        currency: getInputValue('currency-format'),
    };
    try {
        applyTheme(settingsData.theme); // Apply immediately
        // Pass camelCase data to SupabaseAPI.saveSettings
        const saved = await SupabaseAPI.saveSettings({ userId: appState.user.id, ...settingsData });
        if (!saved) throw new Error("API returned no data or error.");
        // Update local state
        appState.settings = { ...appState.settings, ...saved };
        populateSettingsForm(); // Refresh form
        showNotification('Display settings saved!', 'success');
        // Re-render parts affected by format changes
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        if (document.getElementById('dashboard-tab')?.style.display === 'block') {
            updateDashboard(appState, getDashboardDependencies());
        }
    } catch (error) {
        console.error('Error saving display settings:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function toggleDarkMode() {
    const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    appState.settings.theme = newTheme; // Update state first
    setInputValue('theme-selection', newTheme); // Update dropdown
    applyTheme(newTheme); // Apply visual change
    if (appState.user) { // Save async
        SupabaseAPI.saveSettings({ userId: appState.user.id, theme: newTheme })
            .catch(error => console.error("Failed to save theme:", error));
    }
}

// TODO: Implement fully
async function addRateTemplate() {
     if (!appState.user) return showNotification('You must be logged in.', 'error');
     const name = getInputValue('rate-name').trim();
     const amount = parseFloat(getInputValue('rate-amount'));
     if (!name || isNaN(amount) || amount <= 0) return showNotification('Valid name & positive amount required.', 'error');

     console.log("TODO: Implement addRateTemplate");
     showNotification('TODO: Add rate template functionality', 'info');
     try {
        // const newRate = await SupabaseAPI.addRate({ userId: appState.user.id, name, amount }); // Assumes addRate exists
        // if (newRate) {
        //    appState.rates.push(newRate);
        //    populateRateTemplates();
        //    setInputValue('rate-name', '');
        //    setInputValue('rate-amount', '');
        //    showNotification('Rate template added!', 'success');
        // }
     } catch (error) { showNotification(error.message, 'error'); }
}

// TODO: Implement fully
function editRateTemplate(id) {
     console.log("TODO: Edit rate template", id);
     // Find rate in appState.rates, populate form, change button to 'Update Rate'
}
// TODO: Implement fully
async function deleteRateTemplate(id) {
     if (!confirm('Delete this rate template?')) return;
     console.log("TODO: Delete rate template", id);
     // Call SupabaseAPI.deleteRate(id)
     // If success, remove from appState.rates, call populateRateTemplates
}

// --- Data Management --- (export/import simplified, assume JSON includes all needed state)

function exportData() {
    // Exports current appState (excluding sensitive/transient stuff)
    try {
        const stateToExport = {
            version: '2.0', // Update if format changes
            exportDate: new Date().toISOString(),
            settings: appState.settings,
            rates: appState.rates,
            recurringEntries: appState.recurringEntries,
            entries: appState.entries,
            expenses: appState.expenses,
            // Maybe omit invoices or handle separately due to complexity/size
        };
        const jsonData = JSON.stringify(stateToExport, null, 2);
        triggerDownload(jsonData, `timetracker_export_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
        showNotification('Data exported!', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Export failed.', 'error');
    }
}

async function importData(e) {
    // Imports data from JSON, overwriting existing data after confirmation
    const file = e.target.files[0];
    if (!file || !appState.user) return; // Need user context for saving potentially

    readFileAsText(file)
        .then(async text => {
            const data = JSON.parse(text);
            // Basic validation
            if (!data || typeof data !== 'object') throw new Error("Invalid file format.");
            // Add more checks based on expected structure (e.g., data.version)

            if (!confirm('Importing will REPLACE current data (entries, expenses, settings, rates, etc.). Continue?')) {
                throw new Error("Import cancelled by user."); // Throw error to stop processing
            }

            // --- TODO: Implement saving imported data to Supabase ---
            // This is complex. It involves potentially:
            // 1. Deleting existing user data (entries, expenses, rates etc.)
            // 2. Saving imported settings (SupabaseAPI.saveSettings)
            // 3. Bulk inserting imported rates (SupabaseAPI.addRate batch?)
            // 4. Bulk inserting entries (SupabaseAPI.addTimeEntry batch?)
            // 5. Bulk inserting expenses (SupabaseAPI.addExpense batch?)
            // 6. Bulk inserting recurring entries...
            // This requires careful transaction handling or batching in supabase.js
            // For now, just load into local state for demo:
             console.warn("TODO: Implement saving imported data to Supabase.");

             appState.settings = data.settings || appState.settings;
             appState.rates = data.rates || [];
             appState.recurringEntries = data.recurringEntries || [];
             appState.entries = data.entries || [];
             appState.expenses = data.expenses || [];

            // Reload all UI from the new state
             await loadUserData(); // This re-fetches but could be optimized to use imported state directly
             // Or call UI update functions directly:
             // populateSettingsForm(); populateRateTemplates(); updateTimeEntriesTable(); etc...

            showNotification('Data loaded from file! (Save to DB not implemented)', 'success');

        })
        .catch(error => {
            console.error('Import failed:', error);
            showNotification(`Import failed: ${error.message}`, 'error');
        })
        .finally(() => {
            e.target.value = ''; // Clear file input
        });
}

// TODO: Implement fully
function exportCSV() {
    console.log("TODO: Implement CSV Export");
    showNotification('TODO: CSV Export', 'info');
    // Needs logic to convert entries/expenses to CSV string and trigger download
}
// TODO: Implement fully
function applyFilters() {
    console.log("TODO: Implement Apply Filters");
    showNotification('TODO: Filtering', 'info');
    // Needs to filter appState.entries/expenses and call updateTable/updateSummary
}
// TODO: Implement fully
function clearFilters() {
     console.log("TODO: Implement Clear Filters");
     showNotification('TODO: Filter clearing', 'info');
     // Reset filter inputs, call applyFilters or reload all data
}

// --- Auto Save --- (Simplified, assumes camelCase in formData)

const AUTO_SAVE_DELAY = 2500;

function setupAutoSave() {
    const fields = ['date', 'description', 'client', 'project', 'hours', 'rate'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('input', handleAutoSaveInput);
            if (field.type === 'date') field.addEventListener('change', handleAutoSaveInput);
        }
    });
    // Loading handled in loadUserData
}

function handleAutoSaveInput() {
     if (appState.autoSaveTimeout) clearTimeout(appState.autoSaveTimeout);
     appState.autoSaveTimeout = setTimeout(saveCurrentFormData, AUTO_SAVE_DELAY);
}

async function saveCurrentFormData() {
    if (!appState.user) return;
    const formData = { // Use camelCase
        date: getInputValue('date'),
        description: getInputValue('description'),
        client: getInputValue('client'),
        project: getInputValue('project'),
        hours: getInputValue('hours'),
        rate: getInputValue('rate'),
        editId: getInputValue('edit-id'),
        lastUpdated: new Date().toISOString()
    };
    if (!formData.editId && !formData.description && !formData.hours && !formData.client && !formData.project) {
        if (appState.currentFormData) await clearSavedFormData();
        return;
    }
    appState.currentFormData = formData;
    try {
        localStorage.setItem(`formData_${appState.user.id}`, JSON.stringify(formData));
        // Pass camelCase formData (SupabaseAPI handles mapping)
        if (await SupabaseAPI.saveFormDataToDatabase(appState.user.id, formData)) {
             showAutoSaveIndicator();
        }
    } catch (err) { console.error('Error saving form data:', err); }
}

function getFormDataFromLocalStorage() {
    if (!appState.user) return null;
    const saved = localStorage.getItem(`formData_${appState.user.id}`);
    try { return saved ? JSON.parse(saved) : null; }
    catch (e) { console.error("Error parsing localStorage form data", e); return null; }
}

function loadFormDataIntoForm(formData) {
    if (!formData) return;
    try {
        setInputValue('date', formData.date || new Date().toISOString().substring(0, 10));
        setInputValue('description', formData.description || '');
        setInputValue('client', formData.client || '');
        setInputValue('project', formData.project || '');
        setInputValue('hours', formData.hours || '');
        setInputValue('rate', formData.rate || appState.settings.defaultRate || '');
        setInputValue('edit-id', formData.editId || '');
        setEditModeUI(!!formData.editId);
        console.log('Loaded form data into form fields.');
    } catch (err) { console.error('Error loading form data into form:', err); }
}

async function clearSavedFormData() {
    if (!appState.user) return;
    appState.currentFormData = null;
    try {
        localStorage.removeItem(`formData_${appState.user.id}`);
        await SupabaseAPI.saveFormDataToDatabase(appState.user.id, null);
        console.log("Cleared saved form data.");
    } catch (err) { console.error('Error clearing saved form data:', err); }
}

function showAutoSaveIndicator() { /* ... same as before ... */ }

// --- Time Entry CRUD --- (Simplified, assumes camelCase)

async function addTimeEntry() { /* ... similar logic, ensure entry object uses camelCase, call SupabaseAPI.addTimeEntry ... */ }
async function updateTimeEntry() { /* ... similar logic, ensure updatedEntryData uses camelCase, call SupabaseAPI.updateTimeEntry ... */ }
function editTimeEntry(id) { /* ... similar logic ... */ }
async function deleteTimeEntry(id) { /* ... similar logic ... */ }
function cancelEdit() { /* ... similar logic ... */ }
function resetTimeEntryForm() { /* ... similar logic ... */ }
function setEditModeUI(isEditing) {
    document.getElementById('add-entry').style.display = isEditing ? 'none' : 'inline-block';
    document.getElementById('update-entry').style.display = isEditing ? 'inline-block' : 'none';
    document.getElementById('cancel-edit').style.display = isEditing ? 'inline-block' : 'none';
    setTextContent('form-title', isEditing ? 'Edit Time Entry' : 'Record Time Manually');
}

// --- Expense CRUD (Stubs) --- (Requires full implementation)
async function addExpense() { /* ... get form data, validate, call SupabaseAPI.addExpense ... */ }
function editExpense(id) { /* ... find expense, populate form, need updateExpense ... */ }
async function deleteExpense(id) { /* ... confirm, call SupabaseAPI.deleteExpense, update UI ... */ }

// --- Recurring Entries (Stubs) ---
async function saveRecurringEntry() { /* ... get form data, call SupabaseAPI.saveRecurringEntry, update UI ... */ }

// --- Invoice Generation --- (Simplified flow, using preview state)

function filterInvoiceItems(client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses) {
    // ... same filtering logic as before, returning { filteredEntries, filteredExpenses } ...
}

function viewInvoiceEntries() {
     // ... same logic to filter and populate preview state/table ...
     // Calls updateInvoiceTotalsFromPreview() at the end
}

function updateInvoiceTotalsFromPreview() {
     // ... same logic to update included IDs sets and recalculate/display totals ...
}

function handleGenerateInvoiceClick() { // Renamed
     if (!appState.currentInvoicePreview || (appState.currentInvoicePreview.includedEntryIds.size === 0 && appState.currentInvoicePreview.includedExpenseIds.size === 0)) {
         return showNotification('View and select items to include first.', 'warning');
     }
     generateInvoicePreview(); // Renamed
}

function generateInvoicePreview() { // Renamed
    // Uses appState.currentInvoicePreview data directly
    const includedEntries = appState.currentInvoicePreview.filteredEntries.filter(e => appState.currentInvoicePreview.includedEntryIds.has(e.id));
    const includedExpenses = appState.currentInvoicePreview.filteredExpenses.filter(e => appState.currentInvoicePreview.includedExpenseIds.has(e.id));
    try {
        // Get other details (client, invoice#, date, etc.)
        const invoiceDetails = {
             client: getInputValue('invoice-client'),
             project: getInputValue('invoice-project'),
             invoiceNumber: getInputValue('invoice-number') || generateInvoiceNumber(),
             invoiceDate: getInputValue('invoice-date') || new Date().toISOString().slice(0, 10),
             paymentTerms: getInputValue('payment-terms') || appState.settings.defaultPaymentTerms,
             notes: getInputValue('invoice-notes') || '',
        };
        if (!invoiceDetails.client) return showNotification("Client required.", "error");

        // Recalculate totals strictly from included items
        const totalHours = includedEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const totalAmount = includedEntries.reduce((sum, entry) => sum + entry.amount, 0);
        const totalExpenses = includedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const grandTotal = totalAmount + totalExpenses;

        // Prepare final invoice object (camelCase for consistency in JS)
        appState.currentlyGeneratedInvoice = {
            invoice: { // Main invoice data
                userId: appState.user.id, // Link to user
                invoiceNumber: invoiceDetails.invoiceNumber,
                client: invoiceDetails.client,
                project: invoiceDetails.project !== 'all' ? invoiceDetails.project : null,
                invoiceDate: invoiceDetails.invoiceDate,
                paymentTerms: invoiceDetails.paymentTerms,
                notes: invoiceDetails.notes,
                totalHours: totalHours,
                totalAmount: totalAmount,
                expensesAmount: totalExpenses,
                grandTotal: grandTotal,
                status: 'draft' // Initial status, change on save/payment
            },
            items: [ // Line items
                ...includedEntries.map(e => ({ type: 'time', sourceId: e.id, ...e })), // Include original entry details
                ...includedExpenses.map(e => ({ type: 'expense', sourceId: e.id, ...e })) // Include original expense details
            ]
        };

        // Generate and display HTML
        const invoiceHtml = generateInvoiceHtml(appState.currentlyGeneratedInvoice);
        document.getElementById('invoice-preview').innerHTML = invoiceHtml;
        document.getElementById('invoice-preview').style.display = 'block';
        // Show action buttons
        ['print-invoice', 'save-invoice-pdf', 'export-invoice-excel', 'mark-as-paid'].forEach(id => {
            const btn = document.getElementById(id); if(btn) btn.style.display = 'inline-block';
        });
        // TODO: Add a "Save Invoice to Database" button?
        showNotification('Invoice preview generated!', 'success');
    } catch (error) {
        console.error('Error generating invoice preview:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function generateInvoiceHtml(invoiceData) { /* ... same as before, use formatDate/formatCurrency ... */ }
function generateInvoiceNumber() { /* ... same as before ... */ }
function saveInvoicePdf() { /* ... TODO: Placeholder ... */ }
function exportInvoiceExcel() { /* ... TODO: Placeholder ... */ }

// Renamed handler, specific to the currently generated preview
async function markCurrentlyGeneratedInvoicePaid() {
    if (!appState.user) return showNotification('You must be logged in.', 'error');
    const currentInvoice = appState.currentlyGeneratedInvoice?.invoice;
    if (!currentInvoice) return showNotification('Generate an invoice first.', 'warning');
    // This should ideally operate on a *saved* invoice ID from the database
    console.warn("TODO: Implement marking SAVED invoice as paid via SupabaseAPI.");
    showNotification('TODO: Implement marking SAVED invoice as paid.', 'info');
    // Needs: 1) Save invoice first to get DB ID. 2) Call SupabaseAPI.updateInvoiceStatus(id, 'paid'). 3) Update UI.
}

// TODO: Implement these handlers for history table actions
function viewInvoiceFromHistory(id) { console.log("TODO: View invoice from history", id); /* Fetch full invoice data, display in preview? */ }
async function deleteInvoiceFromHistory(id) { console.log("TODO: Delete invoice from history", id); /* Confirm, call SupabaseAPI.deleteInvoice(id), update UI */ }
async function markInvoicePaidFromHistory(id) { console.log("TODO: Mark invoice paid from history", id); /* Call SupabaseAPI.updateInvoiceStatus(id, 'paid'), update UI */ }


// --- Reports (Stubs) ---
function generateReport() { /* ... TODO: Placeholder ... */ }
function exportReport() { /* ... TODO: Placeholder ... */ }

// --- Database Setup Check ---
async function showDatabaseSetupModal() { /* ... same as before, using runSetupChecks ... */ }

// --- Tab Navigation ---
function openTab(evt, tabName) { /* ... same as before, calls updateDashboard correctly ... */ }

// --- Utility Functions ---

function showNotification(message, type = 'info') { /* ... same as before ... */ }
function escapeHtml(unsafe) { /* ... same as before ... */ }
function formatCurrency(amount, currencyCode = appState.settings.currency) { /* ... same as before, uses appState currency ... */ }
function formatDate(dateString, format = appState.settings.dateFormat) { /* ... same as before, uses appState format ... */ }
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... same as before ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... same as before ... */ }

// Helper to get input value safely
function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
// Helper to set input value safely
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? ''; // Use nullish coalescing for robustness
}
// Helper to set text content safely
function setTextContent(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text ?? '';
}
// Helper to trigger file download
function triggerDownload(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
// Helper to read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

console.log("app.js refactored loaded.");
