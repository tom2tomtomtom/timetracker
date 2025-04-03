// App.js - Main application logic (Refactored - V13 Duplicate Removed)

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

// --- Utility / Helper Functions --- (Defined FIRST) ---
function showNotification(message, type = 'info') {
    try {
        console.log(`[NOTIFICATION-${type.toUpperCase()}]: ${message}`); // Log notification attempt
        const notification = document.createElement('div');
        notification.className = `notification ${type}`; // Use classes for styling
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3500); // Slightly longer display
    } catch (domError) { console.error("DOM Notification Error:", message, domError); }
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
         if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { date = new Date(dateString + 'T00:00:00Z'); } // Treat YYYY-MM-DD as UTC
         else { date = new Date(dateString); } // Try standard parsing
         if (isNaN(date.getTime())) throw new Error("Invalid Date");
         const options = {}; const locale = undefined;
         switch (format) {
             case 'DD/MM/YYYY': options.day = '2-digit'; options.month = '2-digit'; options.year = 'numeric'; break;
             case 'YYYY-MM-DD': options.year = 'numeric'; options.month = '2-digit'; options.day = '2-digit'; return date.toISOString().slice(0, 10);
             case 'MM/DD/YYYY': default: options.month = '2-digit'; options.day = '2-digit'; options.year = 'numeric'; break;
         }
          if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { options.timeZone = 'UTC'; }
         return new Intl.DateTimeFormat(locale, options).format(date);
     } catch (e) { console.warn("Error formatting date:", dateString, e); return dateString; }
}
function calculateDueDate(invoiceDateStr, paymentTerms) { /* ... same ... */ }
function getDateRangeFromOption(option, fromDateStr, toDateStr) { /* ... same ... */ }
function triggerDownload(content, filename, contentType) { /* ... same ... */ }
function readFileAsText(file) { /* ... same ... */ }
function showLoadingIndicator(show) { console.log(`Loading: ${show}`); /* TODO: Visual indicator */ }
function getFormDataFromLocalStorage() { /* ... same ... */ }
// *** addListener DEFINED ONCE HERE ***
function addListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
    else console.warn(`Listener Warning: Element ID "${id}" not found.`);
}
function addDelegatedListener(parentElementId, event, selector, handler) { /* ... same ... */ }


// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing application...");
    
    try {
        // Check if Supabase connection is valid
        const isConnected = await checkSupabaseConnection();
        if (!isConnected) {
            showNotification("Failed to connect to database. Please check your configuration.", "error");
            return;
        }
        
        // Setup event listeners
        setupEventListeners();
        
        // Set default dates
        setDefaultDates();
        
        // Check if user is logged in
        const { data: { session } } = await SupabaseAPI.supabase.auth.getSession();
        
        if (session) {
            console.log("User authenticated:", session.user.email);
            appState.user = session.user;
            
            // Load user data
            await loadUserData();
            
            // Show application
            showApp();
            
            // Dashboard will be initialized when the user clicks on the dashboard tab
        } else {
            console.log("No active session found. Showing login form.");
            showLoginForm();
        }
    } catch (error) {
        console.error("Error during initialization:", error);
        showNotification("Failed to initialize application. See console for details.", "error");
    }
}
async function checkSupabaseConnection() {
    console.log("Checking Supabase connection...");
    try {
        const { error } = await SupabaseAPI.supabase.from('time_entries').select('id').limit(1);
        if (error) {
            console.error("Supabase connection error:", error);
            return false;
        }
        console.log("Supabase connection successful");
        return true;
    } catch (error) {
        console.error("Supabase connection check failed:", error);
        return false;
    }
}
function setDefaultDates() { /* ... same ... */ }
async function loadUserData() {
    console.log("Loading user data...");
    try {
        showLoadingIndicator(true);
        
        // Fetch all user data in parallel
        const [
            entriesData,
            expensesData,
            ratesData,
            settings,
            recurringEntriesData,
            invoicesData
        ] = await Promise.all([
            SupabaseAPI.getTimeEntries(),
            SupabaseAPI.getExpenses(),
            SupabaseAPI.getRates(),
            SupabaseAPI.getSettings(appState.user.id),
            SupabaseAPI.getRecurringEntries(),
            SupabaseAPI.getInvoices()
        ]);
        
        // Update application state
        appState.entries = entriesData;
        appState.expenses = expensesData;
        appState.rates = ratesData || [{ id: 1, name: 'Standard Rate', amount: 350 }];
        appState.recurringEntries = recurringEntriesData;
        appState.invoices = invoicesData;
        
        // Load settings if available
        if (settings) {
            appState.settings = settings;
        }
        
        // Apply theme from settings
        applyTheme(appState.settings.theme);
        
        // Update UI elements
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        updateClientProjectDropdowns(); // Use the updated function
        updateRecurringEntriesUI();
        updateInvoiceHistoryTable();
        populateSettingsForm();
        populateRateTemplates();
        updateRateDropdowns();
        
        // Load auto-saved form data if any
        const formData = await SupabaseAPI.getFormDataFromDatabase(appState.user.id);
        if (formData) {
            appState.currentFormData = formData;
            loadFormDataIntoForm(formData);
            showAutoSaveIndicator();
        }
        
        console.log("User data loaded successfully");
    } catch (error) {
        console.error("Error loading user data:", error);
        showNotification("Failed to load some data. Please refresh the page.", "error");
    } finally {
        showLoadingIndicator(false);
    }
}

