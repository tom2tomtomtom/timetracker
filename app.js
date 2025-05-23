// App.js - Main application logic (Refactored - V13 Duplicate Removed)

// Imports
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

// --- Application State ---
const appState = {
    entries: [], expenses: [], recurringEntries: [], invoices: [], rates: [],
    settings: { 
        defaultRate: 350, 
        defaultPaymentTerms: 'Net 30', 
        name: '', 
        email: '', 
        address: '', 
        paymentInstructions: '', 
        bankingDetails: '', 
        theme: 'auto', 
        dateFormat: 'MM/DD/YYYY', 
        currency: 'USD' 
    },
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

// Display a toast-style confirmation with Delete/Cancel buttons
function showConfirmToast(message) {
    return new Promise(resolve => {
        const notification = document.createElement('div');
        notification.className = 'notification warning';

        const text = document.createElement('span');
        text.textContent = message;

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'confirm-btn';
        confirmBtn.textContent = 'Delete';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = 'Cancel';

        notification.appendChild(text);
        notification.appendChild(confirmBtn);
        notification.appendChild(cancelBtn);

        let handled = false;
        const cleanup = (result) => {
            if (handled) return;
            handled = true;
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
            resolve(result);
        };

        confirmBtn.addEventListener('click', () => cleanup(true));
        cancelBtn.addEventListener('click', () => cleanup(false));

        setTimeout(() => cleanup(false), 5000);

        document.body.appendChild(notification);
    });
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
function calculateDueDate(invoiceDateStr, paymentTerms) {
    if (!invoiceDateStr) return '';
    
    try {
        const invoiceDate = new Date(invoiceDateStr);
        if (isNaN(invoiceDate)) return '';
        
        // Extract days from payment terms (e.g., "Net 30" -> 30)
        let days = 30; // Default is 30 days
        
        if (paymentTerms) {
            const match = paymentTerms.match(/\d+/);
            if (match) {
                days = parseInt(match[0], 10);
            }
        }
        
        // Calculate due date
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + days);
        
        return dueDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    } catch (e) {
        console.error("Error calculating due date:", e);
        return '';
    }
}

function getDateRangeFromOption(option, fromDateStr, toDateStr) {
    console.log("Getting date range for:", { option, fromDateStr, toDateStr });
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    
    let startDate = null;
    let endDate = null;
    
    switch (option) {
        case 'today':
            startDate = today;
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 1);
            break;
            
        case 'yesterday':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 1);
            endDate = today;
            break;
            
        case 'this-week':
            // Get the Monday of the current week
            startDate = new Date(today);
            const diffToMonday = (startDate.getDay() + 6) % 7;
            startDate.setDate(startDate.getDate() - diffToMonday);
            // End at the following Monday
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            break;
            
        case 'last-week':
            // Get the Monday of the previous week
            startDate = new Date(today);
            const diffLastWeek = (startDate.getDay() + 6) % 7 + 7;
            startDate.setDate(startDate.getDate() - diffLastWeek);
            // End at the following Monday
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            break;
            
        case 'this-month':
            // Get the first day of the current month
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            // Get the first day of the next month
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            break;
            
        case 'last-month':
            // Get the first day of the last month
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            // Get the first day of the current month
            endDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
            
        case 'this-year':
            // Get the first day of the current year
            startDate = new Date(today.getFullYear(), 0, 1);
            // Get the first day of the next year
            endDate = new Date(today.getFullYear() + 1, 0, 1);
            break;
            
        case 'last-year':
            // Get the first day of the last year
            startDate = new Date(today.getFullYear() - 1, 0, 1);
            // Get the first day of the current year
            endDate = new Date(today.getFullYear(), 0, 1);
            break;
            
        case 'custom':
            if (fromDateStr) {
                startDate = new Date(fromDateStr);
                if (isNaN(startDate.getTime())) startDate = null;
            }
            
            if (toDateStr) {
                endDate = new Date(toDateStr);
                if (isNaN(endDate.getTime())) endDate = null;
                else {
                    // For inclusive end date, set to start of next day
                    endDate = new Date(endDate);
                    endDate.setDate(endDate.getDate() + 1);
                }
            }
            break;
            
        case 'all':
        default:
            // All dates, no filtering needed
            break;
    }
    
    console.log("Date range:", {
        option,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
    });
    
    return { startDate, endDate };
}

function triggerDownload(content, filename, contentType) {
    console.log("Triggering download:", filename, contentType);
    
    // Create a Blob with the content
    const blob = new Blob([content], { type: contentType });
    
    // Create a download link
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    
    // Append to document, click, and remove
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Download cleanup complete");
    }, 100);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}
function showLoadingIndicator(show) { console.log(`Loading: ${show}`); /* TODO: Visual indicator */ }
function getFormDataFromLocalStorage() { /* ... same ... */ }
// *** addListener DEFINED ONCE HERE ***
function addListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
    else console.warn(`Listener Warning: Element ID "${id}" not found.`);
}
// Generic delegated event listener helper
function addDelegatedListener(parentElementId, event, selector, handler) {
    const parent = document.getElementById(parentElementId);
    if (!parent) {
        console.warn(`Delegated listener parent '${parentElementId}' not found.`);
        return;
    }
    parent.addEventListener(event, (e) => {
        const target = e.target.closest(selector);
        if (target && parent.contains(target)) {
            handler.call(target, e);
        }
    });
}


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
            SupabaseAPI.getTimeEntries(appState.user.id),
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
async function showApp() {
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
    
    // Initialize the tabs with content if needed
    const tabsNeedingContent = ['dashboard-tab', 'invoice-tab', 'reports-tab', 'settings-tab'];
    
    // Check which tab is currently visible
    let activeTabId = 'time-tracking-tab'; // Default
    
    const activeTabButton = document.querySelector('.tab-button.active');
    if (activeTabButton) {
        activeTabId = activeTabButton.getAttribute('data-tab');
    }
    
    // Make sure we have the active tab showing
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.style.display = 'block';
    }
    
    // Set active class on active tab button
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    const activeButtonSelector = `.tab-button[data-tab="${activeTabId}"]`;
    const activeButton = document.querySelector(activeButtonSelector);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Load content for all tabs
    console.log("Loading content for all tabs...");
    
    // Create an array of promises for loading each tab
    const loadPromises = [];
    
    for (const tabId of tabsNeedingContent) {
        const tabElement = document.getElementById(tabId);
        if (tabElement && tabElement.innerHTML.trim() === '') {
            // Queue up the tab content loading
            const loadPromise = loadTabContent(tabId);
            loadPromises.push(loadPromise);
            
            if (tabId === activeTabId) {
                // For the active tab, we need to wait for it to load before initializing
                await loadPromise;
                
                // If the dashboard tab is active, initialize it
                if (tabId === 'dashboard-tab') {
                    console.log("Initializing dashboard as active tab");
                    await initDashboardIfNeeded();
                }
            }
        } else if (tabId === activeTabId && tabId === 'dashboard-tab') {
            // If the dashboard tab is active and already has content, initialize it
            console.log("Dashboard tab is active and has content, initializing...");
            await initDashboardIfNeeded();
        }
    }
    
    // Load the remaining tabs in the background
    Promise.all(loadPromises).then(() => {
        console.log("All tabs loaded successfully");
    }).catch(error => {
        console.error("Error loading some tabs:", error);
    });
}
function showLoginForm() {
    console.log("Showing login form...");
    
    // Show login container
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    
    if (loginContainer) {
        loginContainer.style.display = 'flex';
    }
    
    if (appContainer) {
        appContainer.style.display = 'none';
    }
    
    // Set up login and signup forms if not already done
    setupAuthFormsListeners();
}
// Apply the selected theme to the page
function applyTheme(themePreference) {
    try {
        // Determine if dark mode should be enabled
        const systemPrefersDark = window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;

        const isDark = themePreference === 'dark' ||
            (themePreference === 'auto' && systemPrefersDark);

        // Toggle class on the body element
        document.body.classList.toggle('dark-mode', isDark);

        // Update the icon on the toggle button if present
        const toggleBtn = document.getElementById('dark-mode-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
        }
    } catch (err) {
        console.error('Error applying theme:', err);
    }
}
function populateSettingsForm() {
    console.log("Populating settings form...");
    
    // Get form elements
    const nameInput = document.getElementById('your-name');
    const emailInput = document.getElementById('your-email');
    const addressInput = document.getElementById('your-address');
    const paymentInstructionsInput = document.getElementById('payment-instructions');
    const bankingDetailsInput = document.getElementById('banking-details');
    const defaultRateSelect = document.getElementById('default-rate');
    const paymentTermsInput = document.getElementById('default-payment-terms');
    const themeSelect = document.getElementById('theme-selection');
    const dateFormatSelect = document.getElementById('date-format');
    const currencySelect = document.getElementById('currency-format');
    
    // Check if elements exist
    if (!nameInput || !emailInput) {
        console.warn("Settings form elements not found. The form may not be loaded yet.");
        return;
    }
    
    // Populate settings
    if (nameInput) nameInput.value = appState.settings.name || '';
    if (emailInput) emailInput.value = appState.settings.email || '';
    if (addressInput) addressInput.value = appState.settings.address || '';
    if (paymentInstructionsInput) paymentInstructionsInput.value = appState.settings.paymentInstructions || '';
    if (bankingDetailsInput) bankingDetailsInput.value = appState.settings.bankingDetails || '';
    if (defaultRateSelect) defaultRateSelect.value = appState.settings.defaultRate || 350;
    if (paymentTermsInput) paymentTermsInput.value = appState.settings.defaultPaymentTerms || 'Net 30';
    
    // Display settings
    if (themeSelect) themeSelect.value = appState.settings.theme || 'light';
    if (dateFormatSelect) dateFormatSelect.value = appState.settings.dateFormat || 'MM/DD/YYYY';
    if (currencySelect) currencySelect.value = appState.settings.currency || 'USD';
    
    console.log("Settings form populated");
}
function populateRateTemplates() {
    console.log("Populating rate templates...");
    
    const ratesContainer = document.getElementById('rates-container');
    const rateSelect = document.getElementById('timer-rate');
    
    if (!ratesContainer || !rateSelect) {
        console.warn("Rate template elements not found. The form may not be loaded yet.");
        return;
    }
    
    // Clear existing rate templates and dropdown options
    ratesContainer.innerHTML = '';
    rateSelect.innerHTML = '';
    
    if (appState.rates.length === 0) {
        ratesContainer.innerHTML = '<p style="font-style: italic;">No rate templates saved yet.</p>';
        
        // Add default rate option
        const defaultOption = document.createElement('option');
        defaultOption.value = appState.settings.defaultRate || 350;
        defaultOption.textContent = `Standard Rate ($${appState.settings.defaultRate || 350})`;
        rateSelect.appendChild(defaultOption);
        
        console.log("No rates found");
        return;
    }
    
    // Add rate templates to container
    appState.rates.forEach(rate => {
        const rateItem = document.createElement('div');
        rateItem.className = 'rate-item';
        rateItem.innerHTML = `
            <div class="rate-details">
                <span class="rate-name">${escapeHtml(rate.name)}</span>
                <span class="rate-amount">${formatCurrency(rate.amount)}</span>
            </div>
            <div class="rate-actions">
                <button class="edit-rate-btn blue-btn" data-id="${rate.id}" style="margin-right: 5px; padding: 5px 10px;">Edit</button>
                <button class="delete-rate-btn" data-id="${rate.id}" style="padding: 5px 10px;">Delete</button>
            </div>
        `;
        ratesContainer.appendChild(rateItem);
        
        // Add to rate dropdown
        const option = document.createElement('option');
        option.value = rate.amount;
        option.textContent = `${rate.name} (${formatCurrency(rate.amount)})`;
        rateSelect.appendChild(option);
    });
    
    // Add rate action listeners
    addRateActionListeners();
    
    console.log(`Populated ${appState.rates.length} rate templates`);
}
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
function populateDropdown(elementId, optionsArray, defaultOptionText = 'All') { 
    const dropdown = document.getElementById(elementId);
    if (!dropdown) return;
    
    // Store current value to try to preserve selection if possible
    const currentValue = dropdown.value;
    
    // Keep only the first option (typically "All")
    dropdown.options.length = 1;
    
    // Add options
    optionsArray.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        dropdown.appendChild(optionElement);
    });
    
    // Try to restore previous value if it exists in new options
    if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
        dropdown.value = currentValue;
    }
}

function populateDatalist(elementId, optionsArray) { 
    const datalist = document.getElementById(elementId);
    if (!datalist) return;
    
    // Clear existing options
    datalist.innerHTML = '';
    
    // Add options
    optionsArray.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        datalist.appendChild(optionElement);
    });
}

// Helper function to update projects dropdown based on selected client
function updateProjectsDropdownForClient(projectDropdown, selectedClient) {
    if (!projectDropdown || !selectedClient) return;
    
    console.log(`Updating projects dropdown for client: ${selectedClient}`);
    
    // Get projects for this client
    const clientProjects = appState.entries
        .filter(entry => entry.client === selectedClient)
        .map(entry => entry.project)
        .filter(Boolean);
    
    // Get unique projects
    const uniqueProjects = [...new Set(clientProjects)];
    
    // Keep the first option
    const firstOption = projectDropdown.options[0];
    projectDropdown.innerHTML = '';
    projectDropdown.appendChild(firstOption);
    
    // Add client projects
    uniqueProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectDropdown.appendChild(option);
    });
    
    console.log(`Added ${uniqueProjects.length} projects for client ${selectedClient}`);
}
function updateRecurringEntriesUI() { /* ... same ... */ }
function updateInvoiceHistoryTable() { /* ... same ... */ }

