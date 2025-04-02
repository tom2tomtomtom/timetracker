// App.js - Main application logic
import * as SupabaseAPI from './supabase.js';
import { initDashboard, updateDashboard } from './dashboard.js';
import { runSetupChecks } from './setup-check.js';

document.addEventListener('DOMContentLoaded', initApp);

// Global state
let timeEntries = [];
let expenses = [];
let recurringEntries = [];
let invoices = [];
let rates = [];
let settings = {
    defaultRate: 350,
    defaultPaymentTerms: 'Net 30',
    name: '',
    email: '',
    address: '',
    paymentInstructions: '',
    theme: 'light',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD'
};

// Current user
let currentUser = null;

async function initApp() {
    console.log("Initializing app...");
    
    // First, check if Supabase tables exist
    try {
        console.log("Checking Supabase configuration...");
        
        // Check if we can connect to Supabase
        const { data: tableData, error: tableError } = await SupabaseAPI.supabase
            .from('time_entries')
            .select('*', { count: 'exact', head: true });
        
        if (tableError) {
            console.error("Error connecting to Supabase or accessing time_entries table:", tableError);
            alert("Error connecting to database. Please check console for details.");
            return;
        }
        
        console.log("Supabase connection successful, time_entries table exists");
    } catch (err) {
        console.error("Critical error checking Supabase configuration:", err);
        alert(`Critical database error: ${err.message}. Please check console for details.`);
        return;
    }
    
    // Check for existing session
    console.log("Checking for existing user session...");
    currentUser = await SupabaseAPI.getCurrentUser();
    
    if (currentUser) {
        console.log("User is logged in:", currentUser);
        // User is logged in, load their data
        await loadUserData();
        showApp();
    } else {
        console.log("No user session found, showing login form");
        // User needs to log in
        showLoginForm();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize dashboard
    initDashboard();
    
    // Set current date for date fields
    setDefaultDates();
}

function setDefaultDates() {
    // Set current date for all date input fields that don't have a value
    const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD format
    const dateInputs = document.querySelectorAll('input[type="date"]');
    
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
}

async function loadUserData() {
    try {
        // Load time entries
        timeEntries = await SupabaseAPI.getTimeEntries();
        
        // Load expenses
        expenses = await SupabaseAPI.getExpenses();
        
        // Load user settings
        const userSettings = await SupabaseAPI.getSettings(currentUser.id);
        if (userSettings) {
            settings = userSettings;
        }
        
        // Apply theme if set
        if (settings.theme === 'dark' || 
           (settings.theme === 'auto' && 
            window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-mode');
        }
        
        // Load settings values into the form
        populateSettingsForm();
        
        // Update UI elements
        updateTable();
        updateSummary();
        updateClientProjectDropdowns();
        
        // Update dark mode toggle button text
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading your data. Please try again.', 'error');
    }
}

function populateSettingsForm() {
    // Populate the settings form with current values
    const defaultRateSelect = document.getElementById('default-rate');
    const defaultPaymentTermsInput = document.getElementById('default-payment-terms');
    const nameInput = document.getElementById('your-name');
    const emailInput = document.getElementById('your-email');
    const addressInput = document.getElementById('your-address');
    const paymentInput = document.getElementById('payment-instructions');
    const themeSelect = document.getElementById('theme-selection');
    const dateFormatSelect = document.getElementById('date-format');
    const currencySelect = document.getElementById('currency-format');
    
    if (defaultRateSelect) defaultRateSelect.value = settings.defaultRate || 350;
    if (defaultPaymentTermsInput) defaultPaymentTermsInput.value = settings.defaultPaymentTerms || 'Net 30';
    if (nameInput) nameInput.value = settings.name || '';
    if (emailInput) emailInput.value = settings.email || '';
    if (addressInput) addressInput.value = settings.address || '';
    if (paymentInput) paymentInput.value = settings.paymentInstructions || '';
    if (themeSelect) themeSelect.value = settings.theme || 'light';
    if (dateFormatSelect) dateFormatSelect.value = settings.dateFormat || 'MM/DD/YYYY';
    if (currencySelect) currencySelect.value = settings.currency || 'USD';
}

function showApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('app-container').style.display = 'none';
}

// Auto-save timer and data
let autoSaveTimer = null;
const AUTO_SAVE_DELAY = 2000; // 2 seconds delay for auto-save

function setupEventListeners() {
    // Auth related listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('show-signup-link').addEventListener('click', toggleAuthForms);
    document.getElementById('show-login-link').addEventListener('click', toggleAuthForms);
    document.getElementById('check-setup').addEventListener('click', showDatabaseSetupModal);
    
    // App related listeners
    document.getElementById('add-entry').addEventListener('click', addTimeEntry);
    document.getElementById('update-entry').addEventListener('click', updateTimeEntry);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
    
    // Invoice related listeners
    document.getElementById('generate-invoice').addEventListener('click', generateInvoice);
    document.getElementById('view-invoice-entries').addEventListener('click', viewInvoiceEntries);
    
    const printInvoiceBtn = document.getElementById('print-invoice');
    if (printInvoiceBtn) {
        printInvoiceBtn.addEventListener('click', () => window.print());
    }
    
    // Settings related listeners
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('save-display-settings').addEventListener('click', saveDisplaySettings);
    
    // Data export/import
    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportData);
    }
    
    const importDataBtn = document.getElementById('import-data');
    if (importDataBtn) {
        importDataBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.click();
        });
    }
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', importData);
    }
    
    // Dashboard
    const refreshDashboardBtn = document.getElementById('refresh-dashboard');
    if (refreshDashboardBtn) {
        refreshDashboardBtn.addEventListener('click', () => {
            if (typeof updateDashboard === 'function') {
                updateDashboard();
            }
        });
    }
    
    // Dark mode toggle
    const darkModeToggleBtn = document.getElementById('dark-mode-toggle');
    if (darkModeToggleBtn) {
        darkModeToggleBtn.addEventListener('click', toggleDarkMode);
    }
    
    // Date range listeners
    setupDateRangeListeners();
    
    // Tab navigation listeners
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-tab');
            openTab(e, tabName);
        });
    });
    
    // Set up auto-save on form fields
    setupAutoSave();
}