// --- UI Updates ---
function showApp() {
    console.log("Showing app interface...");
    
    // Hide login/signup container and show main app
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    // Show welcome message with user email
    const userEmail = appState.user ? appState.user.email : 'User';
    const userWelcome = document.getElementById('user-welcome');
    if (userWelcome) {
        userWelcome.textContent = userEmail;
    }
    
    // Populate dashboard tab if it's empty
    const dashboardTab = document.getElementById('dashboard-tab');
    if (dashboardTab && dashboardTab.innerHTML.trim() === '') {
        // Load dashboard content from time-tracker.html
        fetch('time-tracker.html')
            .then(response => response.text())
            .then(html => {
                // Extract dashboard content
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const dashboardContent = doc.getElementById('dashboard-tab');
                
                if (dashboardContent) {
                    dashboardTab.innerHTML = dashboardContent.innerHTML;
                    console.log("Dashboard content loaded from time-tracker.html");
                    
                    // Re-initialize dashboard after content is loaded
                    getDashboardDependencies().then(deps => {
                        if (deps && deps.initDashboard) {
                            deps.initDashboard(appState, deps);
                        }
                    });
                }
            })
            .catch(error => console.error("Error loading dashboard content:", error));
    }
}
function showLoginForm() { /* ... same ... */ }
function applyTheme(themePreference) { /* ... same ... */ }
function populateSettingsForm() { /* ... same ... */ }
function populateRateTemplates() { /* ... same ... */ }
function updateRateDropdowns() { /* ... same ... */ }
function updateTimeEntriesTable() {
    console.log("Updating time entries table...");
    console.log("Number of entries:", appState.entries.length);
    
    // Update table with all entries
    updateTimeEntriesTableWithData(appState.entries);
}
function updateExpensesTable() {
    console.log("Updating expenses table...");
    console.log("Number of expenses:", appState.expenses.length);
    
    const tableBody = document.getElementById('expenses-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Sort expenses by date (newest first)
    const sortedExpenses = [...appState.expenses].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    let totalExpenses = 0;
    
    sortedExpenses.forEach(expense => {
        totalExpenses += Number(expense.amount || 0);
        
        const row = document.createElement('tr');
        
        const formattedDate = formatDate(expense.date);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHtml(expense.description)}</td>
            <td>${formatCurrency(expense.amount)}</td>
            <td>${escapeHtml(expense.client || '')}</td>
            <td>${escapeHtml(expense.project || '')}</td>
            <td>
                <button class="edit-expense-btn blue-btn" data-id="${expense.id}" style="margin-right: 5px; padding: 5px 10px;">Edit</button>
                <button class="delete-expense-btn" data-id="${expense.id}" style="padding: 5px 10px;">Delete</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update total expenses
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    
    // Add edit and delete event listeners
    document.querySelectorAll('.edit-expense-btn').forEach(button => {
        button.addEventListener('click', () => editExpense(button.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.delete-expense-btn').forEach(button => {
        button.addEventListener('click', () => deleteExpense(button.getAttribute('data-id')));
    });
    
    console.log(`Expenses updated: ${sortedExpenses.length} expenses, ${formatCurrency(totalExpenses)}`);
}
function updateSummary() {
    console.log("Updating summary...");
    
    // Calculate totals
    const totalHours = appState.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const totalAmount = appState.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    
    // Update UI
    document.getElementById('total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('total-amount').textContent = formatCurrency(totalAmount);
    
    // Initially set filtered values to match totals (until filters are applied)
    document.getElementById('filtered-hours').textContent = totalHours.toFixed(2);
    document.getElementById('filtered-amount').textContent = formatCurrency(totalAmount);
    
    console.log(`Summary updated: ${totalHours.toFixed(2)} hours, ${formatCurrency(totalAmount)}`);
}
function updateClientProjectDropdowns() {
    try {
        // Get unique clients
        const clients = [...new Set(appState.entries.map(entry => entry.client).filter(Boolean))];
        
        // Get unique projects
        const projects = [...new Set(appState.entries.map(entry => entry.project).filter(Boolean))];
        
        // Populate client dropdowns
        const clientDropdowns = [
            'filter-client', 
            'dash-client', 
            'invoice-client', 
            'report-client',
            'timer-client'
        ];
        
        clientDropdowns.forEach(id => {
            const dropdown = document.getElementById(id);
            if (dropdown) {
                // Keep the first option
                const firstOption = dropdown.options[0];
                dropdown.innerHTML = '';
                dropdown.appendChild(firstOption);
                
                // Add client options
                clients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client;
                    option.textContent = client;
                    dropdown.appendChild(option);
                });
            }
        });
        
        // Populate project dropdowns
        const projectDropdowns = [
            'filter-project', 
            'dash-project', 
            'invoice-project', 
            'report-project',
            'timer-project'
        ];
        
        projectDropdowns.forEach(id => {
            const dropdown = document.getElementById(id);
            if (dropdown) {
                // Keep the first option
                const firstOption = dropdown.options[0];
                dropdown.innerHTML = '';
                dropdown.appendChild(firstOption);
                
                // Add project options
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project;
                    option.textContent = project;
                    dropdown.appendChild(option);
                });
            }
        });
        
        // Also update datalists
        const clientDataLists = ['clients-list', 'clients-list-expense'];
        clientDataLists.forEach(id => {
            const datalist = document.getElementById(id);
            if (datalist) {
                datalist.innerHTML = '';
                clients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client;
                    datalist.appendChild(option);
                });
            }
        });
        
        const projectDataLists = ['projects-list', 'projects-list-expense'];
        projectDataLists.forEach(id => {
            const datalist = document.getElementById(id);
            if (datalist) {
                datalist.innerHTML = '';
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project;
                    datalist.appendChild(option);
                });
            }
        });
    } catch (err) {
        console.error('Error populating dropdowns:', err);
    }
}
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { /* ... same ... */ }
function populateDatalist(elementId, optionsArray) { /* ... same ... */ }
function updateRecurringEntriesUI() { /* ... same ... */ }
function updateInvoiceHistoryTable() { /* ... same ... */ }

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Set up all event listeners
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
    setupDatabaseCheckListener(); // Ensure this is called
}
// --- Specific Listener Setup Function DEFINITIONS ---
// addListener defined above
// addDelegatedListener defined above
function setupAuthListeners() { /* ... same ... */ }
function setupNavigationListeners() {
    // Tab navigation buttons
    const tabButtons = document.querySelectorAll('[data-tab]');
    tabButtons.forEach(button => {
        const tabId = button.getAttribute('data-tab');
        button.addEventListener('click', (e) => {
            openTab(e, tabId);
            
            // If dashboard tab is opened, make sure it's initialized
            if (tabId === 'dashboard-tab') {
                initDashboardIfNeeded();
            }
        });
    });
}