// Export and import functions
function exportData() {
    console.log("Exporting data...");
    try {
        // Gather data to export
        const exportData = {
            entries: appState.entries,
            expenses: appState.expenses,
            recurringEntries: appState.recurringEntries,
            rates: appState.rates,
            settings: appState.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        // Convert to JSON
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `timetracker_export_${dateStr}.json`;
        
        // Trigger download
        triggerDownload(jsonData, filename, 'application/json');
        
        showNotification("Data exported successfully", "success");
    } catch (error) {
        console.error("Error exporting data:", error);
        showNotification("Failed to export data. See console for details.", "error");
    }
}

async function importData(file) {
    console.log("Importing data...");
    try {
        // Read file content
        const content = await readFileAsText(file);
        
        // Parse JSON
        const importData = JSON.parse(content);
        
        // Validate data structure
        if (!importData.entries || !importData.expenses) {
            throw new Error("Invalid data format");
        }
        
        // Confirm import
        if (!confirm("Are you sure you want to import this data? It will replace your current data.")) {
            return;
        }
        
        // Replace app state data
        appState.entries = importData.entries;
        appState.expenses = importData.expenses;
        if (importData.recurringEntries) appState.recurringEntries = importData.recurringEntries;
        if (importData.rates) appState.rates = importData.rates;
        if (importData.settings) appState.settings = importData.settings;
        
        // Update UI
        updateTimeEntriesTable();
        updateExpensesTable();
        updateSummary();
        updateClientProjectDropdowns();
        updateRecurringEntriesUI();
        populateRateTemplates();
        populateSettingsForm();
        
        // Save to database
        await Promise.all([
            SupabaseAPI.replaceTimeEntries(appState.entries),
            SupabaseAPI.replaceExpenses(appState.expenses),
            SupabaseAPI.replaceRecurringEntries(appState.recurringEntries),
            SupabaseAPI.replaceRates(appState.rates),
            SupabaseAPI.updateSettings(appState.settings)
        ]);
        
        showNotification("Data imported successfully", "success");
    } catch (error) {
        console.error("Error importing data:", error);
        showNotification("Failed to import data. See console for details.", "error");
    }
}

function exportCSV() {
    console.log("Exporting CSV...");
    try {
        // Prepare entries data
        const headers = ['Date', 'Description', 'Client', 'Project', 'Hours', 'Rate', 'Amount', 'USD RATE', 'AMOUNT (USD)'];
        
        // Apply current filters to get filtered entries
        const { startDate, endDate } = getDateRangeFromOption(
            document.getElementById('date-range').value,
            document.getElementById('date-from').value,
            document.getElementById('date-to').value
        );
        
        const clientFilter = document.getElementById('filter-client').value;
        const projectFilter = document.getElementById('filter-project').value;
        
        // Filter entries based on criteria
        const filteredEntries = appState.entries.filter(entry => {
            // Apply date filter if specified
            if (startDate && endDate) {
                const entryDate = new Date(entry.date);
                if (entryDate < startDate || entryDate >= endDate) {
                    return false;
                }
            }
            
            // Apply client filter if specified
            if (clientFilter !== 'all' && entry.client !== clientFilter) {
                return false;
            }
            
            // Apply project filter if specified
            if (projectFilter !== 'all' && entry.project !== projectFilter) {
                return false;
            }
            
            return true;
        });
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        // Add entry rows
        filteredEntries.forEach(entry => {
            const row = [
                entry.date,
                "\"" + (entry.description || '').replace(/"/g, '""') + "\"", // Escape quotes
                "\"" + (entry.client || '').replace(/"/g, '""') + "\"",
                "\"" + (entry.project || '').replace(/"/g, '""') + "\"",
                entry.hours,
                entry.rate,
                entry.amount,
                (Number.isFinite(Number(entry.exchangeRateUsd)) ? Number(entry.exchangeRateUsd).toFixed(6) : ''),
                (Number.isFinite(Number(entry.amountUsd)) ? ('$' + Number(entry.amountUsd).toFixed(2)) : '')
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `timetracker_export_${dateStr}.csv`;
        
        // Trigger download
        triggerDownload(csvContent, filename, 'text/csv');
        
        showNotification("CSV exported successfully", "success");
    } catch (error) {
        console.error("Error exporting CSV:", error);
        showNotification("Failed to export CSV. See console for details.", "error");
    }
}

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
function setupAuthListeners() {
    console.log("Setting up authentication listeners...");
    
    // Handle signup form toggle
    addListener('show-signup-link', 'click', () => {
        document.getElementById('login-form-container').style.display = 'none';
        document.getElementById('signup-form-container').style.display = 'block';
    });
    
    // Handle login form toggle
    addListener('show-login-link', 'click', () => {
        document.getElementById('signup-form-container').style.display = 'none';
        document.getElementById('login-form-container').style.display = 'block';
    });
    
    // Handle login form submission
    addListener('login-form', 'submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            showNotification("Please enter email and password", "error");
            console.error("Form validation failed: Missing required fields");
            return;
        }
        
        try {
            showLoadingIndicator(true);
            
            const result = await SupabaseAPI.signIn(email, password);
            
            if (result.success) {
                // Set user state
                appState.user = result.user;
                
                // Load user data
                await loadUserData();
                
                // Show application
                showApp();
                
                showNotification("Login successful!", "success");
            } else {
                showNotification("Login failed: " + (result.error?.message || "Unknown error"), "error");
            }
        } catch (error) {
            console.error("Login error:", error);
            showNotification("Login failed: " + error.message, "error");
        } finally {
            showLoadingIndicator(false);
        }
    });
    
    // Handle signup form submission
    addListener('signup-form', 'submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        if (!email || !password || !confirmPassword) {
            showNotification("Please fill all fields", "error");
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification("Passwords do not match", "error");
            return;
        }
        
        try {
            showLoadingIndicator(true);
            
            const result = await SupabaseAPI.signUp(email, password);
            
            if (result.success) {
                showNotification("Signup successful! Please check your email for verification.", "success");
                
                // Switch to login form
                document.getElementById('signup-form-container').style.display = 'none';
                document.getElementById('login-form-container').style.display = 'block';
            } else {
                showNotification("Signup failed: " + (result.error?.message || "Unknown error"), "error");
            }
        } catch (error) {
            console.error("Signup error:", error);
            showNotification("Signup failed: " + error.message, "error");
        } finally {
            showLoadingIndicator(false);
        }
    });
    
    // Logout button
    addListener('logout-button', 'click', async () => {
        try {
            await SupabaseAPI.signOut();
            
            // Reset app state
            appState.user = null;
            appState.entries = [];
            appState.expenses = [];
            appState.recurringEntries = [];
            appState.invoices = [];
            
            // Show login form
            showLoginForm();
            
            showNotification("Logged out successfully", "success");
        } catch (error) {
            console.error("Logout error:", error);
            showNotification("Logout failed: " + error.message, "error");
        }
    });
}
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
    if (!dashboardTab) {
        console.error("Dashboard tab element not found");
        return;
    }
    
    // Check if tab is visible and not already initialized
    const isVisible = dashboardTab.style.display !== 'none';
    const isInitialized = dashboardTab.dataset.initialized === 'true';
    
    console.log(`Dashboard visibility: ${isVisible}, Already initialized: ${isInitialized}`);
    
    if (isVisible && !isInitialized) {
        try {
            // Show loading indicator
            if (dashboardTab.querySelector('.dashboard-loading') === null) {
                const loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'dashboard-loading';
                loadingIndicator.style.textAlign = 'center';
                loadingIndicator.style.padding = '20px';
                loadingIndicator.innerHTML = '<p>Loading dashboard data...</p>';
                
                // Insert after any h2 elements, or at the beginning if no h2
                const h2 = dashboardTab.querySelector('h2');
                if (h2 && h2.nextSibling) {
                    dashboardTab.insertBefore(loadingIndicator, h2.nextSibling);
                } else {
                    dashboardTab.prepend(loadingIndicator);
                }
            }
            
            // Get dependencies
            const dashboardDeps = await getDashboardDependencies();
            if (!dashboardDeps) {
                throw new Error("Failed to load dashboard dependencies");
            }
            
            if (typeof dashboardDeps.initDashboard !== 'function') {
                throw new Error("Dashboard initialization function not found");
            }
            
            // Initialize the dashboard
            await dashboardDeps.initDashboard(appState, dashboardDeps);
            
            // Mark as initialized
            dashboardTab.dataset.initialized = 'true';
            
            // Remove loading indicator
            const loadingIndicator = dashboardTab.querySelector('.dashboard-loading');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
            
            console.log("Dashboard successfully initialized");
        } catch (error) {
            console.error("Error initializing dashboard:", error);
            
            // Show error message in the dashboard tab
            const errorMessage = document.createElement('div');
            errorMessage.className = 'dashboard-error';
            errorMessage.style.padding = '20px';
            errorMessage.style.color = 'var(--error-color)';
            errorMessage.innerHTML = '<p>Failed to initialize dashboard. Please try refreshing the page.</p>';
            
            // Replace loading indicator if exists, otherwise add to the tab
            const loadingIndicator = dashboardTab.querySelector('.dashboard-loading');
            if (loadingIndicator) {
                dashboardTab.replaceChild(errorMessage, loadingIndicator);
            } else {
                const h2 = dashboardTab.querySelector('h2');
                if (h2 && h2.nextSibling) {
                    dashboardTab.insertBefore(errorMessage, h2.nextSibling);
                } else {
                    dashboardTab.prepend(errorMessage);
                }
            }
            
            // Show notification
            showNotification("Error loading dashboard. See console for details.", "error");
        }
    } else if (isVisible && isInitialized) {
        console.log("Dashboard already initialized, running update...");
        try {
            // Get dependencies
            const dashboardDeps = await getDashboardDependencies();
            if (dashboardDeps && dashboardDeps.updateDashboard) {
                dashboardDeps.updateDashboard(appState, dashboardDeps);
            }
        } catch (error) {
            console.error("Error updating dashboard:", error);
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

    // Time log actions using delegated listeners
    addDelegatedListener('entries-body', 'click', '.delete-btn', (e) => {
        const btn = e.target.closest('.delete-btn');
        if (btn) {
            deleteTimeEntry(btn.getAttribute('data-id'));
        }
    });
    addDelegatedListener('entries-body', 'click', '.edit-btn', (e) => {
        const btn = e.target.closest('.edit-btn');
        if (btn) {
            editTimeEntry(btn.getAttribute('data-id'));
        }
    });
    
    // Timer buttons
    addListener('start-timer', 'click', startTimer);
    addListener('pause-timer', 'click', pauseTimer);
    addListener('resume-timer', 'click', resumeTimer);
    addListener('stop-timer', 'click', stopAndSaveTimer);
    addListener('cancel-timer', 'click', cancelTimer);
}
function setupExpenseListeners() { /* ... same ... */ }
function setupInvoiceListeners() {
    console.log("Setting up invoice listeners...");
    
    // Invoice generation
    addListener('generate-invoice', 'click', handleGenerateInvoiceClick);
    addListener('view-invoice-entries', 'click', viewInvoiceEntries);
    
    // Invoice date range
    addListener('invoice-date-range', 'change', () => {
        const dateRangeSelect = document.getElementById('invoice-date-range');
        const customDateContainer = document.getElementById('invoice-custom-date-range');
        
        if (dateRangeSelect && customDateContainer) {
            customDateContainer.style.display = 
                dateRangeSelect.value === 'custom' ? 'flex' : 'none';
        }
    });
    
    // Invoice client/project relationship
    addListener('invoice-client', 'change', () => {
        const clientSelect = document.getElementById('invoice-client');
        const projectSelect = document.getElementById('invoice-project');
        
        if (clientSelect && projectSelect && clientSelect.value) {
            // Filter projects by selected client
            const selectedClient = clientSelect.value;
            updateProjectsDropdownForClient(projectSelect, selectedClient);
        }
    });
    
    // Invoice action buttons
    addListener('print-invoice', 'click', printInvoice);
    addListener('save-invoice-pdf', 'click', saveInvoicePdf);
    addListener('export-invoice-excel', 'click', exportInvoiceExcel);
    addListener('mark-as-paid', 'click', markCurrentlyGeneratedInvoicePaid);
    
    // Invoice currency select show/hide USD fields
    addListener('invoice-currency-select', 'change', () => {
        console.log("DEBUG: Currency toggle handler start");
        const dbgCurrency = document.getElementById('invoice-currency-select').value;
        console.log(`DEBUG: [CurrencyChange] currency=${dbgCurrency}`);
        console.log('DEBUG: USD headers count', document.querySelectorAll('.usd-rate-header').length,
                    document.querySelectorAll('.usd-amount-header').length);
        console.log('DEBUG: USD cells count', document.querySelectorAll('.exchange-rate-cell').length,
                    document.querySelectorAll('.usd-amount-cell').length);
        console.log('DEBUG: USD expense headers count', document.querySelectorAll('.usd-amount-expense-header').length,
                    document.querySelectorAll('.usd-amount-expense-cell').length);
        const currency = document.getElementById('invoice-currency-select').value;
        const usdRateGroup = document.getElementById('usd-exchange-rate-group');
        if (usdRateGroup) usdRateGroup.style.display = currency === 'USD' ? 'flex' : 'none';
        // First refresh invoice preview tables and totals
        populateInvoiceEntriesTable(appState.currentInvoicePreview.filteredEntries);
        populateInvoiceExpensesTable(appState.currentInvoicePreview.filteredExpenses);
        updateInvoiceTotalsFromPreview();
        // Then toggle USD-related headers and cells
        document.querySelectorAll('.usd-rate-header, .usd-amount-header').forEach(el => {
            el.style.display = currency === 'USD' ? '' : 'none';
        });
        document.querySelectorAll('.usd-amount-expense-header').forEach(el => {
            el.style.display = currency === 'USD' ? '' : 'none';
        });
        document.querySelectorAll('.exchange-rate-cell, .usd-amount-cell').forEach(el => {
            el.style.display = currency === 'USD' ? '' : 'none';
        });
        document.querySelectorAll('.usd-amount-expense-cell').forEach(el => {
            el.style.display = currency === 'USD' ? '' : 'none';
        });
        document.querySelectorAll('.usd-summary').forEach(el => {
            el.style.display = currency === 'USD' ? '' : 'none';
        });
        console.log('DEBUG: usd-exchange-rate-group display:', usdRateGroup?.style.display);
        console.log('DEBUG: .usd-rate-header[0].style.display:', document.querySelector('.usd-rate-header')?.style.display);
    });
    
    // Trigger initial currency toggle to set correct column visibility
    const initialCurrencySelect = document.getElementById('invoice-currency-select');
    if (initialCurrencySelect) {
        initialCurrencySelect.dispatchEvent(new Event('change'));
    }
    
    console.log("Invoice listeners setup complete");
}
function addInvoiceHistoryActionListeners() { /* ... same ... */ }
function setupReportListeners() {
    console.log("Setting up reports listeners...");
    
    // Report generation
    addListener('generate-report', 'click', generateReport);
    addListener('export-report', 'click', exportReport);
    addListener('export-report-csv', 'click', exportReportCSV);
    
    // Report date range
    addListener('report-date-range', 'change', () => {
        const dateRangeSelect = document.getElementById('report-date-range');
        const customDateContainer = document.getElementById('report-custom-date-range');
        
        if (dateRangeSelect && customDateContainer) {
            customDateContainer.style.display = 
                dateRangeSelect.value === 'custom' ? 'flex' : 'none';
        }
    });
    
    // Report type change
    addListener('report-type', 'change', () => {
        // Could update available filters based on report type
        const reportType = document.getElementById('report-type').value;
        console.log(`Report type changed to: ${reportType}`);
    });
    
    // Client/project relationship
    addListener('report-client', 'change', () => {
        const clientSelect = document.getElementById('report-client');
        const projectSelect = document.getElementById('report-project');
        
        if (clientSelect && projectSelect && clientSelect.value !== 'all') {
            // Filter projects by selected client
            const selectedClient = clientSelect.value;
            updateProjectsDropdownForClient(projectSelect, selectedClient);
        } else if (projectSelect) {
            // Reset project dropdown if 'all clients' is selected
            updateClientProjectDropdowns();
        }
    });
    
    console.log("Reports listeners setup complete");
}
function setupSettingsListeners() {
    console.log("Setting up settings listeners...");
    
    // Core settings form
    addListener('save-settings', 'click', saveCoreSettings);
    
    // Display settings form
    addListener('save-display-settings', 'click', saveDisplaySettings);
    
    // Rate templates
    addListener('add-rate', 'click', addRateTemplate);
    
    // Data management in settings
    addListener('export-all-data', 'click', exportData);
    addListener('import-all-data', 'click', () => document.getElementById('file-input').click());
    addListener('export-all-csv', 'click', exportCSV);
    addListener('export-all-excel', 'click', () => {
        console.log("Export to Excel not implemented");
        showNotification("Export to Excel not implemented yet", "info");
    });
    

    
    console.log("Settings listeners setup complete");
}
function addRateActionListeners() { /* ... same ... */ }
function setupDataManagementListeners() {
    console.log("Setting up data management listeners...");
    
    // Get direct references to buttons for debugging
    const exportDataBtn = document.getElementById('export-data');
    const importDataBtn = document.getElementById('import-data');
    const exportCsvBtn = document.getElementById('export-csv');
    
    console.log("Buttons found:", 
        exportDataBtn ? "Export Data " : "Export Data ",
        importDataBtn ? "Import Data " : "Import Data",
        exportCsvBtn ? "Export CSV " : "Export CSV ");
    
    // Export data file
    addListener('export-data', 'click', exportData);
    
    // Import data file
    addListener('import-data', 'click', () => {
        document.getElementById('file-input').click();
    });
    
    // Export CSV
    addListener('export-csv', 'click', exportCSV);
    
    // Handle file selection for import
    addListener('file-input', 'change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importData(file);
        }
    });
    
    console.log("Data management listeners setup complete");
}
function setupDateRangeListeners() { /* ... same ... */ }
function setupAutoSave() { /* ... same ... */ }
// Set up the dark mode toggle button
function setupDarkModeToggle() {
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleDarkMode);
    } else {
        console.warn('Dark mode toggle button not found');
    }
}
function setupDatabaseCheckListener() {
    // Disabled to prevent double login issues
    // No setup check needed now that database is working
}
function addRecurringEntryActionListeners() { /* ... same ... */ }
async function getDashboardDependencies() {
    console.log("Getting dashboard dependencies...");
    try {
        // Import dashboard module dynamically
        const dashboardModule = await import('./dashboard.js');
        
        // Get reference to Chart.js library
        let Chart = window.Chart;
        
        if (!Chart) {
            console.warn("Chart.js not found in global scope. Attempting to load it...");
            
            // Try to load Chart.js dynamically if not available
            try {
                await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
                console.log("Chart.js loaded dynamically");
                
                // Check if Chart is now available
                Chart = window.Chart;
                
                if (!Chart) {
                    console.warn("Chart.js still not available after loading. Trying alternative CDN...");
                    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js');
                    Chart = window.Chart;
                }
                
                if (!Chart) {
                    console.error("Failed to load Chart.js from multiple sources");
                    showNotification("Failed to load chart library. Some visualizations may not work.", "warning");
                } else {
                    console.log("Chart.js successfully loaded");
                }
            } catch (scriptError) {
                console.error("Failed to load Chart.js:", scriptError);
                showNotification("Failed to load chart library. Some visualizations may not work.", "warning");
            }
        }
        
        return {
            initDashboard: dashboardModule.initDashboard,
            updateDashboard: dashboardModule.updateDashboard,
            Chart: Chart, // Pass Chart.js reference (may be null if loading failed)
            formatCurrency: formatCurrency,
            formatDate: formatDate,
            getDateRangeFromOption: getDateRangeFromOption,
            showNotification: showNotification
        };
    } catch (error) {
        console.error("Error loading dashboard dependencies:", error);
        showNotification("Failed to initialize dashboard. Please try refreshing the page.", "error");
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
async function saveCoreSettings() {
    console.log("Saving core settings...");
    
    try {
        // Get values from form
        const nameInput = document.getElementById('your-name');
        const emailInput = document.getElementById('your-email');
        const addressInput = document.getElementById('your-address');
        const paymentInstructionsInput = document.getElementById('payment-instructions');
        const bankingDetailsInput = document.getElementById('banking-details');
        const defaultRateSelect = document.getElementById('default-rate');
        const paymentTermsInput = document.getElementById('default-payment-terms');
        
        if (!nameInput || !emailInput) {
            console.error("Required settings form elements not found");
            showNotification("Settings form not fully loaded. Try reopening the tab.", "error");
            return;
        }
        
        // Update appState settings
        appState.settings.name = nameInput.value;
        appState.settings.email = emailInput.value;
        appState.settings.address = addressInput?.value || '';
        appState.settings.paymentInstructions = paymentInstructionsInput?.value || '';
        appState.settings.bankingDetails = bankingDetailsInput?.value || '';
        appState.settings.defaultRate = parseFloat(defaultRateSelect?.value || appState.settings.defaultRate);
        appState.settings.defaultPaymentTerms = paymentTermsInput?.value || 'Net 30';
        
        // Save to Supabase
        const settingsData = {
            ...appState.settings,
            userId: appState.user.id
        };
        
        const savedSettings = await SupabaseAPI.saveSettings(settingsData);
        
        if (savedSettings) {
            console.log("Core settings saved successfully:", savedSettings);
            showNotification("Settings saved successfully", "success");
        } else {
            console.error("Failed to save settings: No data returned");
            showNotification("Failed to save settings", "error");
        }
    } catch (error) {
        console.error("Error saving core settings:", error);
        showNotification("Error saving settings: " + (error.message || "Unknown error"), "error");
    }
}

async function saveDisplaySettings() {
    console.log("Saving display settings...");
    
    try {
        // Get values from form
        const themeSelect = document.getElementById('theme-selection');
        const dateFormatSelect = document.getElementById('date-format');
        const currencySelect = document.getElementById('currency-format');
        
        if (!themeSelect || !dateFormatSelect || !currencySelect) {
            console.error("Required display settings form elements not found");
            showNotification("Display settings form not fully loaded. Try reopening the tab.", "error");
            return;
        }
        
        // Check if currency has changed
        const oldCurrency = appState.settings.currency;
        const newCurrency = currencySelect.value;
        const currencyChanged = oldCurrency !== newCurrency;
        
        // Update appState settings
        appState.settings.theme = themeSelect.value;
        appState.settings.dateFormat = dateFormatSelect.value;
        appState.settings.currency = newCurrency;
        
        // Apply theme
        applyTheme(appState.settings.theme);
        
        // Save to Supabase
        const settingsData = {
            ...appState.settings,
            userId: appState.user.id
        };
        
        const savedSettings = await SupabaseAPI.saveSettings(settingsData);
        
        if (savedSettings) {
            console.log("Display settings saved successfully:", savedSettings);
            
            // If currency changed, ask if user wants to update existing entries
            if (currencyChanged && appState.entries.length > 0) {
                const shouldUpdate = confirm(`Currency changed from ${oldCurrency} to ${newCurrency}. Would you like to update the currency for existing time entries? This won't change their value, only how they're displayed.`);
                
                if (shouldUpdate) {
                    await updateCurrencyForExistingEntries(oldCurrency, newCurrency);
                }
            }
            
            showNotification("Display settings saved successfully", "success");
        } else {
            console.error("Failed to save display settings: No data returned");
            showNotification("Failed to save display settings", "error");
        }
    } catch (error) {
        console.error("Error saving display settings:", error);
        showNotification("Error saving display settings: " + (error.message || "Unknown error"), "error");
    }
}

// Function to update currency for existing time entries
async function updateCurrencyForExistingEntries(oldCurrency, newCurrency) {
    console.log(`Updating currency for existing entries from ${oldCurrency} to ${newCurrency}...`);
    
    try {
        // Show loading indicator
        showNotification("Updating currency for existing entries...", "info");
        
        // Count of entries to update (entries with amounts)
        const entriesToUpdate = appState.entries.filter(entry => entry.amount !== undefined && entry.amount !== null);
        
        if (entriesToUpdate.length === 0) {
            console.log("No entries with amount values to update");
            return;
        }
        
        console.log(`Found ${entriesToUpdate.length} entries with amounts to update`);
        
        // We won't actually convert values, just set the currency code
        // You could add actual exchange rate conversion here
        
        // Get updated entries
        const updateResults = await Promise.all(
            entriesToUpdate.map(entry => {
                // Here we're just updating the currency code, not converting the value
                // In a real app, you might apply exchange rates
                return SupabaseAPI.updateTimeEntry(entry.id, { 
                    currency: newCurrency
                });
            })
        );
        
        // Check results
        const updatedCount = updateResults.filter(result => result !== null).length;
        
        // Refresh entries to get the updated data
        const updatedEntries = await SupabaseAPI.getTimeEntries();
        if (updatedEntries) {
            appState.entries = updatedEntries;
            updateTimeEntriesTable();
            updateSummary();
        }
        
        console.log(`Successfully updated ${updatedCount} entries to ${newCurrency}`);
        showNotification(`Updated ${updatedCount} entries to ${newCurrency}`, "success");
    } catch (error) {
        console.error("Error updating currency for existing entries:", error);
        showNotification("Error updating entries with new currency", "error");
    }
}
// Toggle dark mode manually using the button
function toggleDarkMode() {
    try {
        const isDark = document.body.classList.toggle('dark-mode');

        // Update local settings
        if (appState && appState.settings) {
            appState.settings.theme = isDark ? 'dark' : 'light';
        }

        // Update the toggle icon
        const toggleBtn = document.getElementById('dark-mode-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
        }
    } catch (err) {
        console.error('Error toggling dark mode:', err);
    }
}

// --- Rate Templates ---
async function addRateTemplate() { /* ... same ... */ }
function editRateTemplate(id) { /* ... same ... */ }
async function deleteRateTemplate(id) { /* ... same ... */ }

// --- Data Management ---
// Note: importData function is already declared above

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
        // Apply date filter if specified
        if (startDate && endDate) {
            const entryDate = new Date(entry.date);
            if (entryDate < startDate || entryDate >= endDate) {
                return false;
            }
        }
        
        // Apply client filter if specified
        if (clientFilter !== 'all' && entry.client !== clientFilter) {
            return false;
        }
        
        // Apply project filter if specified
        if (projectFilter !== 'all' && entry.project !== projectFilter) {
            return false;
        }
        
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
    // Ensure dynamic table header matches the row columns
    const table = document.getElementById('entries-table');
    if (table) {
      const thead = table.querySelector('thead');
      if (thead) {
        thead.innerHTML = `
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Client</th>
            <th>Project</th>
            <th>Hours</th>
            <th>Rate</th>
            <th>Amount</th>
            <th>USD RATE</th>
            <th>AMOUNT (USD)</th>
            <th>Actions</th>
          </tr>
        `;
      }
    }
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
            <td>${entry.days.toFixed(2)}</td>
            <td>${formatCurrency(entry.dayRate)}</td>
            <td>${formatCurrency(entry.amount)}</td>
            <td class="exchange-rate-cell">${
                entry.exchangeRateUsd === null || entry.exchangeRateUsd === undefined || entry.exchangeRateUsd === ''
                  ? '<span style="color:#888">Rate not yet available (try again tomorrow)</span>'
                  : Number.isFinite(Number(entry.exchangeRateUsd))
                    ? Number(entry.exchangeRateUsd).toFixed(6)
                    : '<span style="color:#888">Rate not yet available (try again tomorrow)</span>'
            }</td>
            <td class="usd-amount-cell">${
                entry.amountUsd === null || entry.amountUsd === undefined || entry.amountUsd === ''
                  ? '<span style="color:#888">Amount not yet available</span>'
                  : Number.isFinite(Number(entry.amountUsd))
                    ? ('$' + Number(entry.amountUsd).toFixed(2))
                    : '<span style="color:#888">Amount not yet available</span>'
            }</td>
            <td>
                <label class="toggle-switch" title="Mark as Invoiced">
                  <input type="checkbox" class="invoiced-toggle" data-id="${entry.id}" ${entry.invoiced ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <span style="font-size: 0.85em; color: #444; margin-left: 6px;">Invoiced</span>
            </td>
            <td>
                <label class="toggle-switch" title="Mark as Paid">
                  <input type="checkbox" class="paid-toggle" data-id="${entry.id}" ${entry.paid ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <span style="font-size: 0.85em; color: #444; margin-left: 6px;">Paid</span>
            </td>
            <td>
                <button class="edit-btn blue-btn" data-id="${entry.id}" aria-label="Edit Entry" title="Edit" style="margin-right: 5px; padding: 5px 10px;">✏️</button>
                <button class="delete-btn" data-id="${entry.id}" aria-label="Delete Entry" title="Delete" style="padding: 5px 10px;">🗑️</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });

    // Ensure edit and delete buttons respond to clicks even if delegated
    tableBody.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = button.getAttribute('data-id');
            deleteTimeEntry(id);
        });
    });
    tableBody.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = button.getAttribute('data-id');
            editTimeEntry(id);
        });
    });
    


    // Add invoiced toggle listeners
    document.querySelectorAll('.invoiced-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const entryId = toggle.getAttribute('data-id');
            const checked = toggle.checked;
            try {
                await SupabaseAPI.updateTimeEntry(entryId, { invoiced: checked });
                // Update appState
                const entry = appState.entries.find(ent => ent.id == entryId);
                if (entry) entry.invoiced = checked;
                showNotification(`Entry marked as ${checked ? 'Invoiced' : 'Not Invoiced'}`, 'success');
            } catch (err) {
                showNotification('Failed to update invoiced status', 'error');
                toggle.checked = !checked; // revert
            }
        });
    });
    // Add paid toggle listeners
    document.querySelectorAll('.paid-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const entryId = toggle.getAttribute('data-id');
            const checked = toggle.checked;
            try {
                await SupabaseAPI.updateTimeEntry(entryId, { paid: checked });
                // Update appState
                const entry = appState.entries.find(ent => ent.id == entryId);
                if (entry) entry.paid = checked;
                showNotification(`Entry marked as ${checked ? 'Paid' : 'Not Paid'}`, 'success');
            } catch (err) {
                showNotification('Failed to update paid status', 'error');
                toggle.checked = !checked; // revert
            }
        });
    });

    // --- Exchange Rate & USD Amount Handling ---
    async function refreshAllExchangeRates() {
      const { fetchAudUsdRate } = await import('./exchange.js');
      const rows = tableBody.querySelectorAll('tr');
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const row = rows[i];
        const rateCell = row.querySelector('.exchange-rate-cell');
        const usdCell = row.querySelector('.usd-amount-cell');
        try {
          rateCell.textContent = '...';
          usdCell.textContent = '...';
          // Ensure date is in YYYY-MM-DD format
          const rawDate = entry.date;
          const dateStr = new Date(rawDate).toISOString().split('T')[0];
          console.log(`[EXCHANGE][REFRESH] Entry ID: ${entry.id}, Raw Date: ${rawDate}, Formatted Date: ${dateStr}, Calling fetchAudUsdRate(${dateStr})`);
          const rate = await fetchAudUsdRate(dateStr);
          console.log(`[EXCHANGE][REFRESH] Fetched rate for ${dateStr}:`, rate);
          if (!rate || !Number.isFinite(rate)) throw new Error('No rate or not a number');
          if (!Number.isFinite(entry.amount)) throw new Error('Entry amount is not a number');
          const usdAmount = entry.amount * rate;
          console.log(`[EXCHANGE][REFRESH] Calculated USD for entry ${entry.id}:`, usdAmount);
          rateCell.textContent = rate.toFixed(6);
          usdCell.textContent = '$' + usdAmount.toFixed(2);
          // Persist to Supabase and appState
          await SupabaseAPI.updateTimeEntry(entry.id, { exchange_rate_usd: rate, amount_usd: usdAmount });
          console.log(`[EXCHANGE][REFRESH] Saved to Supabase for entry ${entry.id}`);
          entry.exchangeRateUsd = rate;
          entry.amountUsd = usdAmount;
        } catch (err) {
          console.error(`[EXCHANGE][REFRESH][ERROR] Entry ID: ${entry.id}, Date: ${entry.date}`, err);
          rateCell.textContent = 'Err';
          usdCell.textContent = 'Err';
        }
      }
      showNotification('All exchange rates and USD amounts refreshed.');
    }

    // Add refresh button above the Time Log table if not present
    let refreshBtn = document.getElementById('refresh-exchange-btn');
    if (!refreshBtn) {
      refreshBtn = document.createElement('button');
      refreshBtn.id = 'refresh-exchange-btn';
      refreshBtn.textContent = 'Refresh All Exchange Rates';
      refreshBtn.style = 'margin-bottom: 10px; padding: 6px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 1em; cursor: pointer;';
      const table = document.getElementById('entries-table');
      if (table && table.parentNode) {
        table.parentNode.insertBefore(refreshBtn, table);
      }
    }
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      await refreshAllExchangeRates();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh All Exchange Rates';
    };

    (async () => {
      const { fetchAudUsdRate } = await import('./exchange.js');
      const rows = tableBody.querySelectorAll('tr');
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (Number.isFinite(Number(entry.exchangeRateUsd)) && Number.isFinite(Number(entry.amountUsd))) continue;
        const row = rows[i];
        const rateCell = row.querySelector('.exchange-rate-cell');
        const usdCell = row.querySelector('.usd-amount-cell');
        try {
          rateCell.textContent = '...';
          usdCell.textContent = '...';
          const dateStr = entry.date;
          console.log(`[EXCHANGE] Entry ID: ${entry.id}, Date: ${dateStr}, Calling fetchAudUsdRate(${dateStr})`);
          const rate = await fetchAudUsdRate(dateStr);
          console.log(`[EXCHANGE] Fetched rate for ${dateStr}:`, rate);
          if (!rate || !Number.isFinite(rate)) throw new Error('No rate or not a number');
          if (!Number.isFinite(entry.amount)) throw new Error('Entry amount is not a number');
          const usdAmount = entry.amount * rate;
          console.log(`[EXCHANGE] Calculated USD for entry ${entry.id}:`, usdAmount);
          rateCell.textContent = rate.toFixed(6);
          usdCell.textContent = '$' + usdAmount.toFixed(2);
          // Persist to Supabase and appState
          await SupabaseAPI.updateTimeEntry(entry.id, { exchange_rate_usd: rate, amount_usd: usdAmount });
          console.log(`[EXCHANGE] Saved to Supabase for entry ${entry.id}`);
          entry.exchangeRateUsd = rate;
          entry.amountUsd = usdAmount;
        } catch (err) {
          console.error(`[EXCHANGE][ERROR] Entry ID: ${entry.id}, Date: ${entry.date}`, err);
          rateCell.textContent = 'Err';
          usdCell.textContent = 'Err';
        }
      }
    })();
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