function setupDateRangeListeners() {
    // For main time tracking
    const dateRange = document.getElementById('date-range');
    if (dateRange) {
        dateRange.addEventListener('change', () => {
            const customDateRange = document.getElementById('custom-date-range');
            if (customDateRange) {
                customDateRange.style.display = dateRange.value === 'custom' ? 'block' : 'none';
            }
        });
    }
    
    // For dashboard
    const dashDateRange = document.getElementById('dash-date-range');
    if (dashDateRange) {
        dashDateRange.addEventListener('change', () => {
            const customDateRange = document.getElementById('dash-custom-date-range');
            if (customDateRange) {
                customDateRange.style.display = dashDateRange.value === 'custom' ? 'block' : 'none';
            }
        });
    }
    
    // For invoice
    const invoiceDateRange = document.getElementById('invoice-date-range');
    if (invoiceDateRange) {
        invoiceDateRange.addEventListener('change', () => {
            const customDateRange = document.getElementById('invoice-custom-date-range');
            if (customDateRange) {
                customDateRange.style.display = invoiceDateRange.value === 'custom' ? 'block' : 'none';
            }
        });
    }
    
    // For reports
    const reportDateRange = document.getElementById('report-date-range');
    if (reportDateRange) {
        reportDateRange.addEventListener('change', () => {
            const customDateRange = document.getElementById('report-custom-date-range');
            if (customDateRange) {
                customDateRange.style.display = reportDateRange.value === 'custom' ? 'block' : 'none';
            }
        });
    }
}

// Save settings
async function saveSettings() {
    if (!currentUser) {
        showNotification('You must be logged in to save settings', 'error');
        return;
    }
    
    try {
        // Get values from form
        const defaultRate = parseFloat(document.getElementById('default-rate').value) || 350;
        const defaultPaymentTerms = document.getElementById('default-payment-terms').value;
        const name = document.getElementById('your-name').value;
        const email = document.getElementById('your-email').value;
        const address = document.getElementById('your-address').value;
        const paymentInstructions = document.getElementById('payment-instructions').value;
        
        // Update settings object
        settings.defaultRate = defaultRate;
        settings.defaultPaymentTerms = defaultPaymentTerms;
        settings.name = name;
        settings.email = email;
        settings.address = address;
        settings.paymentInstructions = paymentInstructions;
        
        // Save to database
        const updatedSettings = await SupabaseAPI.saveSettings({
            ...settings,
            user_id: currentUser.id
        });
        
        if (updatedSettings) {
            showNotification('Settings saved successfully!', 'success');
        } else {
            showNotification('Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings. Please try again.', 'error');
    }
}

// Save display settings
async function saveDisplaySettings() {
    if (!currentUser) {
        showNotification('You must be logged in to save settings', 'error');
        return;
    }
    
    try {
        // Get values from form
        const theme = document.getElementById('theme-selection').value;
        const dateFormat = document.getElementById('date-format').value;
        const currency = document.getElementById('currency-format').value;
        
        // Update settings object
        settings.theme = theme;
        settings.dateFormat = dateFormat;
        settings.currency = currency;
        
        // Apply theme if changed
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            document.getElementById('dark-mode-toggle').textContent = '☀️';
        } else if (theme === 'light') {
            document.body.classList.remove('dark-mode');
            document.getElementById('dark-mode-toggle').textContent = '🌙';
        } else if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.classList.add('dark-mode');
                document.getElementById('dark-mode-toggle').textContent = '☀️';
            } else {
                document.body.classList.remove('dark-mode');
                document.getElementById('dark-mode-toggle').textContent = '🌙';
            }
        }
        
        // Save to database
        const updatedSettings = await SupabaseAPI.saveSettings({
            ...settings,
            user_id: currentUser.id
        });
        
        if (updatedSettings) {
            showNotification('Display settings saved successfully!', 'success');
        } else {
            showNotification('Failed to save display settings', 'error');
        }
    } catch (error) {
        console.error('Error saving display settings:', error);
        showNotification('Error saving display settings. Please try again.', 'error');
    }
}

// Function for toggling dark mode
function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    
    // Update settings
    settings.theme = isDarkMode ? 'dark' : 'light';
    
    // Update button text
    document.getElementById('dark-mode-toggle').textContent = isDarkMode ? '☀️' : '🌙';
    
    // Save settings if user is logged in
    if (currentUser) {
        SupabaseAPI.saveSettings({
            ...settings,
            user_id: currentUser.id
        });
    }
}