// Helper function to initialize dashboard when needed
async function initDashboardIfNeeded() {
    console.log("Checking if dashboard needs initialization...");
    
    const dashboardTab = document.getElementById('dashboard-tab');
    if (!dashboardTab) return;
    
    // Only initialize if tab is visible and not already initialized
    if (dashboardTab.style.display !== 'none' && !dashboardTab.dataset.initialized) {
        const dashboardDeps = await getDashboardDependencies();
        if (dashboardDeps && dashboardDeps.initDashboard) {
            dashboardDeps.initDashboard(appState, dashboardDeps);
            dashboardTab.dataset.initialized = 'true';
        }
    }
}
function setupTimeEntryListeners() {
    // Time entry form
    addListener('add-entry', 'click', addTimeEntry);
    addListener('update-entry', 'click', updateTimeEntry);
    addListener('cancel-edit', 'click', cancelEdit);
    
    // Filter buttons
    addListener('apply-filters', 'click', applyFilters);
    addListener('clear-filters', 'click', clearFilters);
    
    // Recurring entries
    addListener('save-recurring', 'click', saveRecurringEntry);
    addRecurringEntryActionListeners();
    
    // Timer buttons
    addListener('start-timer', 'click', startTimer);
    addListener('pause-timer', 'click', pauseTimer);
    addListener('resume-timer', 'click', resumeTimer);
    addListener('stop-timer', 'click', stopAndSaveTimer);
    addListener('cancel-timer', 'click', cancelTimer);
}
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
function setupDatabaseCheckListener() {
    // Add event listener to the check-setup button
    addListener('check-setup', 'click', showDatabaseSetupModal);
}
function addRecurringEntryActionListeners() { /* ... same ... */ }
async function getDashboardDependencies() {
    console.log("Getting dashboard dependencies...");
    try {
        // Import dashboard module dynamically
        const dashboardModule = await import('./dashboard.js');
        
        // Get reference to Chart.js library
        const Chart = window.Chart;
        
        if (!Chart) {
            console.warn("Chart.js not found in global scope. Attempting to load it...");
            
            // Try to load Chart.js dynamically if not available
            try {
                await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
                console.log("Chart.js loaded dynamically");
            } catch (scriptError) {
                console.error("Failed to load Chart.js:", scriptError);
            }
        }
        
        return {
            initDashboard: dashboardModule.initDashboard,
            updateDashboard: dashboardModule.updateDashboard,
            Chart: window.Chart, // Pass Chart.js reference
            formatCurrency: formatCurrency,
            formatDate: formatDate
        };
    } catch (error) {
        console.error("Error loading dashboard dependencies:", error);
        return null;
    }
}