import { updateEntryUsdFields } from './entry-usd-helper.js';
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
    const daysInput = document.getElementById('days');
    const dayRateInput = document.getElementById('day-rate');
    
    // Validate required fields
    if (!dateInput?.value || !descriptionInput?.value ||
        (!hoursInput?.value && !daysInput?.value) ||
        (!rateInput?.value && !dayRateInput?.value)) {
        showNotification("Please fill in all required fields", "error");
        console.error("Form validation failed: Missing required fields");
        return;
    }
    
    // Get values
    const date = dateInput.value;
    const description = descriptionInput.value;
    const client = clientInput?.value || '';
    const project = projectInput?.value || '';
    const hours = parseFloat(hoursInput.value) || 0;
    const rate = parseFloat(rateInput.value) || 0;
    const days = parseFloat(daysInput.value) || 0;
    const dayRate = parseFloat(dayRateInput.value) || 0;
    const amount = hours && rate ? hours * rate : days * dayRate;
    
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
            days,
            dayRate,
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

            // Sort entries by date descending (most recent first)
            appState.entries.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Fetch and update USD rate/amount in the background
            updateEntryUsdFields(newEntry);

            // Update UI
            updateTimeEntriesTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            // Clear form
            descriptionInput.value = '';
            hoursInput.value = '';
            rateInput.value = '';
            daysInput.value = '';
            dayRateInput.value = '';
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
    const daysInput = document.getElementById('days');
    const dayRateInput = document.getElementById('day-rate');
    const editId = document.getElementById('edit-id').value;
    
    // Validate required fields
    if (!dateInput?.value || !descriptionInput?.value || !editId ||
        (!hoursInput?.value && !daysInput?.value) ||
        (!rateInput?.value && !dayRateInput?.value)) {
        showNotification("Please fill in all required fields", "error");
        console.error("Form validation failed: Missing required fields");
        return;
    }
    
    // Get values
    const date = dateInput.value;
    const description = descriptionInput.value;
    const client = clientInput?.value || '';
    const project = projectInput?.value || '';
    const hours = parseFloat(hoursInput.value) || 0;
    const rate = parseFloat(rateInput.value) || 0;
    const days = parseFloat(daysInput.value) || 0;
    const dayRate = parseFloat(dayRateInput.value) || 0;
    const amount = hours && rate ? hours * rate : days * dayRate;
    
    console.log("Updating entry:", editId, { date, description, client, project, hours, rate, days, dayRate, amount });
    
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
            days,
            dayRate,
            amount,
            userId: appState.user.id, // Include user ID for validation
            updatedAt: new Date().toISOString() // Using camelCase as expected by supabase.js
        };
        
        // Update in Supabase
        const updatedEntry = await SupabaseAPI.updateTimeEntryFull(entryData);
        
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

    // Find entry in appState using the raw id (UUID)
    const entry = appState.entries.find(entry => entry.id === id);
    
    if (!entry) {
        console.error("Entry not found:", id);
        showNotification("Entry not found", "error");
        return;
    }
    
    console.log("Found entry to edit:", entry);
    
    // Ensure the record time panel is visible
    if (typeof openPanelById === 'function') {
        openPanelById('record-time-header');
    }

    // Populate form fields
    document.getElementById('date').value = entry.date;
    document.getElementById('description').value = entry.description;
    document.getElementById('client').value = entry.client || '';
    document.getElementById('project').value = entry.project || '';
    document.getElementById('hours').value = entry.hours;
    document.getElementById('rate').value = entry.rate;
    document.getElementById('days').value = entry.days || '';
    document.getElementById('day-rate').value = entry.dayRate || '';
    document.getElementById('edit-id').value = entry.id;
    
    // Switch to edit mode
    setEditModeUI(true);
    
    // Scroll to form
    document.querySelector('.time-entry').scrollIntoView({ behavior: 'smooth' });
}
async function deleteTimeEntry(id) {
    console.log("Deleting time entry:", id);
    // Use the ID as-is (UUID)

    const confirmed = await showConfirmToast('Are you sure you want to delete this entry?');
    if (!confirmed) {
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
    document.getElementById('rate').value = '';
    document.getElementById('days').value = '';
    document.getElementById('day-rate').value = '';
    document.getElementById('edit-id').value = '';
    
    // Keep the rate fields as is (for convenience)
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
function filterInvoiceItems(client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses) { 
    console.log("Filtering invoice items:", { client, projectOption, dateRangeOption, customFrom, customTo, includeExpenses });
    
    // Get date range
    const { startDate, endDate } = getDateRangeFromOption(dateRangeOption, customFrom, customTo);
    
    // Clone arrays to avoid modifying the originals
    let filteredEntries = [...appState.entries];
    let filteredExpenses = includeExpenses ? [...appState.expenses] : [];
    
    // Filter by client
    if (client) {
        filteredEntries = filteredEntries.filter(entry => entry.client === client);
        filteredExpenses = filteredExpenses.filter(expense => expense.client === client);
    }
    
    // Filter by project if not "all"
    if (projectOption && projectOption !== 'all') {
        filteredEntries = filteredEntries.filter(entry => entry.project === projectOption);
        filteredExpenses = filteredExpenses.filter(expense => expense.project === projectOption);
    }
    
    // Filter by date range
    if (startDate) {
        filteredEntries = filteredEntries.filter(entry => new Date(entry.date) >= startDate);
        filteredExpenses = filteredExpenses.filter(expense => new Date(expense.date) >= startDate);
    }
    
    if (endDate) {
        filteredEntries = filteredEntries.filter(entry => new Date(entry.date) <= endDate);
        filteredExpenses = filteredExpenses.filter(expense => new Date(expense.date) <= endDate);
    }
    
    console.log(`Filtered to ${filteredEntries.length} entries and ${filteredExpenses.length} expenses`);
    
    return { entries: filteredEntries, expenses: filteredExpenses };
}

function viewInvoiceEntries() {
    console.log("Viewing invoice entries preview...");
    
    try {
        // Get form values
        const clientSelect = document.getElementById('invoice-client');
        const projectSelect = document.getElementById('invoice-project');
        const dateRangeSelect = document.getElementById('invoice-date-range');
        const includeExpensesSelect = document.getElementById('include-expenses');
        const customFromInput = document.getElementById('invoice-date-from');
        const customToInput = document.getElementById('invoice-date-to');
        
        if (!clientSelect || !clientSelect.value) {
            showNotification("Please select a client first", "error");
            return;
        }
        
        // Get filter values
        const client = clientSelect.value;
        const project = projectSelect ? projectSelect.value : 'all';
        const dateRange = dateRangeSelect ? dateRangeSelect.value : 'this-month';
        const includeExpenses = includeExpensesSelect ? includeExpensesSelect.value === 'yes' : true;
        const customFrom = customFromInput ? customFromInput.value : '';
        const customTo = customToInput ? customToInput.value : '';
        
        // Filter items
        const { entries, expenses } = filterInvoiceItems(
            client, project, dateRange, customFrom, customTo, includeExpenses
        );
        
        // Update the app state with filtered items
        appState.currentInvoicePreview.filteredEntries = entries;
        appState.currentInvoicePreview.filteredExpenses = expenses;
        appState.currentInvoicePreview.includedEntryIds = new Set(entries.map(e => e.id));
        appState.currentInvoicePreview.includedExpenseIds = new Set(expenses.map(e => e.id));
        
        // Display the preview tables
        const entriesPreview = document.getElementById('invoice-entries-preview');
        if (entriesPreview) {
            entriesPreview.style.display = 'block';
        }
        
        // Populate the invoice tables
        populateInvoiceEntriesTable(entries);
        populateInvoiceExpensesTable(expenses);
        
        // Update totals
        updateInvoiceTotalsFromPreview();
        
        // Reapply currency toggle to hide/show USD columns after populating
        const currencySelect = document.getElementById('invoice-currency-select');
        if (currencySelect) currencySelect.dispatchEvent(new Event('change'));
    } catch (error) {
        console.error("Error viewing invoice entries:", error);
        showNotification("Error preparing invoice preview", "error");
    }
}

function updateInvoiceTotalsFromPreview() {
    // Calculate totals from current preview
    const totalHours = appState.currentInvoicePreview.filteredEntries
        .filter(entry => appState.currentInvoicePreview.includedEntryIds.has(entry.id))
        .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    
    const totalAmount = appState.currentInvoicePreview.filteredEntries
        .filter(entry => appState.currentInvoicePreview.includedEntryIds.has(entry.id))
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    
    const totalExpenses = appState.currentInvoicePreview.filteredExpenses
        .filter(expense => appState.currentInvoicePreview.includedExpenseIds.has(expense.id))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    
    const grandTotal = totalAmount + totalExpenses;
    
    // Update UI
    document.getElementById('invoice-total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('invoice-total-amount').textContent = formatCurrency(totalAmount);
    document.getElementById('invoice-total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('invoice-grand-total').textContent = formatCurrency(grandTotal);
    
    // Update USD summary if applicable
    const currency = document.getElementById('invoice-currency-select').value;
    if (currency === 'USD') {
        const rate = parseFloat(document.getElementById('usd-exchange-rate').value) || 0;
        document.getElementById('invoice-usd-rate').textContent = rate.toFixed(4);
        document.getElementById('invoice-grand-total-usd').textContent = (grandTotal * rate).toFixed(2);
    }
}

function populateInvoiceEntriesTable(entries) {
    const currency = document.getElementById('invoice-currency-select')?.value || 'AUD';
    const showUsd = currency === 'USD';
    const usdRate = parseFloat(document.getElementById('usd-exchange-rate')?.value) || 0;
    const tableBody = document.getElementById('invoice-entries-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (entries.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center;">No time entries found for the selected criteria</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // Sort entries by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedEntries.forEach(entry => {
        const row = document.createElement('tr');
        
        const formattedDate = formatDate(entry.date);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHtml(entry.description)}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>${formatCurrency(entry.rate)}</td>
            <td>${entry.days.toFixed(2)}</td>
            <td>${formatCurrency(entry.dayRate)}</td>
            <td>${formatCurrency(entry.amount)}</td>
            <td><input type="checkbox" class="include-entry" data-id="${entry.id}" checked></td>
            ${showUsd ? `
            <td class="exchange-rate-cell">${usdRate.toFixed(6)}</td>
            <td class="usd-amount-cell">${'$' + (entry.amount * usdRate).toFixed(2)}</td>
            ` : ''}
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.include-entry').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const entryId = this.getAttribute('data-id');
            
            if (this.checked) {
                appState.currentInvoicePreview.includedEntryIds.add(entryId);
            } else {
                appState.currentInvoicePreview.includedEntryIds.delete(entryId);
            }
            
            updateInvoiceTotalsFromPreview();
        });
    });
    
    // Toggle preview table USD headers
    document.querySelectorAll('#invoice-entries-table .usd-rate-header, #invoice-entries-table .usd-amount-header').forEach(el => {
        el.style.display = showUsd ? '' : 'none';
    });
    
    // Hide or show USD cells based on currency immediately after rendering
    tableBody.querySelectorAll('.exchange-rate-cell, .usd-amount-cell').forEach(el => {
        el.style.display = showUsd ? '' : 'none';
    });
}