// Export data to JSON file
function exportData() {
    if (!timeEntries.length && !expenses.length) {
        showNotification('No data to export', 'error');
        return;
    }
    
    try {
        // Create export object with all data
        const exportData = {
            timeEntries,
            expenses,
            settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        // Convert to JSON
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Create blob and download link
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `timetracker_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        showNotification('Data exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Error exporting data. Please try again.', 'error');
    }
}

// Import data from JSON file
function importData(e) {
    const file = e.target.files[0];
    
    if (!file) {
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            // Validate data structure
            if (!data.timeEntries || !Array.isArray(data.timeEntries)) {
                showNotification('Invalid data format', 'error');
                return;
            }
            
            // Confirm import
            if (!confirm(`This will import ${data.timeEntries.length} time entries and ${(data.expenses || []).length} expenses. Continue?`)) {
                return;
            }
            
            // Import time entries
            let successCount = 0;
            
            for (const entry of data.timeEntries) {
                // Add user_id if not present
                if (!entry.user_id) {
                    entry.user_id = currentUser.id;
                }
                
                const newEntry = await SupabaseAPI.addTimeEntry(entry);
                if (newEntry) {
                    successCount++;
                }
            }
            
            // Import expenses if present
            let expenseCount = 0;
            
            if (data.expenses && Array.isArray(data.expenses)) {
                for (const expense of data.expenses) {
                    // Add user_id if not present
                    if (!expense.user_id) {
                        expense.user_id = currentUser.id;
                    }
                    
                    const newExpense = await SupabaseAPI.addExpense(expense);
                    if (newExpense) {
                        expenseCount++;
                    }
                }
            }
            
            // Reload data
            await loadUserData();
            
            // Show success message
            showNotification(`Imported ${successCount} time entries and ${expenseCount} expenses successfully!`, 'success');
            
            // Clear file input
            e.target.value = '';
        } catch (error) {
            console.error('Error importing data:', error);
            showNotification('Error importing data. Please check file format and try again.', 'error');
        }
    };
    
    reader.readAsText(file);
}

function setupAutoSave() {
    // Auto-save for time entry form
    const formFields = [
        'date', 
        'description', 
        'client', 
        'project', 
        'hours', 
        'rate'
    ];
    
    // Add input event listeners to all form fields
    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                // Clear any existing timer
                if (autoSaveTimer) {
                    clearTimeout(autoSaveTimer);
                }
                
                // Set a new timer
                autoSaveTimer = setTimeout(() => {
                    saveFormData();
                }, AUTO_SAVE_DELAY);
            });
        }
    });
    
    // Also add change event for the date field
    const dateField = document.getElementById('date');
    if (dateField) {
        dateField.addEventListener('change', () => {
            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
            }
            autoSaveTimer = setTimeout(() => {
                saveFormData();
            }, AUTO_SAVE_DELAY);
        });
    }
    
    // Load any previously saved form data
    loadFormData();
}

async function saveFormData() {
    if (!currentUser) return;
    
    // Get values from form
    const formData = {
        date: document.getElementById('date').value,
        description: document.getElementById('description').value,
        client: document.getElementById('client').value,
        project: document.getElementById('project').value,
        hours: document.getElementById('hours').value,
        rate: document.getElementById('rate').value,
        editId: document.getElementById('edit-id').value,
        lastUpdated: new Date().toISOString()
    };
    
    // Check if we have actual data to save
    if (!formData.date && !formData.description && !formData.hours) {
        return; // Don't save empty forms
    }
    
    try {
        // 1. Store form data in localStorage as a backup
        localStorage.setItem(`formData_${currentUser.id}`, JSON.stringify(formData));
        
        // 2. Also save to Supabase for cross-device persistence
        // This is an async operation but we don't wait for it to finish
        SupabaseAPI.saveFormDataToDatabase(currentUser.id, formData)
            .then(success => {
                if (!success) {
                    console.warn('Failed to save form data to database, but saved to localStorage');
                }
            })
            .catch(err => {
                console.error('Error saving form data to database:', err);
            });
        
        // Show subtle indicator that data was saved
        const saveIndicator = document.createElement('div');
        saveIndicator.textContent = 'Auto-saved';
        saveIndicator.style.position = 'fixed';
        saveIndicator.style.bottom = '10px';
        saveIndicator.style.left = '10px';
        saveIndicator.style.background = 'rgba(52, 199, 89, 0.8)';
        saveIndicator.style.color = 'white';
        saveIndicator.style.padding = '5px 10px';
        saveIndicator.style.borderRadius = '4px';
        saveIndicator.style.fontSize = '12px';
        saveIndicator.style.opacity = '0.9';
        saveIndicator.style.transition = 'opacity 0.5s ease';
        
        document.body.appendChild(saveIndicator);
        
        // Fade out after 2 seconds
        setTimeout(() => {
            saveIndicator.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(saveIndicator);
            }, 500);
        }, 2000);
    } catch (err) {
        console.error('Error in saveFormData:', err);
    }
}

async function loadFormData() {
    if (!currentUser) return;
    
    try {
        let formData = null;
        
        // First try to get data from Supabase
        try {
            const dbFormData = await SupabaseAPI.getFormDataFromDatabase(currentUser.id);
            
            if (dbFormData) {
                formData = dbFormData;
                console.log('Loaded form data from Supabase');
            }
        } catch (dbErr) {
            console.warn('Failed to load form data from database:', dbErr);
        }
        
        // Fall back to localStorage if Supabase failed or returned no data
        if (!formData) {
            const savedData = localStorage.getItem(`formData_${currentUser.id}`);
            
            if (savedData) {
                formData = JSON.parse(savedData);
                console.log('Loaded form data from localStorage');
            }
        }
        
        // If we didn't get any data, return
        if (!formData) return;
        
        // Populate form fields
        if (formData.date) document.getElementById('date').value = formData.date;
        if (formData.description) document.getElementById('description').value = formData.description;
        if (formData.client) document.getElementById('client').value = formData.client;
        if (formData.project) document.getElementById('project').value = formData.project;
        if (formData.hours) document.getElementById('hours').value = formData.hours;
        if (formData.rate) document.getElementById('rate').value = formData.rate;
        if (formData.editId) document.getElementById('edit-id').value = formData.editId;
        
        // If we are in edit mode
        if (formData.editId) {
            document.getElementById('add-entry').style.display = 'none';
            document.getElementById('update-entry').style.display = 'inline-block';
            document.getElementById('cancel-edit').style.display = 'inline-block';
            document.getElementById('form-title').textContent = 'Edit Time Entry';
        }
    } catch (err) {
        console.error('Error loading saved form data:', err);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Please enter both email and password', 'error');
        return;
    }
    
    try {
        const result = await SupabaseAPI.signIn(email, password);
        
        if (result.success) {
            currentUser = result.user;
            await loadUserData();
            showApp();
            showNotification('Logged in successfully!', 'success');
        } else {
            showNotification(result.error.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    
    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    try {
        const result = await SupabaseAPI.signUp(email, password);
        
        if (result.success) {
            showNotification('Account created! Please check your email to confirm your registration.', 'success');
            toggleAuthForms(); // Switch back to login form
        } else {
            showNotification(result.error.message || 'Signup failed', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showNotification('Signup failed. Please try again.', 'error');
    }
}

async function handleLogout() {
    try {
        await SupabaseAPI.signOut();
        currentUser = null;
        showLoginForm();
        showNotification('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed. Please try again.', 'error');
    }
}

function toggleAuthForms() {
    const loginForm = document.getElementById('login-form-container');
    const signupForm = document.getElementById('signup-form-container');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Invoice generation functionality
async function generateInvoice() {
    try {
        // Get form values
        const client = document.getElementById('invoice-client').value;
        const project = document.getElementById('invoice-project').value;
        const dateRange = document.getElementById('invoice-date-range').value;
        const customFrom = document.getElementById('invoice-date-from').value;
        const customTo = document.getElementById('invoice-date-to').value;
        const includeExpenses = document.getElementById('include-expenses').value === 'yes';
        const invoiceNumber = document.getElementById('invoice-number').value || generateInvoiceNumber();
        const invoiceDate = document.getElementById('invoice-date').value || new Date().toISOString().slice(0, 10);
        const paymentTerms = document.getElementById('payment-terms').value || settings.defaultPaymentTerms || 'Net 30';
        const notes = document.getElementById('invoice-notes').value || '';
        
        // Validate inputs
        if (!client) {
            showNotification('Please select a client', 'error');
            return;
        }
        
        // Get filtered entries
        const { from: startDate, to: endDate } = getDateRangeFromOption(
            dateRange, customFrom, customTo
        );
        
        // Filter time entries
        const filteredEntries = timeEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            
            // Check date range
            const inDateRange = entryDate >= startDate && entryDate <= endDate;
            
            // Check client
            const clientMatch = entry.client === client;
            
            // Check project
            const projectMatch = project === 'all' || entry.project === project;
            
            return inDateRange && clientMatch && projectMatch;
        });
        
        // Filter expenses
        const filteredExpenses = includeExpenses ? expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            
            // Check date range
            const inDateRange = expenseDate >= startDate && expenseDate <= endDate;
            
            // Check client
            const clientMatch = expense.client === client;
            
            // Check project
            const projectMatch = project === 'all' || expense.project === project;
            
            return inDateRange && clientMatch && projectMatch;
        }) : [];
        
        // Calculate totals
        const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
        const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const grandTotal = totalAmount + totalExpenses;
        
        // Check if we have entries
        if (filteredEntries.length === 0) {
            showNotification('No time entries found for selected criteria', 'error');
            return;
        }
        
        // Create invoice object
        const invoice = {
            user_id: currentUser.id,
            invoice_number: invoiceNumber,
            client,
            project: project !== 'all' ? project : '',
            invoice_date: invoiceDate,
            payment_terms: paymentTerms,
            notes,
            total_hours: totalHours,
            total_amount: totalAmount,
            expenses_amount: totalExpenses,
            grand_total: grandTotal,
            status: 'unpaid'
        };
        
        // Create invoice items from time entries
        const invoiceItems = filteredEntries.map(entry => ({
            invoice_id: null, // Will be set after invoice is created
            date: entry.date,
            description: entry.description,
            hours: entry.hours,
            rate: entry.rate,
            amount: entry.amount,
            type: 'time'
        }));
        
        // Add expense items if needed
        if (includeExpenses) {
           filteredExpenses.forEach(expense => {
                invoiceItems.push({
                    invoice_id: null, // Will be set after invoice is created
                    date: expense.date,
                    description: expense.description,
                    hours: null,
                    rate: null,
                    amount: expense.amount,
                    type: 'expense'
                });
            });
        }
        
        // Store invoice and items in state
        const currentInvoice = {
            invoice,
            items: invoiceItems
        };
        
        // Store current invoice in window variable for access
        window.currentInvoice = currentInvoice;
        
        // Generate HTML invoice
        const invoiceHtml = generateInvoiceHtml(currentInvoice);
        
        // Display invoice
        const invoicePreview = document.getElementById('invoice-preview');
        invoicePreview.innerHTML = invoiceHtml;
        invoicePreview.style.display = 'block';
        
        // Enable additional buttons
        document.getElementById('print-invoice').style.display = 'inline-block';
        document.getElementById('save-invoice-pdf').style.display = 'inline-block';
        document.getElementById('export-invoice-excel').style.display = 'inline-block';
        document.getElementById('mark-as-paid').style.display = 'inline-block';
        
        // Show invoice history if it was hidden
        document.querySelector('.invoice-history').style.display = 'block';
        
        showNotification('Invoice generated successfully!', 'success');
    } catch (error) {
        console.error('Error generating invoice:', error);
        showNotification('Error generating invoice. Please try again.', 'error');
    }
}

// Function to view entries that would be included in the invoice
function viewInvoiceEntries() {
    try {
        // Get form values
        const client = document.getElementById('invoice-client').value;
        const project = document.getElementById('invoice-project').value;
        const dateRange = document.getElementById('invoice-date-range').value;
        const customFrom = document.getElementById('invoice-date-from').value;
        const customTo = document.getElementById('invoice-date-to').value;
        const includeExpenses = document.getElementById('include-expenses').value === 'yes';
        
        // Validate inputs
        if (!client) {
            showNotification('Please select a client', 'error');
            return;
        }
        
        // Get filtered entries
        const { from: startDate, to: endDate } = getDateRangeFromOption(
            dateRange, customFrom, customTo
        );
        
        // Filter time entries
        const filteredEntries = timeEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            
            // Check date range
            const inDateRange = entryDate >= startDate && entryDate <= endDate;
            
            // Check client
            const clientMatch = entry.client === client;
            
            // Check project
            const projectMatch = project === 'all' || entry.project === project;
            
            return inDateRange && clientMatch && projectMatch;
        });
        
        // Filter expenses
        const filteredExpenses = includeExpenses ? expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            
            // Check date range
            const inDateRange = expenseDate >= startDate && expenseDate <= endDate;
            
            // Check client
            const clientMatch = expense.client === client;
            
            // Check project
            const projectMatch = project === 'all' || expense.project === project;
            
            return inDateRange && clientMatch && projectMatch;
        }) : [];
        
        // Calculate totals
        const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
        const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const grandTotal = totalAmount + totalExpenses;
        
        // Update the UI
        const entriesTable = document.getElementById('invoice-entries-body');
        const expensesTable = document.getElementById('invoice-expenses-body');
        
        entriesTable.innerHTML = '';
        expensesTable.innerHTML = '';
        
        // Add time entries to table
        filteredEntries.forEach(entry => {
            const row = document.createElement('tr');
            const date = new Date(entry.date).toLocaleDateString();
            
            row.innerHTML = `
                <td>${date}</td>
                <td>${entry.description}</td>
                <td>${entry.hours.toFixed(2)}</td>
                <td>$${entry.rate.toFixed(2)}</td>
                <td>$${entry.amount.toFixed(2)}</td>
                <td><input type="checkbox" class="include-entry" data-id="${entry.id}" checked></td>
            `;
            
            entriesTable.appendChild(row);
        });
        
        // Add expenses to table
        filteredExpenses.forEach(expense => {
            const row = document.createElement('tr');
            const date = new Date(expense.date).toLocaleDateString();
            
            row.innerHTML = `
                <td>${date}</td>
                <td>${expense.description}</td>
                <td>$${expense.amount.toFixed(2)}</td>
                <td><input type="checkbox" class="include-expense" data-id="${expense.id}" checked></td>
            `;
            
            expensesTable.appendChild(row);
        });
        
        // Update totals
        document.getElementById('invoice-total-hours').textContent = totalHours.toFixed(2);
        document.getElementById('invoice-total-amount').textContent = totalAmount.toFixed(2);
        document.getElementById('invoice-total-expenses').textContent = totalExpenses.toFixed(2);
        document.getElementById('invoice-grand-total').textContent = grandTotal.toFixed(2);
        
        // Show the entries preview
        document.getElementById('invoice-entries-preview').style.display = 'block';
        
        // Add event listeners to checkboxes
        document.querySelectorAll('.include-entry, .include-expense').forEach(checkbox => {
            checkbox.addEventListener('change', updateInvoiceTotals);
        });
    } catch (error) {
        console.error('Error viewing invoice entries:', error);
        showNotification('Error retrieving entries. Please try again.', 'error');
    }
}

// Update totals based on checked entries
function updateInvoiceTotals() {
    try {
        // Calculate totals from checked entries
        let totalHours = 0;
        let totalAmount = 0;
        let totalExpenses = 0;
        
        // Calculate time entry totals
        document.querySelectorAll('.include-entry:checked').forEach(checkbox => {
            const id = checkbox.getAttribute('data-id');
            const entry = timeEntries.find(e => e.id === id);
            
            if (entry) {
                totalHours += entry.hours;
                totalAmount += entry.amount;
            }
        });
        
        // Calculate expense totals
        document.querySelectorAll('.include-expense:checked').forEach(checkbox => {
            const id = checkbox.getAttribute('data-id');
            const expense = expenses.find(e => e.id === id);
            
            if (expense) {
                totalExpenses += expense.amount;
            }
        });
        
        // Update totals display
        document.getElementById('invoice-total-hours').textContent = totalHours.toFixed(2);
        document.getElementById('invoice-total-amount').textContent = totalAmount.toFixed(2);
        document.getElementById('invoice-total-expenses').textContent = totalExpenses.toFixed(2);
        document.getElementById('invoice-grand-total').textContent = (totalAmount + totalExpenses).toFixed(2);
    } catch (error) {
        console.error('Error updating invoice totals:', error);
    }
}

// Generate HTML for invoice
function generateInvoiceHtml(invoiceData) {
    const { invoice, items } = invoiceData;
    
    // Format dates
    const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString();
    
    // Calculate due date based on payment terms
    const dueDate = new Date(invoice.invoice_date);
    const terms = invoice.payment_terms || 'Net 30';
    const days = parseInt(terms.match(/\d+/)?.[0] || 30);
    dueDate.setDate(dueDate.getDate() + days);
    const formattedDueDate = dueDate.toLocaleDateString();
    
    // Group items by type (time or expense)
    const timeItems = items.filter(item => item.type === 'time');
    const expenseItems = items.filter(item => item.type === 'expense');
    
    // Generate HTML
    return `
        <div class="invoice-container">
            <div class="invoice-header">
                <div class="company-info">
                    <h2>${settings.name || 'Your Name/Company'}</h2>
                    <p>${settings.email || ''}</p>
                    <p>${settings.address || ''}</p>
                </div>
                <div class="invoice-info">
                    <h1>INVOICE</h1>
                    <table>
                        <tr>
                            <td>Invoice #:</td>
                            <td>${invoice.invoice_number}</td>
                        </tr>
                        <tr>
                            <td>Date:</td>
                            <td>${invoiceDate}</td>
                        </tr>
                        <tr>
                            <td>Due Date:</td>
                            <td>${formattedDueDate}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="client-info">
                <h3>Bill To:</h3>
                <p>${invoice.client}</p>
                ${invoice.project ? `<p>Project: ${invoice.project}</p>` : ''}
            </div>
            
            <div class="invoice-items">
                <h3>Services:</h3>
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Hours</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${timeItems.map(item => `
                            <tr>
                                <td>${new Date(item.date).toLocaleDateString()}</td>
                                <td>${item.description}</td>
                                <td>${item.hours?.toFixed(2) || ''}</td>
                                <td>$${item.rate?.toFixed(2) || ''}</td>
                                <td>$${item.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"></td>
                            <td><strong>Total Hours:</strong></td>
                            <td><strong>${invoice.total_hours.toFixed(2)}</strong></td>
                            <td><strong>$${invoice.total_amount.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                ${expenseItems.length > 0 ? `
                    <h3>Expenses:</h3>
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th colspan="2"></th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expenseItems.map(item => `
                                <tr>
                                    <td>${new Date(item.date).toLocaleDateString()}</td>
                                    <td>${item.description}</td>
                                    <td colspan="2"></td>
                                    <td>$${item.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2"></td>
                                <td colspan="2"><strong>Total Expenses:</strong></td>
                                <td><strong>$${invoice.expenses_amount.toFixed(2)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                ` : ''}
                
                <div class="invoice-summary">
                    <table>
                        <tr>
                            <td>Subtotal:</td>
                            <td>$${invoice.total_amount.toFixed(2)}</td>
                        </tr>
                        ${invoice.expenses_amount > 0 ? `
                            <tr>
                                <td>Expenses:</td>
                                <td>$${invoice.expenses_amount.toFixed(2)}</td>
                            </tr>
                        ` : ''}
                        <tr class="grand-total">
                            <td>Grand Total:</td>
                            <td>$${invoice.grand_total.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div class="invoice-notes">
                <h3>Notes:</h3>
                <p>${invoice.notes || ''}</p>
                <p><strong>Payment Terms:</strong> ${invoice.payment_terms}</p>
                <p>${settings.paymentInstructions || ''}</p>
            </div>
            
            <div class="invoice-footer">
                <p>Thank you for your business!</p>
            </div>
        </div>
    `;
}

// Generate a unique invoice number
function generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `INV-${year}${month}${day}-${random}`;
}

async function addTimeEntry() {
    const dateInput = document.getElementById('date');
    const descriptionInput = document.getElementById('description');
    const clientInput = document.getElementById('client');
    const projectInput = document.getElementById('project');
    const hoursInput = document.getElementById('hours');
    const rateInput = document.getElementById('rate');
    
    // Validate inputs
    if (!dateInput.value || !descriptionInput.value || !hoursInput.value || !rateInput.value) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Get values
    const date = dateInput.value;
    const description = descriptionInput.value;
    const client = clientInput.value;
    const project = projectInput.value;
    const hours = parseFloat(hoursInput.value);
    const rate = parseFloat(rateInput.value);
    const amount = hours * rate;
    
    // Create entry object
    const entry = {
        user_id: currentUser.id,
        date,
        description,
        client,
        project,
        hours,
        rate,
        amount
    };
    
    try {
        // Add to database
        const newEntry = await SupabaseAPI.addTimeEntry(entry);
        
        if (newEntry) {
            // Add to local array
            timeEntries.push(newEntry);
            
            // Update the UI
            updateTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            // Clear form (except rate)
            descriptionInput.value = '';
            hoursInput.value = '';
            clientInput.value = '';
            projectInput.value = '';
            
            // Clear saved form data
            clearSavedFormData();
            
            showNotification('Time entry added successfully!', 'success');
        } else {
            showNotification('Failed to add time entry', 'error');
        }
    } catch (error) {
        console.error('Error adding time entry:', error);
        showNotification('Error adding time entry. Please try again.', 'error');
    }
}

async function updateTimeEntry() {
    const dateInput = document.getElementById('date');
    const descriptionInput = document.getElementById('description');
    const clientInput = document.getElementById('client');
    const projectInput = document.getElementById('project');
    const hoursInput = document.getElementById('hours');
    const rateInput = document.getElementById('rate');
    const editId = document.getElementById('edit-id').value;
    
    // Validate inputs
    if (!dateInput.value || !descriptionInput.value || !hoursInput.value || !rateInput.value) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Get values
    const date = dateInput.value;
    const description = descriptionInput.value;
    const client = clientInput.value;
    const project = projectInput.value;
    const hours = parseFloat(hoursInput.value);
    const rate = parseFloat(rateInput.value);
    const amount = hours * rate;
    
    // Create entry object
    const entry = {
        id: editId,
        date,
        description,
        client,
        project,
        hours,
        rate,
        amount
    };
    
    try {
        // Update in database
        const updatedEntry = await SupabaseAPI.updateTimeEntry(entry);
        
        if (updatedEntry) {
            // Update in local array
            const entryIndex = timeEntries.findIndex(e => e.id === editId);
            if (entryIndex !== -1) {
                timeEntries[entryIndex] = updatedEntry;
            }
            
            // Update the UI
            updateTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            // Reset the form (cancelEdit also clears saved form data)
            cancelEdit();
            
            showNotification('Time entry updated successfully!', 'success');
        } else {
            showNotification('Failed to update time entry', 'error');
        }
    } catch (error) {
        console.error('Error updating time entry:', error);
        showNotification('Error updating time entry. Please try again.', 'error');
    }
}

function cancelEdit() {
    // Clear form
    document.getElementById('description').value = '';
    document.getElementById('hours').value = '';
    document.getElementById('client').value = '';
    document.getElementById('project').value = '';
    document.getElementById('edit-id').value = '';
    
    // Reset date to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Show add button and hide update buttons
    document.getElementById('add-entry').style.display = 'inline-block';
    document.getElementById('update-entry').style.display = 'none';
    document.getElementById('cancel-edit').style.display = 'none';
    
    // Reset form title
    document.getElementById('form-title').textContent = 'Record Time';
    
    // Clear saved form data
    clearSavedFormData();
}

async function clearSavedFormData() {
    if (!currentUser) return;
    
    try {
        // Remove from localStorage
        localStorage.removeItem(`formData_${currentUser.id}`);
        
        // Remove from database by setting to null
        await SupabaseAPI.saveFormDataToDatabase(currentUser.id, null);
    } catch (err) {
        console.error('Error clearing saved form data:', err);
    }
}

async function deleteEntry(id) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this entry?')) {
        return;
    }
    
    try {
        // Delete from database
        const success = await SupabaseAPI.deleteTimeEntry(id);
        
        if (success) {
            // Remove from local array
            timeEntries = timeEntries.filter(entry => entry.id !== id);
            
            // Update the UI
            updateTable();
            updateSummary();
            updateClientProjectDropdowns();
            
            showNotification('Time entry deleted successfully!', 'success');
        } else {
            showNotification('Failed to delete time entry', 'error');
        }
    } catch (error) {
        console.error('Error deleting time entry:', error);
        showNotification('Error deleting time entry. Please try again.', 'error');
    }
}

function updateTable() {
    const tableBody = document.getElementById('entries-body');
    tableBody.innerHTML = '';
    
    // Sort entries by date (newest first)
    const sortedEntries = [...timeEntries].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    sortedEntries.forEach(entry => {
        const row = document.createElement('tr');
        
        const formatDate = new Date(entry.date).toLocaleDateString();
        
        row.innerHTML = `
            <td>${formatDate}</td>
            <td>${entry.description}</td>
            <td>${entry.client || ''}</td>
            <td>${entry.project || ''}</td>
            <td>${entry.hours.toFixed(2)}</td>
            <td>$${entry.rate.toFixed(2)}</td>
            <td>$${entry.amount.toFixed(2)}</td>
            <td>
                <button class="edit-btn blue-btn" data-id="${entry.id}" style="margin-right: 5px; padding: 5px 10px;">Edit</button>
                <button class="delete-btn" data-id="${entry.id}" style="padding: 5px 10px;">Delete</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add delete and edit event listeners
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            deleteEntry(id);
        });
    });
    
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            editEntry(id);
        });
    });
}