// Helper function to load a script dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
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
function exportCSV() {
    console.log("Exporting CSV...");
    
    // Get filtered entries
    const entries = appState.entries; // Use filteredEntries instead if you implement filtering
    
    if (entries.length === 0) {
        showNotification("No entries to export", "error");
        return;
    }
    
    // Create CSV header
    let csv = "Date,Description,Client,Project,Hours,Rate,Amount\n";
    
    // Add rows for each entry
    entries.forEach(entry => {
        const rowData = [
            formatDate(entry.date, 'YYYY-MM-DD'),
            `"${entry.description.replace(/"/g, '""')}"`, // Escape quotes
            `"${entry.client || ''}".replace(/"/g, '""')`,
            `"${entry.project || ''}".replace(/"/g, '""')`,
            entry.hours,
            entry.rate,
            entry.amount
        ];
        csv += rowData.join(',') + "\n";
    });
    
    // Trigger download
    triggerDownload(csv, `time-entries-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    showNotification("CSV exported successfully", "success");
}

function applyFilters() {
    console.log("Applying filters...");
    
    // Get filter values
    const dateRangeOption = document.getElementById('date-range').value;
    const clientFilter = document.getElementById('filter-client').value;
    const projectFilter = document.getElementById('filter-project').value;
    
    // Get custom date range if selected
    let customFrom, customTo;
    if (dateRangeOption === 'custom') {
        customFrom = document.getElementById('date-from').value;
        customTo = document.getElementById('date-to').value;
        
        if (!customFrom || !customTo) {
            showNotification("Please select both start and end dates for custom range", "error");
            return;
        }
    }
    
    // Get date range
    const { startDate, endDate } = getDateRangeFromOption(dateRangeOption, customFrom, customTo);
    
    // Filter entries
    const tableBody = document.getElementById('entries-body');
    let filteredEntries = [];
    let filteredHours = 0;
    let filteredAmount = 0;
    
    // Clone the entries before filtering
    filteredEntries = appState.entries.filter(entry => {
        // Check if entry date is within range
        const entryDate = new Date(entry.date + 'T00:00:00Z');
        
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        
        // Check client filter
        if (clientFilter !== 'all' && entry.client !== clientFilter) return false;
        
        // Check project filter
        if (projectFilter !== 'all' && entry.project !== projectFilter) return false;
        
        // Entry passed all filters
        filteredHours += entry.hours;
        filteredAmount += entry.amount;
        return true;
    });
    
    // Update the filtered summary
    document.getElementById('filtered-hours').textContent = filteredHours.toFixed(2);
    document.getElementById('filtered-amount').textContent = filteredAmount.toFixed(2);
    
    // Update table with filtered entries
    updateTimeEntriesTableWithData(filteredEntries);
    
    showNotification(`Showing ${filteredEntries.length} filtered entries`, "info");
}

function updateTimeEntriesTableWithData(entries) {
    const tableBody = document.getElementById('entries-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Sort entries by date (newest first)
    const sortedEntries = [...entries].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    sortedEntries.forEach(entry => {
        const row = document.createElement('tr');
        
        const formattedDate = formatDate(entry.date);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHtml(entry.description)}</td>
            <td>${escapeHtml(entry.client || '')}</td>
            <td>${escapeHtml(entry.project || '')}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${formatCurrency(entry.rate)}</td>
            <td>${formatCurrency(entry.amount)}</td>
            <td>
                <button class="edit-btn blue-btn" data-id="${entry.id}" style="margin-right: 5px; padding: 5px 10px;">Edit</button>
                <button class="delete-btn" data-id="${entry.id}" style="padding: 5px 10px;">Delete</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add delete and edit event listeners
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => deleteTimeEntry(button.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => editTimeEntry(button.getAttribute('data-id')));
    });
}

function clearFilters() {
    console.log("Clearing filters...");
    
    // Reset filter dropdowns
    document.getElementById('date-range').value = 'all';
    document.getElementById('filter-client').value = 'all';
    document.getElementById('filter-project').value = 'all';
    
    // Hide custom date range
    document.getElementById('custom-date-range').style.display = 'none';
    
    // Reset filtered summary to match total
    const totalHours = appState.entries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = appState.entries.reduce((sum, entry) => sum + entry.amount, 0);
    
    document.getElementById('filtered-hours').textContent = totalHours.toFixed(2);
    document.getElementById('filtered-amount').textContent = totalAmount.toFixed(2);
    
    // Update table with all entries
    updateTimeEntriesTableWithData(appState.entries);
    
    showNotification("Filters cleared", "info");
}
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
async function addTimeEntry() {
    console.log("Adding time entry...");
    
    // Get values from form
    const dateInput = document.getElementById('date');
    const descriptionInput = document.getElementById('description');
    const clientInput = document.getElementById('client');
    const projectInput = document.getElementById('project');
    const hoursInput = document.getElementById('hours');
    const rateInput = document.getElementById('rate');
    
    // Validate required fields
    if (!dateInput?.value || !descriptionInput?.value || !hoursInput?.value || !rateInput?.value) {
        showNotification("Please fill in all required fields", "error");
        console.error("Form validation failed: Missing required fields");
        return;
    }
    
    // Get values
    const date = dateInput.value;
    const description = descriptionInput.value;
    const client = clientInput?.value || '';
    const project = projectInput?.value || '';
    const hours = parseFloat(hoursInput.value);
    const rate = parseFloat(rateInput.value);
    const amount = hours * rate;
    
    console.log("New entry data:", { date, description, client, project, hours, rate, amount });
    
    try {
        // Create entry object
        const entryData = {
            date,
            description,
            client,
            project,
            hours,
            rate,
            amount,
            userId: appState.user.id, // Using camelCase as expected by supabase.js
            createdAt: new Date().toISOString() // Using camelCase as expected by supabase.js
        };
        
        // Add to Supabase
        const newEntry = await SupabaseAPI.addTimeEntry(entryData);
        
        if (newEntry) {
            console.log("Entry added successfully:", newEntry);
            
            // Add to local state
            appState.entries.push(newEntry);
            
            // Update UI
            updateTimeEntriesTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            // Clear form
            descriptionInput.value = '';
            hoursInput.value = '';
            clientInput.value = '';
            projectInput.value = '';
            
            showNotification("Time entry added successfully", "success");
        } else {
            console.error("Failed to add entry: No data returned");
            showNotification("Failed to add time entry", "error");
        }
    } catch (error) {
        console.error("Error adding time entry:", error);
        showNotification("Error adding time entry: " + (error.message || "Unknown error"), "error");
    }
}
async function updateTimeEntry() {
    console.log("Updating time entry...");
    
    // Get values from form
    const dateInput = document.getElementById('date');
    const descriptionInput = document.getElementById('description');
    const clientInput = document.getElementById('client');
    const projectInput = document.getElementById('project');
    const hoursInput = document.getElementById('hours');
    const rateInput = document.getElementById('rate');
    const editId = document.getElementById('edit-id').value;
    
    // Validate required fields
    if (!dateInput?.value || !descriptionInput?.value || !hoursInput?.value || !rateInput?.value || !editId) {
        showNotification("Please fill in all required fields", "error");
        console.error("Form validation failed: Missing required fields");
        return;
    }
    
    // Get values
    const date = dateInput.value;
    const description = descriptionInput.value;
    const client = clientInput?.value || '';
    const project = projectInput?.value || '';
    const hours = parseFloat(hoursInput.value);
    const rate = parseFloat(rateInput.value);
    const amount = hours * rate;
    
    console.log("Updating entry:", editId, { date, description, client, project, hours, rate, amount });
    
    try {
        // Create update object
        const entryData = {
            id: editId,
            date,
            description,
            client,
            project,
            hours,
            rate,
            amount,
            userId: appState.user.id, // Include user ID for validation
            updatedAt: new Date().toISOString() // Using camelCase as expected by supabase.js
        };
        
        // Update in Supabase
        const updatedEntry = await SupabaseAPI.updateTimeEntry(entryData);
        
        if (updatedEntry) {
            console.log("Entry updated successfully:", updatedEntry);
            
            // Update in local state
            const entryIndex = appState.entries.findIndex(entry => entry.id === updatedEntry.id);
            if (entryIndex !== -1) {
                appState.entries[entryIndex] = updatedEntry;
            }
            
            // Update UI
            updateTimeEntriesTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            // Clear form and exit edit mode
            cancelEdit();
            
            showNotification("Time entry updated successfully", "success");
        } else {
            console.error("Failed to update entry: No data returned");
            showNotification("Failed to update time entry", "error");
        }
    } catch (error) {
        console.error("Error updating time entry:", error);
        showNotification("Error updating time entry: " + (error.message || "Unknown error"), "error");
    }
}
function editTimeEntry(id) {
    console.log("Editing time entry:", id);
    
    // Find entry in appState
    const entry = appState.entries.find(entry => entry.id === id);
    
    if (!entry) {
        console.error("Entry not found:", id);
        showNotification("Entry not found", "error");
        return;
    }
    
    console.log("Found entry to edit:", entry);
    
    // Populate form fields
    document.getElementById('date').value = entry.date;
    document.getElementById('description').value = entry.description;
    document.getElementById('client').value = entry.client || '';
    document.getElementById('project').value = entry.project || '';
    document.getElementById('hours').value = entry.hours;
    document.getElementById('rate').value = entry.rate;
    document.getElementById('edit-id').value = entry.id;
    
    // Switch to edit mode
    setEditModeUI(true);
    
    // Scroll to form
    document.querySelector('.time-entry').scrollIntoView({ behavior: 'smooth' });
}
async function deleteTimeEntry(id) {
    console.log("Deleting time entry:", id);
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this entry?')) {
        return;
    }
    
    try {
        // Delete from Supabase
        const success = await SupabaseAPI.deleteTimeEntry(id);
        
        if (success) {
            console.log("Entry deleted successfully");
            
            // Remove from local state
            appState.entries = appState.entries.filter(entry => entry.id !== id);
            
            // Update UI
            updateTimeEntriesTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            showNotification("Time entry deleted successfully", "success");
        } else {
            console.error("Failed to delete entry");
            showNotification("Failed to delete time entry", "error");
        }
    } catch (error) {
        console.error("Error deleting time entry:", error);
        showNotification("Error deleting time entry: " + (error.message || "Unknown error"), "error");
    }
}
function cancelEdit() {
    console.log("Canceling edit mode");
    
    // Clear form
    resetTimeEntryForm();
    
    // Switch to add mode
    setEditModeUI(false);
}

function resetTimeEntryForm() {
    console.log("Resetting form");
    
    // Reset date to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Clear other fields
    document.getElementById('description').value = '';
    document.getElementById('client').value = '';
    document.getElementById('project').value = '';
    document.getElementById('hours').value = '';
    document.getElementById('edit-id').value = '';
    
    // Keep the rate field as is (for convenience)
}

function setEditModeUI(isEditing) {
    console.log("Setting edit mode UI:", isEditing);
    
    const addButton = document.getElementById('add-entry');
    const updateButton = document.getElementById('update-entry');
    const cancelButton = document.getElementById('cancel-edit');
    const formTitle = document.getElementById('form-title');
    
    if (isEditing) {
        // Show update and cancel buttons, hide add button
        if (addButton) addButton.style.display = 'none';
        if (updateButton) updateButton.style.display = 'inline-block';
        if (cancelButton) cancelButton.style.display = 'inline-block';
        
        // Change form title
        if (formTitle) formTitle.textContent = 'Edit Time Entry';
    } else {
        // Show add button, hide update and cancel buttons
        if (addButton) addButton.style.display = 'inline-block';
        if (updateButton) updateButton.style.display = 'none';
        if (cancelButton) cancelButton.style.display = 'none';
        
        // Reset form title
        if (formTitle) formTitle.textContent = 'Record Time Manually';
    }
}

// --- Timer Functions ---
function initTimer() {
    // Initialize timer display
    updateTimerDisplay();
}

function updateTimerDisplay() {
    // Update timer display with current elapsed time
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return;
    
    let elapsedSeconds = 0;
    
    if (appState.currentTimer.startTime) {
        const currentTime = new Date();
        elapsedSeconds = Math.floor((currentTime - appState.currentTimer.startTime) / 1000);
        
        if (appState.currentTimer.isPaused) {
            elapsedSeconds = Math.floor(appState.currentTimer.pausedTime / 1000);
        }
    }
    
    // Format the time as HH:MM:SS
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    
    const formattedTime = 
        String(hours).padStart(2, '0') + ':' + 
        String(minutes).padStart(2, '0') + ':' + 
        String(seconds).padStart(2, '0');
    
    timerDisplay.textContent = formattedTime;
}

function startTimer() {
    console.log("Starting timer...");
    
    // Set timer start time
    appState.currentTimer.startTime = new Date();
    appState.currentTimer.pausedTime = 0;
    appState.currentTimer.isPaused = false;
    
    // Start interval to update timer display
    appState.currentTimer.intervalId = setInterval(updateTimerDisplay, 1000);
    
    // Update UI buttons
    document.getElementById('start-timer').style.display = 'none';
    document.getElementById('pause-timer').style.display = 'inline-block';
    document.getElementById('stop-timer').style.display = 'inline-block';
    document.getElementById('cancel-timer').style.display = 'inline-block';
    
    showNotification("Timer started", "info");
}

function pauseTimer() {
    console.log("Pausing timer...");
    
    // Calculate elapsed time so far
    const currentTime = new Date();
    appState.currentTimer.pausedTime = currentTime - appState.currentTimer.startTime;
    appState.currentTimer.isPaused = true;
    
    // Stop interval
    clearInterval(appState.currentTimer.intervalId);
    
    // Update UI buttons
    document.getElementById('pause-timer').style.display = 'none';
    document.getElementById('resume-timer').style.display = 'inline-block';
    
    showNotification("Timer paused", "info");
}

function resumeTimer() {
    console.log("Resuming timer...");
    
    // Adjust start time to account for paused duration
    const currentTime = new Date();
    appState.currentTimer.startTime = new Date(currentTime - appState.currentTimer.pausedTime);
    appState.currentTimer.isPaused = false;
    
    // Restart interval
    appState.currentTimer.intervalId = setInterval(updateTimerDisplay, 1000);
    
    // Update UI buttons
    document.getElementById('resume-timer').style.display = 'none';
    document.getElementById('pause-timer').style.display = 'inline-block';
    
    showNotification("Timer resumed", "info");
}

async function stopAndSaveTimer() {
    console.log("Stopping and saving timer...");
    
    // Calculate elapsed time
    let elapsedTime;
    if (appState.currentTimer.isPaused) {
        elapsedTime = appState.currentTimer.pausedTime;
    } else {
        const currentTime = new Date();
        elapsedTime = currentTime - appState.currentTimer.startTime;
    }
    
    // Convert to hours with 2 decimal places
    const hours = Math.round(elapsedTime / 36000) / 100; // Convert ms to hours with 2 decimal places
    
    // Reset timer
    clearInterval(appState.currentTimer.intervalId);
    
    // Get values from timer form
    const description = document.getElementById('timer-description').value;
    const project = document.getElementById('timer-project').value;
    const client = document.getElementById('timer-client').value;
    
    // Get rate value from the select element
    const rateSelect = document.getElementById('timer-rate');
    const rateValue = parseFloat(rateSelect.value) || appState.settings.defaultRate;
    
    // Create time entry
    if (description && hours > 0) {
        // Set values in the regular time entry form
        setInputValue('date', new Date().toISOString().split('T')[0]);
        setInputValue('description', description);
        setInputValue('project', project);
        setInputValue('client', client);
        setInputValue('hours', hours.toFixed(2));
        setInputValue('rate', rateValue);
        
        // Add the entry
        await addTimeEntry();
        
        // Reset the timer form
        document.getElementById('timer-description').value = '';
    } else {
        showNotification("Please provide a description before saving the time entry", "error");
        return;
    }
    
    // Reset timer state
    appState.currentTimer.startTime = null;
    appState.currentTimer.pausedTime = 0;
    appState.currentTimer.isPaused = false;
    
    // Update UI
    document.getElementById('timer-display').textContent = '00:00:00';
    document.getElementById('start-timer').style.display = 'inline-block';
    document.getElementById('pause-timer').style.display = 'none';
    document.getElementById('resume-timer').style.display = 'none';
    document.getElementById('stop-timer').style.display = 'none';
    document.getElementById('cancel-timer').style.display = 'none';
    
    showNotification("Time entry saved", "success");
}

function cancelTimer() {
    console.log("Cancelling timer...");
    
    // Stop interval
    clearInterval(appState.currentTimer.intervalId);
    
    // Reset timer state
    appState.currentTimer.startTime = null;
    appState.currentTimer.pausedTime = 0;
    appState.currentTimer.isPaused = false;
    
    // Update UI
    document.getElementById('timer-display').textContent = '00:00:00';
    document.getElementById('start-timer').style.display = 'inline-block';
    document.getElementById('pause-timer').style.display = 'none';
    document.getElementById('resume-timer').style.display = 'none';
    document.getElementById('stop-timer').style.display = 'none';
    document.getElementById('cancel-timer').style.display = 'none';
    
    showNotification("Timer cancelled", "info");
}

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
async function showDatabaseSetupModal() {
    const setupResults = document.getElementById('setup-results');
    setupResults.style.display = 'block';
    setupResults.innerHTML = 'Running database setup checks...\n\n';
    
    try {
        const result = await runSetupChecks();
        setupResults.innerHTML += JSON.stringify(result, null, 2);
    } catch (error) {
        console.error('Error running setup checks:', error);
        setupResults.innerHTML += 'Error: ' + error.message;
    }
}

// --- Tab Navigation ---
function openTab(evt, tabName) {
    console.log(`Opening tab: ${tabName}`);
    
    // Hide all tab contents
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }
    
    // Remove active class from all tab buttons
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    // Handle special case for dashboard tab
    if (tabName === 'dashboard-tab') {
        // Make sure the dashboard tab has content
        const dashboardTab = document.getElementById(tabName);
        if (dashboardTab && dashboardTab.innerHTML.trim() === '') {
            // Try to load content from time-tracker.html
            loadDashboardContent().then(() => {
                // Initialize dashboard after content is loaded
                initDashboardIfNeeded();
            });
        }
    }
    
    // Show the current tab and add active class to button
    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = 'block';
    }
    
    // Add active class to clicked button
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    } else {
        // If called programmatically, find the button by data-tab attribute
        const button = document.querySelector(`[data-tab="${tabName}"]`);
        if (button) {
            button.classList.add('active');
        }
    }
}

// Helper function to load dashboard content
async function loadDashboardContent() {
    console.log("Loading dashboard content...");
    const dashboardTab = document.getElementById('dashboard-tab');
    
    if (!dashboardTab || dashboardTab.innerHTML.trim() !== '') {
        return; // Already has content or doesn't exist
    }
    
    try {
        const response = await fetch('time-tracker.html');
        const html = await response.text();
        
        // Extract dashboard content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const dashboardContent = doc.getElementById('dashboard-tab');
        
        if (dashboardContent) {
            dashboardTab.innerHTML = dashboardContent.innerHTML;
            console.log("Dashboard content loaded successfully");
            return true;
        }
    } catch (error) {
        console.error("Error loading dashboard content:", error);
    }
    
    return false;
}

// Note: All Utility/Helper functions are defined at the top now

// --- Final Log ---
console.log("app.js V13 (addListener deduped) loaded."); // Updated version log