function populateInvoiceExpensesTable(expenses) {
    const currency = document.getElementById('invoice-currency-select')?.value || 'AUD';
    const showUsd = currency === 'USD';
    const usdRate = parseFloat(document.getElementById('usd-exchange-rate')?.value) || 0;
    const tableBody = document.getElementById('invoice-expenses-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (expenses.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align: center;">No expenses found for the selected criteria</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // Sort expenses by date
    const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedExpenses.forEach(expense => {
        const row = document.createElement('tr');
        
        const formattedDate = formatDate(expense.date);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHtml(expense.description)}</td>
            <td>${formatCurrency(expense.amount)}</td>
            <td><input type="checkbox" class="include-expense" data-id="${expense.id}" checked></td>
            ${showUsd ? `
            <td class="usd-amount-expense-cell">${'$' + (expense.amount * usdRate).toFixed(2)}</td>
            ` : ''}
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.include-expense').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const expenseId = this.getAttribute('data-id');
            
            if (this.checked) {
                appState.currentInvoicePreview.includedExpenseIds.add(expenseId);
            } else {
                appState.currentInvoicePreview.includedExpenseIds.delete(expenseId);
            }
            
            updateInvoiceTotalsFromPreview();
        });
    });
    
    // Toggle preview expenses USD header
    document.querySelectorAll('#invoice-expenses-table .usd-amount-expense-header').forEach(el => {
        el.style.display = showUsd ? '' : 'none';
    });
    
    // Hide or show USD expense cells based on currency immediately after rendering
    tableBody.querySelectorAll('.usd-amount-expense-cell').forEach(el => {
        el.style.display = showUsd ? '' : 'none';
    });
}