function updateSummary() {
    const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = timeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    document.getElementById('total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('total-amount').textContent = totalAmount.toFixed(2);
}

function editEntry(id) {
    const entry = timeEntries.find(entry => entry.id === id);
    
    if (!entry) return;
    
    // Populate the form with entry data
    document.getElementById('date').value = entry.date;
    document.getElementById('description').value = entry.description;
    document.getElementById('client').value = entry.client || '';
    document.getElementById('project').value = entry.project || '';
    document.getElementById('hours').value = entry.hours;
    document.getElementById('rate').value = entry.rate;
    document.getElementById('edit-id').value = entry.id;
    
    // Show update buttons and hide add button
    document.getElementById('add-entry').style.display = 'none';
    document.getElementById('update-entry').style.display = 'inline-block';
    document.getElementById('cancel-edit').style.display = 'inline-block';
    
    // Change form title
    document.getElementById('form-title').textContent = 'Edit Time Entry';
    
    // Scroll to the form
    document.querySelector('.time-entry').scrollIntoView({ behavior: 'smooth' });
}

// Function to update client and project dropdowns
function updateClientProjectDropdowns() {
    try {
        // Get unique clients
        const clients = [...new Set(timeEntries.map(entry => entry.client).filter(Boolean))];
        
        // Get unique projects
        const projects = [...new Set(timeEntries.map(entry => entry.project).filter(Boolean))];
        
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
        
        // Populate datalists for client and project inputs
        const clientsList = document.getElementById('clients-list');
        const projectsList = document.getElementById('projects-list');
        
        if (clientsList) {
            clientsList.innerHTML = '';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client;
                clientsList.appendChild(option);
            });
        }
        
        if (projectsList) {
            projectsList.innerHTML = '';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project;
                projectsList.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error populating dropdowns:', err);
    }
}

// Show the database setup modal and run checks
async function showDatabaseSetupModal() {
    // Show the results container
    const setupResults = document.getElementById('setup-results');
    setupResults.style.display = 'block';
    setupResults.innerHTML = 'Running database setup checks...\n\n';
    
    try {
        // Run the setup checks
        const result = await runSetupChecks();
        
        // Display results
        setupResults.innerHTML += '---- Setup Check Results ----\n\n';
        setupResults.innerHTML += `Connection to Supabase: ${result.results.connection ? '✅ Good' : '❌ Failed'}\n\n`;
        setupResults.innerHTML += 'Required tables:\n';
        
        for (const [table, exists] of Object.entries(result.results.tables)) {
            setupResults.innerHTML += `   ${table}: ${exists ? '✅ Exists' : '❌ Missing'}\n`;
        }
        
        setupResults.innerHTML += `\nAuth System: ${result.results.auth ? '✅ Working' : '❌ Issues'}\n\n`;
        setupResults.innerHTML += `Overall Setup: ${result.success ? '✅ READY TO USE' : '❌ NEEDS ATTENTION'}\n\n`;
        
        // If setup is not complete, show instructions
        if (!result.success) {
            setupResults.innerHTML += 'To complete the setup:\n\n';
            
            if (!result.results.connection) {
                setupResults.innerHTML += '1. Verify your Supabase URL and API key in supabase.js\n';
                setupResults.innerHTML += '2. Make sure your Supabase project is active\n\n';
            }
            
            let missingTables = Object.entries(result.results.tables)
                .filter(([_, exists]) => !exists)
                .map(([table]) => table);
                
            if (missingTables.length > 0) {
                setupResults.innerHTML += '3. Run the SQL setup script to create missing tables:\n';
                setupResults.innerHTML += '   - Go to your Supabase project dashboard\n';
                setupResults.innerHTML += '   - Open the SQL Editor\n';
                setupResults.innerHTML += '   - Copy and paste the schema.sql file content\n';
                setupResults.innerHTML += '   - Click "Run" to execute the SQL\n\n';
            }
            
            if (!result.results.auth) {
                setupResults.innerHTML += '4. Check Auth settings in your Supabase project:\n';
                setupResults.innerHTML += '   - Make sure Email Auth is enabled\n';
                setupResults.innerHTML += '   - Verify that row-level security policies are set up correctly\n\n';
            }
        } else {
            setupResults.innerHTML += 'Your database is correctly set up! You can now use the application.\n';
        }
    } catch (error) {
        console.error('Error running setup checks:', error);
        setupResults.innerHTML += 'An error occurred while checking the setup:\n';
        setupResults.innerHTML += error.message || 'Unknown error';
    }
}