function handleGenerateInvoiceClick() {
    console.log("Generating invoice...");
    
    // Get form values
    const clientSelect = document.getElementById('invoice-client');
    const invoiceNumberInput = document.getElementById('invoice-number');
    const invoiceDateInput = document.getElementById('invoice-date');
    
    if (!clientSelect || !clientSelect.value) {
        showNotification("Please select a client", "error");
        return;
    }
    
    if (!invoiceNumberInput || !invoiceNumberInput.value) {
        // Generate an invoice number if not provided
        if (invoiceNumberInput) {
            invoiceNumberInput.value = generateInvoiceNumber();
        }
    }
    
    if (!invoiceDateInput || !invoiceDateInput.value) {
        // Set today's date if not provided
        if (invoiceDateInput) {
            invoiceDateInput.valueAsDate = new Date();
        }
    }
    
    // First view the invoice entries if not already done
    if (!appState.currentInvoicePreview.filteredEntries.length) {
        viewInvoiceEntries();
    }
    
    // Then generate the invoice preview
    generateInvoicePreview();
}

function generateInvoicePreview() {
    console.log("Generating invoice preview...");
    
    // Get values
    const clientName = document.getElementById('invoice-client').value;
    const projectName = document.getElementById('invoice-project').value !== 'all' 
        ? document.getElementById('invoice-project').value 
        : '';
    
    const invoiceNumber = document.getElementById('invoice-number').value || generateInvoiceNumber();
    const invoiceDate = document.getElementById('invoice-date').value || new Date().toISOString().split('T')[0];
    const paymentTerms = document.getElementById('payment-terms').value || appState.settings.defaultPaymentTerms;
    const invoiceNotes = document.getElementById('invoice-notes').value || '';
    const currency = document.getElementById('invoice-currency-select').value;
    
    // Get filtered and included entries and expenses
    const includedEntries = appState.currentInvoicePreview.filteredEntries
        .filter(entry => appState.currentInvoicePreview.includedEntryIds.has(entry.id));
    
    const includedExpenses = appState.currentInvoicePreview.filteredExpenses
        .filter(expense => appState.currentInvoicePreview.includedExpenseIds.has(expense.id));
    
    // Calculate totals
    const totalHours = includedEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const totalAmount = includedEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expensesAmount = includedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const grandTotal = totalAmount + expensesAmount;
    
    // Create invoice data object
    const invoiceData = {
        invoiceNumber,
        invoiceDate,
        paymentTerms,
        notes: invoiceNotes,
        client: clientName,
        project: projectName,
        entries: includedEntries,
        expenses: includedExpenses,
        totalHours,
        totalAmount,
        expensesAmount,
        grandTotal,
        senderInfo: {
            name: appState.settings.name || 'Your Name',
            email: appState.settings.email || 'your.email@example.com',
            address: appState.settings.address || 'Your Address',
            paymentInstructions: appState.settings.paymentInstructions || 'Please make payment within the specified terms.',
            bankingDetails: appState.settings.bankingDetails || ''
        },
        currency: currency
    };
    
    // Attach USD rates and amounts (DB rates fallback to manual input rate)
    const rateInput = document.getElementById('usd-exchange-rate');
    const manualRate = rateInput ? parseFloat(rateInput.value) : 1;
    if (currency === 'USD') {
        invoiceData.entries = invoiceData.entries.map(entry => {
            const usdRateVal = entry.exchangeRateUsd != null && !isNaN(entry.exchangeRateUsd)
                ? entry.exchangeRateUsd
                : manualRate;
            return { ...entry, exchangeRateUsd: usdRateVal, amountUsd: entry.amount * usdRateVal };
        });
        invoiceData.expenses = invoiceData.expenses.map(exp => {
            const usdRateVal = exp.exchangeRateUsd != null && !isNaN(exp.exchangeRateUsd)
                ? exp.exchangeRateUsd
                : manualRate;
            return { ...exp, amountUsd: exp.amount * usdRateVal };
        });
    } else {
        invoiceData.entries = invoiceData.entries.map(entry => ({ ...entry, exchangeRateUsd: null, amountUsd: null }));
        invoiceData.expenses = invoiceData.expenses.map(exp => ({ ...exp, amountUsd: null }));
    }
    
    // Save to app state
    appState.currentlyGeneratedInvoice = invoiceData;
    
    // Generate HTML
    const invoiceHtml = generateInvoiceHtml(invoiceData);
    
    // Display the invoice
    const invoicePreview = document.getElementById('invoice-preview');
    if (invoicePreview) {
        invoicePreview.innerHTML = invoiceHtml;
        invoicePreview.style.display = 'block';
    }
    
    // Show action buttons
    document.getElementById('print-invoice').style.display = 'inline-block';
    document.getElementById('save-invoice-pdf').style.display = 'inline-block';
    document.getElementById('export-invoice-excel').style.display = 'inline-block';
    document.getElementById('mark-as-paid').style.display = 'inline-block';
    
    showNotification("Invoice generated", "success");
}