// Add the openTab function for tab navigation
function openTab(e, tabName) {
    // Hide all tab content
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
    }
    
    // Remove active class from all tab buttons
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    // Show the selected tab content and add active class to the button
    document.getElementById(tabName).style.display = 'block';
    e.currentTarget.classList.add('active');
    
    // Initialize dashboard if it's the dashboard tab
    if (tabName === 'dashboard-tab') {
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        } else {
            console.warn('updateDashboard function not found');
        }
    }
}

// Helper function to get date range from option
function getDateRangeFromOption(option, fromDate, toDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const from = new Date(today);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    
    switch (option) {
        case 'today':
            // from and to are already set to today
            break;
        case 'yesterday':
            from.setDate(from.getDate() - 1);
            to.setDate(to.getDate() - 1);
            break;
        case 'this-week':
            from.setDate(from.getDate() - from.getDay()); // Start of week (Sunday)
            break;
        case 'last-week':
            from.setDate(from.getDate() - from.getDay() - 7); // Start of last week
            to.setDate(to.getDate() - to.getDay() - 1); // End of last week
            break;
        case 'this-month':
            from.setDate(1); // First day of current month
            break;
       case 'last-month':
            from.setMonth(from.getMonth() - 1, 1); // First day of last month
            to.setDate(0); // Last day of last month
            break;
        case 'this-year':
            from.setMonth(0, 1); // January 1st of current year
            break;
        case 'custom':
            // Use the provided custom date range
            if (fromDate && toDate) {
                from.setTime(new Date(fromDate).getTime());
                to.setTime(new Date(toDate).getTime());
                to.setHours(23, 59, 59, 999);
            }
            break;
        default: // 'all'
            from.setFullYear(2000, 0, 1); // Far in the past
            to.setFullYear(2099, 11, 31); // Far in the future
    }
    
    return { from, to };
}

// Export global state and functions to window object for module access
window.timeEntries = timeEntries;
window.expenses = expenses;
window.settings = settings;
window.currentUser = currentUser;
window.showNotification = showNotification;
window.updateDashboard = typeof updateDashboard === 'function' ? updateDashboard : null;