function _generateInvoiceHtmlRaw(invoiceData) {
    const currency = invoiceData.currency;
    const showUsd = currency === 'USD';
    const formattedDate = formatDate(invoiceData.invoiceDate);
    
    // Create HTML template
    let invoiceHtml = `
        <div style="text-align: right; margin-bottom: 20px;">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> ${escapeHtml(invoiceData.invoiceNumber)}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Terms:</strong> ${escapeHtml(invoiceData.paymentTerms)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <p><strong>From:</strong></p>
            <p>${escapeHtml(invoiceData.senderInfo.name)}</p>
            ${invoiceData.senderInfo.email ? `<p>${escapeHtml(invoiceData.senderInfo.email)}</p>` : ''}
            ${invoiceData.senderInfo.address ? `<p>${escapeHtml(invoiceData.senderInfo.address).replace(/\n/g, '<br>')}</p>` : ''}
        </div>
        
        <div style="margin-bottom: 20px;">
            <p><strong>Bill To:</strong></p>
            <p>${escapeHtml(invoiceData.client)}</p>
            ${invoiceData.project ? `<p>Project: ${escapeHtml(invoiceData.project)}</p>` : ''}
        </div>
    `;
    
    // Time entries section
    if (invoiceData.entries.length > 0) {
        invoiceHtml += `
            <h3>Time Entries</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Hours</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Rate</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Amount</th>
                        ${showUsd ? `
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">USD RATE</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Amount (USD)</th>
                        ` : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort entries by date
        const sortedEntries = [...invoiceData.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedEntries.forEach(entry => {
            const entryDate = formatDate(entry.date);
            invoiceHtml += `
                <tr>
                    <td>${entryDate}</td>
                    <td>${escapeHtml(entry.description)}</td>
                    <td>${entry.hours.toFixed(2)}</td>
                    <td>${formatCurrency(entry.rate)}</td>
                    <td>${formatCurrency(entry.amount)}</td>
                    ${showUsd ? `
                    <td>${(entry.exchangeRateUsd !== null && entry.exchangeRateUsd !== undefined && entry.exchangeRateUsd !== 0 && !isNaN(entry.exchangeRateUsd)) ? entry.exchangeRateUsd.toFixed(6) : '<span style="color:#6c757d;font-style:italic;">Rate not yet available (try again tomorrow)</span>'}</td>
                    <td>${(entry.amountUsd !== null && entry.amountUsd !== undefined && entry.amountUsd !== 0 && !isNaN(entry.amountUsd)) ? ('$' + entry.amountUsd.toFixed(2)) : '<span style="color:#6c757d;font-style:italic;">Rate not yet available (try again tomorrow)</span>'}</td>
                    ` : ''}
                </tr>
            `;
        });
        
        invoiceHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;"></td>
                        <td><strong>${invoiceData.totalHours.toFixed(2)}</strong></td>
                        <td></td>
                        <td><strong>${formatCurrency(invoiceData.totalAmount)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
    }
    
    // Expenses section
    if (invoiceData.expenses.length > 0) {
        invoiceHtml += `
            <h3>Expenses</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Amount</th>
                        ${showUsd ? `
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Amount (USD)</th>
                        ` : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort expenses by date
        const sortedExpenses = [...invoiceData.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedExpenses.forEach(expense => {
            const expenseDate = formatDate(expense.date);
            invoiceHtml += `
                <tr>
                    <td>${expenseDate}</td>
                    <td>${escapeHtml(expense.description)}</td>
                    <td>${formatCurrency(expense.amount)}</td>
                    ${showUsd ? `
                    <td>${(expense.amountUsd !== null && expense.amountUsd !== undefined && expense.amountUsd !== 0 && !isNaN(expense.amountUsd)) ? ('$' + expense.amountUsd.toFixed(2)) : '<span style="color:#6c757d;font-style:italic;">Rate not yet available (try again tomorrow)</span>'}</td>
                    ` : ''}
                </tr>
            `;
        });
        
        invoiceHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="1" style="border: 1px solid #ddd; padding: 8px;"></td>
                        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Expenses Subtotal:</strong></td>
                        <td style="border: 1px solid #ddd; padding: 8px;"><strong>${formatCurrency(invoiceData.expensesAmount)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
    }
    
    // Grand total
    invoiceHtml += `
        <div style="text-align: right; margin: 30px 0; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
            <p style="font-size: 1.2em;"><strong>TOTAL DUE: ${formatCurrency(invoiceData.grandTotal)}</strong></p>
        </div>
    `;
    
    // Notes, payment instructions, and banking details
    if (invoiceData.notes || invoiceData.senderInfo.paymentInstructions || invoiceData.senderInfo.bankingDetails) {
        invoiceHtml += `<div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">`;
        
        if (invoiceData.notes) {
            invoiceHtml += `
                <p><strong>Notes:</strong></p>
                <p>${escapeHtml(invoiceData.notes).replace(/\n/g, '<br>')}</p>
            `;
        }
        
        if (invoiceData.senderInfo.paymentInstructions) {
            invoiceHtml += `
                <p><strong>Payment Instructions:</strong></p>
                <p>${escapeHtml(invoiceData.senderInfo.paymentInstructions).replace(/\n/g, '<br>')}</p>
            `;
        }
        
        if (invoiceData.senderInfo.bankingDetails) {
            invoiceHtml += `
                <p><strong>Banking Details:</strong></p>
                <p>${escapeHtml(invoiceData.senderInfo.bankingDetails).replace(/\n/g, '<br>')}</p>
            `;
        }
        
        invoiceHtml += `</div>`;
    }
    
    return invoiceHtml;
}

// Split invoice rendering into AUD vs USD entry points

/** Render AUD-only version by forcing currency to AUD */
function generateInvoiceHtmlAUD(data) {
  return _generateInvoiceHtmlRaw({ ...data, currency: 'AUD' });
}
/** Render USD version */
function generateInvoiceHtmlUSD(data) {
  return _generateInvoiceHtmlRaw({ ...data, currency: 'USD' });
}
/** Public dispatch: choose renderer based on data.currency */
function generateInvoiceHtml(data) {
  return data.currency === 'USD'
    ? generateInvoiceHtmlUSD(data)
    : generateInvoiceHtmlAUD(data);
}

function generateInvoiceNumber() {
    // Generate a simple invoice number format: INV-{YEARMONTH}-{COUNT}
    const now = new Date();
    const yearMonth = now.getFullYear().toString().substring(2) + 
                     (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Get count from existing invoices matching pattern for this month
    const prefix = `INV-${yearMonth}-`;
    const existingCount = appState.invoices
        .filter(inv => inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix))
        .length;
    
    return `${prefix}${(existingCount + 1).toString().padStart(3, '0')}`;
}

function saveInvoicePdf() { 
    console.log("PDF export functionality");
    
    const invoicePreview = document.getElementById('invoice-preview');
    if (!invoicePreview || invoicePreview.style.display === 'none') {
        showNotification('Please generate an invoice first', 'error');
        return;
    }
    
    // A safer approach is to use print CSS to hide everything except the invoice
    showNotification('To save as PDF, choose "Save as PDF" in the print dialog', 'info');
    
    // Create a standalone copy of the invoice for printing
    const invoiceContent = invoicePreview.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
        showNotification('Please allow pop-ups to print or save as PDF', 'error');
        return;
    }
    
    // Build a complete HTML document for the new window
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice ${appState.currentlyGeneratedInvoice?.invoiceNumber || ''}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    line-height: 1.5;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 20px;
                    color: #1d1d1f;
                }
                
                h1, h2, h3 {
                    margin-top: 16px;
                    margin-bottom: 8px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: left;
                }
                
                th {
                    background-color: #f5f5f7;
                }
                
                strong {
                    font-weight: 600;
                }
                
                .invoice-header {
                    text-align: right;
                    margin-bottom: 20px;
                }
                
                .invoice-footer {
                    margin-top: 40px;
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                }
                
                .to-from-section {
                    display: flex;
                    justify-content: space-between;
                }
                
                .from-section, .to-section {
                    flex: 1;
                    max-width: 48%;
                }
                
                .totals-section {
                    text-align: right;
                    margin-top: 20px;
                }
                
                .totals-section p {
                    margin: 5px 0;
                }
                
                .grand-total {
                    font-size: 1.2em;
                    font-weight: bold;
                }
                
                /* Print specific styles */
                @media print {
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    
                    @page {
                        margin: 20px;
                    }
                }
            </style>
        </head>
        <body class="invoice">
            ${invoiceContent}
            <script>
                // Auto-print when loaded
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        // Optional: close after printing
                        // setTimeout(function() { window.close(); }, 500);
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

function exportInvoiceExcel() { 
    console.log("Excel export functionality is not implemented yet");
    showNotification('Excel export functionality will be added in a future update', 'info');
}

function printInvoice() {
    console.log("Print invoice functionality");
    
    const invoicePreview = document.getElementById('invoice-preview');
    if (!invoicePreview || invoicePreview.style.display === 'none') {
        showNotification('Please generate an invoice first', 'error');
        return;
    }
    
    // Use the same approach as saveInvoicePdf but auto-print
    const invoiceContent = invoicePreview.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
        showNotification('Please allow pop-ups to print invoices', 'error');
        return;
    }
    
    // Build a complete HTML document for the new window with the same styles
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice ${appState.currentlyGeneratedInvoice?.invoiceNumber || ''}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    line-height: 1.5;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 20px;
                    color: #1d1d1f;
                }
                
                h1, h2, h3 {
                    margin-top: 16px;
                    margin-bottom: 8px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: left;
                }
                
                th {
                    background-color: #f5f5f7;
                }
                
                strong {
                    font-weight: 600;
                }
                
                .invoice-header {
                    text-align: right;
                    margin-bottom: 20px;
                }
                
                .invoice-footer {
                    margin-top: 40px;
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                }
                
                .to-from-section {
                    display: flex;
                    justify-content: space-between;
                }
                
                .from-section, .to-section {
                    flex: 1;
                    max-width: 48%;
                }
                
                .totals-section {
                    text-align: right;
                    margin-top: 20px;
                }
                
                .totals-section p {
                    margin: 5px 0;
                }
                
                .grand-total {
                    font-size: 1.2em;
                    font-weight: bold;
                }
                
                /* Print specific styles */
                @media print {
                    body {
                        padding: 0;
                        margin: 0;
                    }
                    
                    @page {
                        margin: 20px;
                    }
                }
            </style>
        </head>
        <body class="invoice">
            ${invoiceContent}
            <script>
                // Auto-print when loaded
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

async function markCurrentlyGeneratedInvoicePaid() { 
    console.log("Mark as paid functionality is not implemented yet");
    showNotification('Invoice saved as paid. This will be fully implemented in a future update', 'success');
}

function viewInvoiceFromHistory(id) { 
    console.log(`View invoice ID: ${id} from history`);
    showNotification('View invoice from history will be added in a future update', 'info');
}

async function deleteInvoiceFromHistory(id) { 
    console.log(`Delete invoice ID: ${id} from history`);
    showNotification('Delete invoice from history will be added in a future update', 'info');
}

async function markInvoicePaidFromHistory(id) { 
    console.log(`Mark invoice ID: ${id} as paid`);
    showNotification('Mark invoice as paid will be added in a future update', 'info');
}

// --- Reports Implementation ---
function generateReport() { 
    console.log("Generating report...");
    
    try {
        // Get report parameters
        const reportType = document.getElementById('report-type')?.value || 'summary';
        const dateRange = document.getElementById('report-date-range')?.value || 'this-month';
        const client = document.getElementById('report-client')?.value || 'all';
        const project = document.getElementById('report-project')?.value || 'all';
        const invoiceStatus = document.getElementById('report-invoice-status')?.value || 'all';
        const currency = document.getElementById('report-currency-select')?.value || 'AUD';
        const customFrom = document.getElementById('report-date-from')?.value || '';
        const customTo = document.getElementById('report-date-to')?.value || '';
        
        // Get date range
        const { startDate, endDate } = getDateRangeFromOption(dateRange, customFrom, customTo);
        
        // Filter data
        let filteredEntries = [...appState.entries];
        let filteredExpenses = [...appState.expenses];
        
        // Apply date filter
        if (startDate) {
            filteredEntries = filteredEntries.filter(entry => new Date(entry.date) >= startDate);
            filteredExpenses = filteredExpenses.filter(expense => new Date(expense.date) >= startDate);
        }
        
        if (endDate) {
            filteredEntries = filteredEntries.filter(entry => new Date(entry.date) <= endDate);
            filteredExpenses = filteredExpenses.filter(expense => new Date(expense.date) <= endDate);
        }
        
        // Apply client filter
        if (client !== 'all') {
            filteredEntries = filteredEntries.filter(entry => entry.client === client);
            filteredExpenses = filteredExpenses.filter(expense => expense.client === client);
        }
        
        // Apply project filter
        if (project !== 'all') {
            filteredEntries = filteredEntries.filter(entry => entry.project === project);
            filteredExpenses = filteredExpenses.filter(expense => expense.project === project);
        }

        // Apply invoice status filter
        if (invoiceStatus === 'invoiced') {
            filteredEntries = filteredEntries.filter(entry => entry.invoiced);
        } else if (invoiceStatus === 'paid') {
            filteredEntries = filteredEntries.filter(entry => entry.paid);
        } else if (invoiceStatus === 'not-invoiced') {
            filteredEntries = filteredEntries.filter(entry => !entry.invoiced);
        }
        
        // Generate report HTML based on type
        let reportHtml = '';
        
        switch (reportType) {
            case 'summary':
                reportHtml = generateSummaryReport(filteredEntries, filteredExpenses, startDate, endDate, currency);
                break;
            case 'detailed':
                reportHtml = generateDetailedReport(filteredEntries, filteredExpenses, startDate, endDate, currency);
                break;
            case 'client':
                reportHtml = generateClientReport(filteredEntries, filteredExpenses, startDate, endDate, currency);
                break;
            case 'project':
                reportHtml = generateProjectReport(filteredEntries, filteredExpenses, startDate, endDate, currency);
                break;
            case 'expense':
                reportHtml = generateExpenseReport(filteredExpenses, startDate, endDate, currency);
                break;
            default:
                reportHtml = '<p>Unknown report type selected.</p>';
        }
        
        // Display the report
        const reportContainer = document.getElementById('report-container');
        const noReport = document.getElementById('no-report');
        
        if (reportContainer) {
            if (noReport) noReport.style.display = 'none';
            reportContainer.innerHTML = reportHtml;
        }
        
        showNotification(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated`, "success");
    } catch (error) {
        console.error("Error generating report:", error);
        showNotification("Error generating report", "error");
    }
}

function generateSummaryReport(entries, expenses, startDate, endDate, currency = 'AUD') {
    const useUsd = currency === 'USD';
    // Calculate summary metrics
    const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const totalRevenue = useUsd
        ? entries.reduce((sum, entry) => sum + Number(entry.amountUsd || 0), 0)
        : entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalExpenses = useUsd
        ? expenses.reduce((sum, exp) => sum + Number(exp.amountUsd || 0), 0)
        : expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const netIncome = totalRevenue - totalExpenses;
    
    // Get unique clients and projects
    const clients = [...new Set(entries.map(entry => entry.client).filter(Boolean))];
    const projects = [...new Set(entries.map(entry => entry.project).filter(Boolean))];
    
    // Date range string
    let dateRangeText = 'All Time';
    if (startDate && endDate) {
        dateRangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else if (startDate) {
        dateRangeText = `From ${formatDate(startDate)}`;
    } else if (endDate) {
        dateRangeText = `Until ${formatDate(endDate)}`;
    }
    
    // Generate HTML
    return `
        <div class="report summary-report">
            <h2>Summary Report</h2>
            <p><strong>Date Range:</strong> ${dateRangeText}</p>
            
            <div class="report-section">
                <h3>Overview</h3>
                <div class="stats-row">
                    <div class="stats-card">
                        <div class="stats-label">Total Hours</div>
                        <div class="stats-value">${totalHours.toFixed(2)}</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-label">Total Revenue</div>
                        <div class="stats-value">${formatCurrency(totalRevenue, currency)}</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-label">Total Expenses</div>
                        <div class="stats-value">${formatCurrency(totalExpenses, currency)}</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-label">Net Income</div>
                        <div class="stats-value">${formatCurrency(netIncome, currency)}</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Activity Summary</h3>
                <p><strong>Number of Time Entries:</strong> ${entries.length}</p>
                <p><strong>Number of Expenses:</strong> ${expenses.length}</p>
                <p><strong>Clients Worked With:</strong> ${clients.length} (${clients.join(', ')})</p>
                <p><strong>Projects Worked On:</strong> ${projects.length} (${projects.join(', ')})</p>
                <p><strong>Average Hourly Rate:</strong> ${formatCurrency(totalHours > 0 ? totalRevenue / totalHours : 0, currency)}</p>
            </div>
        </div>
    `;
}

function generateDetailedReport(entries, expenses, startDate, endDate, currency = 'AUD') {
    const showUsd = currency === 'USD';
    // Sort entries by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Date range string
    let dateRangeText = 'All Time';
    if (startDate && endDate) {
        dateRangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else if (startDate) {
        dateRangeText = `From ${formatDate(startDate)}`;
    } else if (endDate) {
        dateRangeText = `Until ${formatDate(endDate)}`;
    }
    
    // Generate HTML
    let html = `
        <div class="report detailed-report">
            <h2>Detailed Time Report</h2>
            <p><strong>Date Range:</strong> ${dateRangeText}</p>
            
            <div class="report-section">
                <h3>Time Entries</h3>
    `;
    
    if (sortedEntries.length === 0) {
        html += '<p>No time entries found for the selected criteria.</p>';
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Hours</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        ${showUsd ? '<th>USD RATE</th><th>AMOUNT (USD)</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalHours = 0;
        let totalAmount = 0;
        
        sortedEntries.forEach(entry => {
            const entryDate = formatDate(entry.date);
            totalHours += Number(entry.hours);
            totalAmount += Number(entry.amount);
            
            html += `
                <tr>
                    <td>${entryDate}</td>
                    <td>${escapeHtml(entry.description)}</td>
                    <td>${escapeHtml(entry.client || '')}</td>
                    <td>${escapeHtml(entry.project || '')}</td>
                    <td>${entry.hours.toFixed(2)}</td>
                    <td>${formatCurrency(entry.rate)}</td>
                    <td>${formatCurrency(entry.amount)}</td>
                    ${showUsd ? `
                    <td>${(entry.exchangeRateUsd !== null && entry.exchangeRateUsd !== undefined && entry.exchangeRateUsd !== 0 && !isNaN(entry.exchangeRateUsd)) ? entry.exchangeRateUsd.toFixed(6) : '<span style="color:#6c757d;font-style:italic;">Rate not yet available (try again tomorrow)</span>'}</td>
                    <td>${(entry.amountUsd !== null && entry.amountUsd !== undefined && entry.amountUsd !== 0 && !isNaN(entry.amountUsd)) ? ('$' + entry.amountUsd.toFixed(2)) : '<span style="color:#6c757d;font-style:italic;">Rate not yet available (try again tomorrow)</span>'}</td>
                    ` : ''}
                </tr>
            `;
        });
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;"></td>
                        <td><strong>${totalHours.toFixed(2)}</strong></td>
                        <td></td>
                        <td><strong>${formatCurrency(totalAmount)}</strong></td>
                        ${showUsd ? '<td></td><td></td>' : ''}
                    </tr>
                </tfoot>
            </table>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateClientReport(entries, expenses, startDate, endDate, currency = 'AUD') {
    // Calculate per-client metrics
    const clientData = {};
    
    // Process time entries
    entries.forEach(entry => {
        const client = entry.client || 'Unassigned';
        
        if (!clientData[client]) {
            clientData[client] = {
                hours: 0,
                revenue: 0,
                expenses: 0,
                projects: new Set()
            };
        }
        
        clientData[client].hours += Number(entry.hours);
        clientData[client].revenue += Number(entry.amount);
        
        if (entry.project) {
            clientData[client].projects.add(entry.project);
        }
    });
    
    // Process expenses
    expenses.forEach(expense => {
        const client = expense.client || 'Unassigned';
        
        if (!clientData[client]) {
            clientData[client] = {
                hours: 0,
                revenue: 0,
                expenses: 0,
                projects: new Set()
            };
        }
        
        clientData[client].expenses += Number(expense.amount);
    });
    
    // Date range string
    let dateRangeText = 'All Time';
    if (startDate && endDate) {
        dateRangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else if (startDate) {
        dateRangeText = `From ${formatDate(startDate)}`;
    } else if (endDate) {
        dateRangeText = `Until ${formatDate(endDate)}`;
    }
    
    // Generate HTML
    let html = `
        <div class="report client-report">
            <h2>Client Report</h2>
            <p><strong>Date Range:</strong> ${dateRangeText}</p>
            
            <div class="report-section">
                <h3>Client Summary</h3>
    `;
    
    const clients = Object.keys(clientData).sort();
    
    if (clients.length === 0) {
        html += '<p>No client data found for the selected criteria.</p>';
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Hours</th>
                        <th>Revenue</th>
                        <th>Expenses</th>
                        <th>Net Income</th>
                        <th>Projects</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalHours = 0;
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        clients.forEach(client => {
            const data = clientData[client];
            const netIncome = data.revenue - data.expenses;
            totalHours += data.hours;
            totalRevenue += data.revenue;
            totalExpenses += data.expenses;
            
            html += `
                <tr>
                    <td>${escapeHtml(client)}</td>
                    <td>${data.hours.toFixed(2)}</td>
                    <td>${formatCurrency(data.revenue)}</td>
                    <td>${formatCurrency(data.expenses)}</td>
                    <td>${formatCurrency(netIncome)}</td>
                    <td>${Array.from(data.projects).join(', ') || 'None'}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td><strong>Total:</strong></td>
                        <td><strong>${totalHours.toFixed(2)}</strong></td>
                        <td><strong>${formatCurrency(totalRevenue)}</strong></td>
                        <td><strong>${formatCurrency(totalExpenses)}</strong></td>
                        <td><strong>${formatCurrency(totalRevenue - totalExpenses)}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateProjectReport(entries, expenses, startDate, endDate, currency = 'AUD') {
    // Calculate per-project metrics
    const projectData = {};
    
    // Process time entries
    entries.forEach(entry => {
        const project = entry.project || 'Unassigned';
        
        if (!projectData[project]) {
            projectData[project] = {
                hours: 0,
                revenue: 0,
                expenses: 0,
                client: entry.client || 'Unknown'
            };
        }
        
        projectData[project].hours += Number(entry.hours);
        projectData[project].revenue += Number(entry.amount);
    });
    
    // Process expenses
    expenses.forEach(expense => {
        const project = expense.project || 'Unassigned';
        
        if (!projectData[project]) {
            projectData[project] = {
                hours: 0,
                revenue: 0,
                expenses: 0,
                client: expense.client || 'Unknown'
            };
        }
        
        projectData[project].expenses += Number(expense.amount);
    });
    
    // Date range string
    let dateRangeText = 'All Time';
    if (startDate && endDate) {
        dateRangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else if (startDate) {
        dateRangeText = `From ${formatDate(startDate)}`;
    } else if (endDate) {
        dateRangeText = `Until ${formatDate(endDate)}`;
    }
    
    // Generate HTML
    let html = `
        <div class="report project-report">
            <h2>Project Report</h2>
            <p><strong>Date Range:</strong> ${dateRangeText}</p>
            
            <div class="report-section">
                <h3>Project Summary</h3>
    `;
    
    const projects = Object.keys(projectData).sort();
    
    if (projects.length === 0) {
        html += '<p>No project data found for the selected criteria.</p>';
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Client</th>
                        <th>Hours</th>
                        <th>Revenue</th>
                        <th>Expenses</th>
                        <th>Net Income</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalHours = 0;
        let totalRevenue = 0;
        let totalExpenses = 0;
        
        projects.forEach(project => {
            const data = projectData[project];
            const netIncome = data.revenue - data.expenses;
            totalHours += data.hours;
            totalRevenue += data.revenue;
            totalExpenses += data.expenses;
            
            html += `
                <tr>
                    <td>${escapeHtml(project)}</td>
                    <td>${escapeHtml(data.client)}</td>
                    <td>${data.hours.toFixed(2)}</td>
                    <td>${formatCurrency(data.revenue)}</td>
                    <td>${formatCurrency(data.expenses)}</td>
                    <td>${formatCurrency(netIncome)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><strong>Total:</strong></td>
                        <td><strong>${totalHours.toFixed(2)}</strong></td>
                        <td><strong>${formatCurrency(totalRevenue)}</strong></td>
                        <td><strong>${formatCurrency(totalExpenses)}</strong></td>
                        <td><strong>${formatCurrency(totalRevenue - totalExpenses)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateExpenseReport(expenses, startDate, endDate, currency = 'AUD') {
    const showUsd = currency === 'USD';
    // Sort expenses by date
    const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Date range string
    let dateRangeText = 'All Time';
    if (startDate && endDate) {
        dateRangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else if (startDate) {
        dateRangeText = `From ${formatDate(startDate)}`;
    } else if (endDate) {
        dateRangeText = `Until ${formatDate(endDate)}`;
    }
    
    // Generate HTML
    let html = `
        <div class="report expense-report">
            <h2>Expense Report</h2>
            <p><strong>Date Range:</strong> ${dateRangeText}</p>
            
            <div class="report-section">
                <h3>Expenses</h3>
    `;
    
    if (sortedExpenses.length === 0) {
        html += '<p>No expenses found for the selected criteria.</p>';
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Amount</th>
                        ${showUsd ? '<th>Amount (USD)</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalAmount = 0;
        
        sortedExpenses.forEach(expense => {
            const formattedDate = formatDate(expense.date);
            totalAmount += Number(expense.amount);
            
            html += `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${escapeHtml(expense.description)}</td>
                    <td>${escapeHtml(expense.client || '')}</td>
                    <td>${escapeHtml(expense.project || '')}</td>
                    <td>${formatCurrency(expense.amount)}</td>
                    ${showUsd ? `<td>${(expense.amountUsd !== null && expense.amountUsd !== undefined && expense.amountUsd !== 0 && !isNaN(expense.amountUsd)) ? ('$' + expense.amountUsd.toFixed(2)) : '<span style="color:#6c757d;font-style:italic;">Rate not yet available (try again tomorrow)</span>'}</td>` : ''}
                </tr>
            `;
        });
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" style="text-align: right;"><strong>Total:</strong></td>
                        <td><strong>${formatCurrency(totalAmount)}</strong></td>
                        ${showUsd ? '<td></td>' : ''}
                    </tr>
                </tfoot>
            </table>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function exportReport() {
    console.log("Export Report functionality");
    
    // Get the report container
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer || reportContainer.innerHTML.trim() === '') {
        showNotification("Please generate a report first", "error");
        return;
    }
    
    // Get report type
    const reportType = document.getElementById('report-type')?.value || 'summary';
    
    // Create a printable version
    window.print();
    
    showNotification(`Report printed. Use browser's "Save as PDF" option to save it.`, "success");
}

function exportReportCSV() {
    console.log("Export Report as CSV...");

    try {
        const reportType = document.getElementById('report-type')?.value || 'summary';
        const dateRange = document.getElementById('report-date-range')?.value || 'this-month';
        const client = document.getElementById('report-client')?.value || 'all';
        const project = document.getElementById('report-project')?.value || 'all';
        const invoiceStatus = document.getElementById('report-invoice-status')?.value || 'all';
        const customFrom = document.getElementById('report-date-from')?.value || '';
        const customTo = document.getElementById('report-date-to')?.value || '';

        const { startDate, endDate } = getDateRangeFromOption(dateRange, customFrom, customTo);

        let entries = [...appState.entries];
        let expenses = [...appState.expenses];

        if (startDate) {
            entries = entries.filter(e => new Date(e.date) >= startDate);
            expenses = expenses.filter(e => new Date(e.date) >= startDate);
        }
        if (endDate) {
            entries = entries.filter(e => new Date(e.date) <= endDate);
            expenses = expenses.filter(e => new Date(e.date) <= endDate);
        }
        if (client !== 'all') {
            entries = entries.filter(e => e.client === client);
            expenses = expenses.filter(e => e.client === client);
        }
        if (project !== 'all') {
            entries = entries.filter(e => e.project === project);
            expenses = expenses.filter(e => e.project === project);
        }
        if (invoiceStatus === 'invoiced') {
            entries = entries.filter(e => e.invoiced);
        } else if (invoiceStatus === 'paid') {
            entries = entries.filter(e => e.paid);
        } else if (invoiceStatus === 'not-invoiced') {
            entries = entries.filter(e => !e.invoiced);
        }

        let csvContent = '';

        if (reportType === 'summary') {
            const totalHours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
            const totalRevenue = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
            const totalExpenses = expenses.reduce((sum, ex) => sum + Number(ex.amount || 0), 0);
            const netIncome = totalRevenue - totalExpenses;

            csvContent += 'Metric,Value\n';
            csvContent += `Total Hours,${totalHours.toFixed(2)}\n`;
            csvContent += `Total Revenue,${totalRevenue}\n`;
            csvContent += `Total Expenses,${totalExpenses}\n`;
            csvContent += `Net Income,${netIncome}\n`;
        } else if (reportType === 'detailed') {
            const headers = ['Date','Description','Client','Project','Hours','Rate','Amount','USD RATE','AMOUNT (USD)'];
            csvContent += headers.join(',') + '\n';
            entries.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(entry => {
                const row = [
                    entry.date,
                    '"' + (entry.description || '').replace(/"/g,'""') + '"',
                    '"' + (entry.client || '').replace(/"/g,'""') + '"',
                    '"' + (entry.project || '').replace(/"/g,'""') + '"',
                    entry.hours,
                    entry.rate,
                    entry.amount,
                    (Number.isFinite(Number(entry.exchangeRateUsd)) ? Number(entry.exchangeRateUsd).toFixed(6) : ''),
                    (Number.isFinite(Number(entry.amountUsd)) ? ('$' + Number(entry.amountUsd).toFixed(2)) : '')
                ];
                csvContent += row.join(',') + '\n';
            });
        } else if (reportType === 'client' || reportType === 'project') {
            const dataMap = {};
            const keyProp = reportType === 'client' ? 'client' : 'project';
            entries.forEach(entry => {
                const key = entry[keyProp] || 'Unassigned';
                if (!dataMap[key]) {
                    dataMap[key] = { hours:0, revenue:0, expenses:0, other:'' };
                    if (reportType === 'project') dataMap[key].client = entry.client || 'Unknown';
                }
                dataMap[key].hours += Number(entry.hours);
                dataMap[key].revenue += Number(entry.amount);
                if (reportType === 'client' && entry.project) {
                    dataMap[key].other = dataMap[key].other ? dataMap[key].other + '; ' + entry.project : entry.project;
                }
            });
            expenses.forEach(exp => {
                const key = exp[keyProp] || 'Unassigned';
                if (!dataMap[key]) {
                    dataMap[key] = { hours:0, revenue:0, expenses:0, other:'' };
                    if (reportType === 'project') dataMap[key].client = exp.client || 'Unknown';
                }
                dataMap[key].expenses += Number(exp.amount);
            });
            const headers = reportType === 'client'
                ? ['Client','Hours','Revenue','Expenses','Net Income','Projects']
                : ['Project','Client','Hours','Revenue','Expenses','Net Income'];
            csvContent += headers.join(',') + '\n';
            Object.keys(dataMap).sort().forEach(key => {
                const d = dataMap[key];
                const row = reportType === 'client'
                    ? [
                        '"'+key.replace(/"/g,'""')+'"',
                        d.hours.toFixed(2),
                        d.revenue,
                        d.expenses,
                        d.revenue - d.expenses,
                        '"'+(d.other||'')+'"'
                    ]
                    : [
                        '"'+key.replace(/"/g,'""')+'"',
                        '"'+(d.client||'').replace(/"/g,'""')+'"',
                        d.hours.toFixed(2),
                        d.revenue,
                        d.expenses,
                        d.revenue - d.expenses
                    ];
                csvContent += row.join(',') + '\n';
            });
        } else if (reportType === 'expense') {
            const headers = ['Date','Description','Client','Project','Amount','Amount (USD)'];
            csvContent += headers.join(',') + '\n';
            expenses.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(exp => {
                const row = [
                    exp.date,
                    '"'+(exp.description||'').replace(/"/g,'""')+'"',
                    '"'+(exp.client||'').replace(/"/g,'""')+'"',
                    '"'+(exp.project||'').replace(/"/g,'""')+'"',
                    exp.amount,
                    (Number.isFinite(Number(exp.amountUsd)) ? ('$' + Number(exp.amountUsd).toFixed(2)) : '')
                ];
                csvContent += row.join(',') + '\n';
            });
        }

        if (!csvContent) {
            showNotification('No data to export', 'error');
            return;
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `report_${reportType}_${dateStr}.csv`;
        triggerDownload(csvContent, filename, 'text/csv');
        showNotification('Report CSV exported', 'success');
    } catch (error) {
        console.error('Error exporting report CSV:', error);
        showNotification('Failed to export report CSV', 'error');
    }
}

// --- Database Setup Check ---
// Display the setup results modal and run the Supabase checks
async function showDatabaseSetupModal() {
    const setupResults = document.getElementById('setup-results');
    if (!setupResults) {
        console.error('Setup results container not found');
        return;
    }

    // Reveal the container and show progress message
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

// --- For debugging purposes ---
function debugButtons() {
    const fileInput = document.getElementById('file-input');
    console.log("Debugging data export buttons...");
    
    // Check if buttons exist
    const exportDataBtn = document.getElementById('export-data');
    const importDataBtn = document.getElementById('import-data');
    const exportCsvBtn = document.getElementById('export-csv');
    
    console.log("Export Data button:", exportDataBtn);
    console.log("Import Data button:", importDataBtn);
    console.log("Export CSV button:", exportCsvBtn);
    
    // Log listeners attached to buttons
    console.log("Adding direct event listeners for debugging");
    
    // Add direct click listeners
    if (exportDataBtn) {
        exportDataBtn.onclick = function() {
            console.log("Export Data button clicked directly");
            exportData();
        };
    }
    
    if (importDataBtn) {
        importDataBtn.onclick = function() {
            console.log("Import Data button clicked directly");
            if (fileInput) {
                fileInput.click();
            } else {
                console.error("File input element not found!");
            }
        };
    }
    
    if (exportCsvBtn) {
        exportCsvBtn.onclick = function() {
            console.log("Export CSV button clicked directly");
            exportCSV();
        };
    }
    
    if (fileInput) {
        fileInput.onchange = function(e) {
            console.log("File input changed:", e.target.files);
            if (e.target.files.length > 0) {
                importData(e.target.files[0]);
            }
        };
    }
}

// Add a helper function to set up auth form listeners
function setupAuthFormsListeners() {
    console.log("Setting up auth forms listeners");
    
    // Login form display
    const loginFormContainer = document.getElementById('login-form-container');
    const signupFormContainer = document.getElementById('signup-form-container');
    
    if (loginFormContainer) {
        loginFormContainer.style.display = 'block';
    }
    
    if (signupFormContainer) {
        signupFormContainer.style.display = 'none';
    }
    
    // Handle signup form toggle
    const showSignupLink = document.getElementById('show-signup-link');
    if (showSignupLink) {
        showSignupLink.onclick = function() {
            if (loginFormContainer) loginFormContainer.style.display = 'none';
            if (signupFormContainer) signupFormContainer.style.display = 'block';
        };
    }
    
    // Handle login form toggle
    const showLoginLink = document.getElementById('show-login-link');
    if (showLoginLink) {
        showLoginLink.onclick = function() {
            if (signupFormContainer) signupFormContainer.style.display = 'none';
            if (loginFormContainer) loginFormContainer.style.display = 'block';
        };
    }
    
    // Handle login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showNotification("Please enter email and password", "error");
                return;
            }
            
            try {
                showLoadingIndicator(true);
                
                const result = await SupabaseAPI.signIn(email, password);
                
                if (result.success) {
                    // Set user state
                    appState.user = result.user;
                    
                    // Load user data
                    await loadUserData();
                    
                    // Show application
                    showApp();
                    
                    showNotification("Login successful!", "success");
                } else {
                    showNotification("Login failed: " + (result.error?.message || "Unknown error"), "error");
                }
            } catch (error) {
                console.error("Login error:", error);
                showNotification("Login failed: " + error.message, "error");
            } finally {
                showLoadingIndicator(false);
            }
        };
    }
    
    // Handle signup form submission
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.onsubmit = async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            
            if (!email || !password || !confirmPassword) {
                showNotification("Please fill all fields", "error");
                return;
            }
            
            if (password !== confirmPassword) {
                showNotification("Passwords do not match", "error");
                return;
            }
            
            try {
                showLoadingIndicator(true);
                
                const result = await SupabaseAPI.signUp(email, password);
                
                if (result.success) {
                    showNotification("Signup successful! Please check your email for verification.", "success");
                    
                    // Switch to login form
                    if (signupFormContainer) signupFormContainer.style.display = 'none';
                    if (loginFormContainer) loginFormContainer.style.display = 'block';
                } else {
                    showNotification("Signup failed: " + (result.error?.message || "Unknown error"), "error");
                }
            } catch (error) {
                console.error("Signup error:", error);
                showNotification("Signup failed: " + error.message, "error");
            } finally {
                showLoadingIndicator(false);
            }
        };
    }
    
    console.log("Auth forms listeners set up");
}

// --- Tab Navigation ---
function openTab(evt, tabId) {
    console.log(`Opening tab: ${tabId}`);
    
    // Debug data buttons when time tracking tab is opened
    if (tabId === 'time-tracking-tab') {
        debugButtons();
    }
    
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
    
    // Get the tab element
    const tabElement = document.getElementById(tabId);
    if (!tabElement) {
        console.error(`Tab element with ID '${tabId}' not found`);
        return;
    }
    
    // First show the tab - this is important for dashboard to initialize properly
    tabElement.style.display = 'block';
    
    // Add active class to clicked button
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    } else {
        // If called programmatically, find the button by data-tab attribute
        const button = document.querySelector(`[data-tab="${tabId}"]`);
        if (button) {
            button.classList.add('active');
        }
    }
    
    // Handle special cases for tabs that need content loaded
    const tabsNeedingContent = ['dashboard-tab', 'invoice-tab', 'reports-tab', 'settings-tab'];
    
    if (tabsNeedingContent.includes(tabId)) {
        // Let's load content if needed
        if (tabElement.innerHTML.trim() === '') {
            // Show a loading indicator
            tabElement.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Loading content...</p></div>';
            
            // Try to load content from time-tracker.html
            loadTabContent(tabId).then(success => {
                if (success) {
                    console.log(`Content loaded successfully for ${tabId}`);
                    
                    // Special handling for dashboard
                    if (tabId === 'dashboard-tab') {
                        initDashboardIfNeeded();
                    }
                } else {
                    console.error(`Failed to load content for ${tabId}`);
                    tabElement.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Failed to load content. Please try refreshing the page.</p></div>';
                }
            });
        } else {
            console.log(`Tab ${tabId} already has content, checking if initialization is needed`);
            
            // Special handling for dashboard
            if (tabId === 'dashboard-tab') {
                initDashboardIfNeeded();
            }
        }
    }
}

// Helper function to load tab content from time-tracker.html
async function loadTabContent(tabId) {
    console.log(`Loading content for tab: ${tabId}...`);
    const tabElement = document.getElementById(tabId);
    
    if (!tabElement) {
        console.error(`Tab element with ID '${tabId}' not found`);
        return false;
    }
    
    // If the tab already has content, just set up needed functionality
    if (tabElement.innerHTML.trim() !== '') {
        console.log(`Tab ${tabId} already has content, initializing functionality...`);
        
        // Initialize specific functionalities for each tab
        if (tabId === 'invoice-tab') {
            updateClientProjectDropdowns();
            setupInvoiceListeners();
        } else if (tabId === 'settings-tab') {
            populateSettingsForm();
            populateRateTemplates();
            setupSettingsListeners();
        } else if (tabId === 'reports-tab') {
            updateClientProjectDropdowns();
            setupReportListeners();
        } else if (tabId === 'dashboard-tab') {
            // Dashboard will be initialized by initDashboardIfNeeded
        }
        
        return true;
    }
    
    try {
        const response = await fetch('time-tracker.html');
        if (!response.ok) {
            throw new Error(`Failed to fetch time-tracker.html: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Extract content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const sourceContent = doc.getElementById(tabId);
        
        if (!sourceContent) {
            console.error(`Tab content for ${tabId} not found in time-tracker.html`);
            return false;
        }
        
        tabElement.innerHTML = sourceContent.innerHTML;
        console.log(`Content for ${tabId} loaded successfully`);
        
        // Initialize specific functionalities for each tab
        if (tabId === 'invoice-tab') {
            updateClientProjectDropdowns();
            setupInvoiceListeners();
            addInvoiceHistoryActionListeners();
        } else if (tabId === 'settings-tab') {
            populateSettingsForm();
            populateRateTemplates();
            setupSettingsListeners();
            addRateActionListeners();
        } else if (tabId === 'reports-tab') {
            updateClientProjectDropdowns();
            setupReportListeners();
        } else if (tabId === 'dashboard-tab') {
            // Dashboard will be initialized by initDashboardIfNeeded
        }
        
        return true;
    } catch (error) {
        console.error(`Error loading ${tabId} content:`, error);
        showNotification(`Failed to load ${tabId.replace('-tab', '')} content`, "error");
        return false;
    }
}

// Note: All Utility/Helper functions are defined at the top now

// --- Final Log ---
console.log("app.js V13 (addListener deduped) loaded."); // Updated version log
