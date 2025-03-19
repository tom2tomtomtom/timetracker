// App.js - Main application logic
import * as SupabaseAPI from './supabase.js';
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
        
        // Update UI elements
        updateTable();
        updateSummary();
        populateClientProjectDropdowns();
        
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
    document.getElementById('check-setup').addEventListener('click', checkDatabaseSetup);
    
    // App related listeners
    document.getElementById('add-entry').addEventListener('click', addTimeEntry);
    document.getElementById('update-entry').addEventListener('click', updateTimeEntry);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
    document.getElementById('generate-invoice').addEventListener('click', generateInvoice);
    document.getElementById('print-invoice').addEventListener('click', () => window.print());
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', importData);
    document.getElementById('refresh-dashboard').addEventListener('click', updateDashboard);
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
    
    // Set up auto-save on form fields
    setupAutoSave();
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

// App Functions
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

async function checkDatabaseSetup() {
    const setupButton = document.getElementById('check-setup');
    const resultsContainer = document.getElementById('setup-results');
    
    // Show loading state
    setupButton.textContent = 'Checking...';
    setupButton.disabled = true;
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '🔍 Running database setup checks...\n\nThis may take a moment. Please wait...';
    
    try {
        // Run the setup checks
        const { success, results, error } = await runSetupChecks();
        
        if (error) {
            resultsContainer.innerHTML = `❌ Error checking database setup: ${error}\n\nPlease check your connection and try again.`;
            return;
        }
        
        // Show detailed results in the UI
        let output = '';
        
        output += `📡 Connection to Supabase: ${results.connection ? "✅ Good" : "❌ Failed"}\n\n`;
        output += `🗃️ Required tables:\n`;
        
        let allTablesExist = true;
        for (const [table, exists] of Object.entries(results.tables)) {
            output += `   ${table}: ${exists ? "✅ Exists" : "❌ Missing"}\n`;
            if (!exists) allTablesExist = false;
        }
        
        output += `\n🔐 Auth System: ${results.auth ? "✅ Working" : "❌ Issues"}\n\n`;
        output += `🏁 Overall Setup: ${success ? "✅ READY TO USE" : "❌ NEEDS ATTENTION"}\n\n`;
        
        if (!success) {
            output += `❗ Setup incomplete. Please follow these steps to fix the issues:\n\n`;
            
            if (!results.connection) {
                output += `1. Verify your Supabase URL and API key in supabase.js\n`;
                output += `2. Check if your Supabase project is running\n\n`;
            }
            
            if (!allTablesExist) {
                output += `3. Run the SQL setup script from schema.sql in the Supabase SQL editor:\n`;
                output += `   a. Log in to your Supabase dashboard\n`;
                output += `   b. Go to the SQL Editor\n`;
                output += `   c. Copy the contents of schema.sql\n`;
                output += `   d. Paste and execute the SQL\n\n`;
            }
            
            if (!results.auth) {
                output += `4. Verify auth settings in your Supabase project\n\n`;
            }
            
            output += `Once completed, click "Check Database Setup" again to verify.`;
        } else {
            output += `✨ Great! Your database setup is complete and ready to use.\n`;
            output += `You can now log in or sign up to start using the application.`;
        }
        
        resultsContainer.innerHTML = output;
        
    } catch (err) {
        console.error('Error in checkDatabaseSetup:', err);
        resultsContainer.innerHTML = `❌ Critical error during setup check: ${err.message}\n\nPlease try again or check the console for details.`;
    } finally {
        // Reset button state
        setupButton.textContent = 'Check Database Setup';
        setupButton.disabled = false;
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    
    // Update settings
    settings.theme = isDark ? 'dark' : 'light';
    
    // Save settings to database if user is logged in
    if (currentUser) {
        SupabaseAPI.saveSettings({
            ...settings,
            user_id: currentUser.id
        });
    }
    
    // Update icon
    document.getElementById('dark-mode-toggle').textContent = isDark ? '☀️' : '🌙';
    
    // Rebuild charts with new theme
    if (document.getElementById('dashboard-tab').style.display === 'block') {
        updateDashboard();
    }
}

function populateClientProjectDropdowns() {
    // Get unique clients and projects
    const clients = [...new Set(timeEntries.map(entry => entry.client).filter(Boolean))];
    const projects = [...new Set(timeEntries.map(entry => entry.project).filter(Boolean))];
    
    // Populate client filter dropdown
    const clientFilter = document.getElementById('filter-client');
    clientFilter.innerHTML = '<option value="all">All Clients</option>';
    
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        clientFilter.appendChild(option);
    });
    
    // Populate project filter dropdown
    const projectFilter = document.getElementById('filter-project');
    projectFilter.innerHTML = '<option value="all">All Projects</option>';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectFilter.appendChild(option);
    });
    
    // Also update datalists for input fields
    const clientsDatalist = document.getElementById('clients-list');
    const projectsDatalist = document.getElementById('projects-list');
    
    clientsDatalist.innerHTML = '';
    projectsDatalist.innerHTML = '';
    
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        clientsDatalist.appendChild(option);
    });
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        projectsDatalist.appendChild(option);
    });
}

function generateInvoice() {
    const clientName = document.getElementById('invoice-client').value;
    const invoiceNumber = document.getElementById('invoice-number').value;
    const invoiceDate = document.getElementById('invoice-date').value;
    const paymentTerms = document.getElementById('payment-terms').value;
    
    if (!clientName || !invoiceNumber || !invoiceDate) {
        showNotification('Please fill in client name, invoice number, and invoice date', 'error');
        return;
    }
    
    const invoicePreview = document.getElementById('invoice-preview');
    const formattedDate = new Date(invoiceDate).toLocaleDateString();
    
    // Filter entries for this client
    const clientEntries = timeEntries.filter(entry => 
        entry.client && entry.client.toLowerCase() === clientName.toLowerCase()
    );
    
    // Calculate totals
    const totalHours = clientEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = clientEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    // Generate invoice HTML
    let invoiceHtml = `
        <div style="text-align: right; margin-bottom: 20px;">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Terms:</strong> ${paymentTerms}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h3>Bill To:</h3>
            <p>${clientName}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Hours</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Rate</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Amount</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add entries to invoice - sort by date
    const sortedEntries = [...clientEntries].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    sortedEntries.forEach(entry => {
        const entryDate = new Date(entry.date).toLocaleDateString();
        invoiceHtml += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${entryDate}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${entry.description}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${entry.hours.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">$${entry.rate.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">$${entry.amount.toFixed(2)}</td>
            </tr>
        `;
    });
    
    // Add totals to invoice
    invoiceHtml += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="border: 1px solid #ddd; padding: 8px;"></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>${totalHours.toFixed(2)}</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Total:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>$${totalAmount.toFixed(2)}</strong></td>
                </tr>
            </tfoot>
        </table>
        
        <div style="margin-top: 40px;">
            <p><strong>Payment Instructions:</strong></p>
            <p>Please make payment within ${paymentTerms} days of the invoice date.</p>
            <p>${settings.paymentInstructions || ''}</p>
        </div>
    `;
    
    invoicePreview.innerHTML = invoiceHtml;
    invoicePreview.style.display = 'block';
    document.getElementById('print-invoice').style.display = 'inline-block';
    document.getElementById('save-invoice-pdf').style.display = 'inline-block';
}

function exportData() {
    // Create data object with all necessary information
    const dataToExport = {
        timeEntries,
        expenses,
        settings,
        version: '1.0',
        exportDate: new Date().toISOString()
    };
    
    // Convert to JSON
    const jsonData = JSON.stringify(dataToExport, null, 2);
    
    // Create blob and download link
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a download link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async function(event) {
        try {
            console.log("File loaded, parsing JSON...");
            const importedData = JSON.parse(event.target.result);
            
            // Log imported data for debugging
            console.log("Imported data:", importedData);
            
            // Validate the data
            if (!importedData.timeEntries || !Array.isArray(importedData.timeEntries)) {
                throw new Error('Invalid data format');
            }
            
            // Ask for confirmation to replace existing data or merge
            const action = confirm('Do you want to replace your existing data or merge with it?\n\nOK = Replace\nCancel = Merge');
            
            console.log("User selected:", action ? "Replace" : "Merge");
            
            if (action) {
                // Replace existing data
                await replaceData(importedData);
            } else {
                // Merge with existing data
                await mergeData(importedData);
            }
            
            // Reload data from the database to ensure UI is up to date
            console.log("Refreshing data from database...");
            timeEntries = await SupabaseAPI.getTimeEntries();
            expenses = await SupabaseAPI.getExpenses();
            
            console.log("Updated time entries:", timeEntries);
            
            // Update the UI
            updateTable();
            updateSummary();
            populateClientProjectDropdowns();
            
            showNotification('Data imported successfully!', 'success');
        } catch (error) {
            console.error('Error importing data:', error);
            showNotification('Error importing data: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
    // Reset the file input
    e.target.value = '';
}

async function replaceData(importedData) {
    if (!currentUser) {
        showNotification('You must be logged in to import data', 'error');
        return;
    }
    
    try {
        console.log("Starting replace operation...");
        
        // Delete existing time entries
        console.log("Deleting existing time entries:", timeEntries.length);
        for (const entry of timeEntries) {
            await SupabaseAPI.deleteTimeEntry(entry.id);
        }
        
        // Delete existing expenses
        console.log("Deleting existing expenses:", expenses.length);
        for (const expense of expenses) {
            await SupabaseAPI.deleteExpense(expense.id);
        }
        
        // Add imported time entries
        console.log("Adding imported time entries:", importedData.timeEntries.length);
        for (const entry of importedData.timeEntries) {
            // Clean up the entry to ensure it works with Supabase
            const cleanEntry = {
                date: entry.date,
                description: entry.description,
                client: entry.client || "",
                project: entry.project || "",
                hours: Number(entry.hours),
                rate: Number(entry.rate),
                amount: Number(entry.hours) * Number(entry.rate),
                user_id: currentUser.id
            };
            
            console.log("Adding entry:", cleanEntry);
            const addedEntry = await SupabaseAPI.addTimeEntry(cleanEntry);
            
            if (addedEntry) {
                console.log("Successfully added entry:", addedEntry);
            } else {
                console.error("Failed to add entry:", cleanEntry);
            }
        }
        
        // Add imported expenses if they exist
        if (importedData.expenses && Array.isArray(importedData.expenses)) {
            console.log("Adding imported expenses:", importedData.expenses.length);
            for (const expense of importedData.expenses) {
                // Clean up the expense to ensure it works with Supabase
                const cleanExpense = {
                    date: expense.date,
                    description: expense.description,
                    amount: Number(expense.amount),
                    client: expense.client || "",
                    project: expense.project || "",
                    user_id: currentUser.id
                };
                
                console.log("Adding expense:", cleanExpense);
                const addedExpense = await SupabaseAPI.addExpense(cleanExpense);
                
                if (addedExpense) {
                    console.log("Successfully added expense:", addedExpense);
                } else {
                    console.error("Failed to add expense:", cleanExpense);
                }
            }
        }
        
        // Update settings if they exist
        if (importedData.settings) {
            console.log("Updating settings with imported data");
            const mergedSettings = {
                ...importedData.settings,
                user_id: currentUser.id
            };
            
            await SupabaseAPI.saveSettings(mergedSettings);
        }
        
        console.log("Replace operation completed successfully");
    } catch (error) {
        console.error('Error replacing data:', error);
        throw new Error('Failed to replace data. ' + error.message);
    }
}

async function mergeData(importedData) {
    if (!currentUser) {
        showNotification('You must be logged in to import data', 'error');
        return;
    }
    
    try {
        console.log("Starting merge operation...");
        
        // Add imported time entries
        console.log("Processing imported time entries:", importedData.timeEntries.length);
        for (const entry of importedData.timeEntries) {
            // Check if entry already exists (by date, description, hours)
            const existsInCurrentData = timeEntries.some(e => 
                e.date === entry.date && 
                e.description === entry.description && 
                Number(e.hours) === Number(entry.hours)
            );
            
            if (!existsInCurrentData) {
                console.log("Entry doesn't exist, adding:", entry);
                
                // Clean up the entry to ensure it works with Supabase
                const cleanEntry = {
                    date: entry.date,
                    description: entry.description,
                    client: entry.client || "",
                    project: entry.project || "",
                    hours: Number(entry.hours),
                    rate: Number(entry.rate),
                    amount: Number(entry.hours) * Number(entry.rate),
                    user_id: currentUser.id
                };
                
                console.log("Adding entry:", cleanEntry);
                const addedEntry = await SupabaseAPI.addTimeEntry(cleanEntry);
                
                if (addedEntry) {
                    console.log("Successfully added entry:", addedEntry);
                } else {
                    console.error("Failed to add entry:", cleanEntry);
                }
            } else {
                console.log("Entry already exists, skipping:", entry);
            }
        }
        
        // Add imported expenses if they exist
        if (importedData.expenses && Array.isArray(importedData.expenses)) {
            console.log("Processing imported expenses:", importedData.expenses.length);
            for (const expense of importedData.expenses) {
                // Check if expense already exists
                const existsInCurrentData = expenses.some(e => 
                    e.date === expense.date && 
                    e.description === expense.description && 
                    Number(e.amount) === Number(expense.amount)
                );
                
                if (!existsInCurrentData) {
                    console.log("Expense doesn't exist, adding:", expense);
                    
                    // Clean up the expense to ensure it works with Supabase
                    const cleanExpense = {
                        date: expense.date,
                        description: expense.description,
                        amount: Number(expense.amount),
                        client: expense.client || "",
                        project: expense.project || "",
                        user_id: currentUser.id
                    };
                    
                    console.log("Adding expense:", cleanExpense);
                    const addedExpense = await SupabaseAPI.addExpense(cleanExpense);
                    
                    if (addedExpense) {
                        console.log("Successfully added expense:", addedExpense);
                    } else {
                        console.error("Failed to add expense:", cleanExpense);
                    }
                } else {
                    console.log("Expense already exists, skipping:", expense);
                }
            }
        }
        
        // Merge settings if they exist
        if (importedData.settings) {
            console.log("Merging settings with imported data");
            const mergedSettings = {
                ...settings,
                ...importedData.settings,
                user_id: currentUser.id
            };
            
            settings = mergedSettings;
            await SupabaseAPI.saveSettings(settings);
        }
        
        console.log("Merge operation completed successfully");
    } catch (error) {
        console.error('Error merging data:', error);
        throw new Error('Failed to merge data. ' + error.message);
    }
}

// Tab functionality
function openTab(evt, tabName) {
    // Hide all tab content
    const tabContent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContent.length; i++) {
        tabContent[i].style.display = "none";
    }
    
    // Remove active class from all tab buttons
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].className = tabButtons[i].className.replace(" active", "");
    }
    
    // Show the current tab and add active class to the button
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    
    // Initialize dashboard if it's the dashboard tab
    if (tabName === 'dashboard-tab') {
        updateDashboard();
    }
}

function updateDashboard() {
    // Update statistics
    const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalRevenue = timeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    
    document.getElementById('dash-total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('dash-total-revenue').textContent = '$' + totalRevenue.toFixed(2);
    
    // Process data for charts
    const weeklyData = getWeeklyData();
    const monthlyData = getMonthlyData();
    
    // Calculate averages
    let avgWeeklyHours = 0;
    let avgWeeklyRevenue = 0;
    
    if (weeklyData.weeks.length > 0) {
        avgWeeklyHours = weeklyData.hours.reduce((a, b) => a + b, 0) / weeklyData.weeks.length;
        avgWeeklyRevenue = weeklyData.revenue.reduce((a, b) => a + b, 0) / weeklyData.weeks.length;
    }
    
    document.getElementById('dash-avg-hours').textContent = avgWeeklyHours.toFixed(2);
    document.getElementById('dash-avg-revenue').textContent = '$' + avgWeeklyRevenue.toFixed(2);
    
    // Update charts
    updateHoursChart(weeklyData);
    updateRevenueChart(weeklyData);
    updateMonthlyChart(monthlyData);
}

// Chart functions
function getWeeklyData() {
    // Sort entries by date
    const sortedEntries = [...timeEntries].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    if (sortedEntries.length === 0) {
        return { weeks: [], hours: [], revenue: [] };
    }
    
    // Group entries by week
    const weeklyData = {};
    
    sortedEntries.forEach(entry => {
        const date = new Date(entry.date);
        // Get the monday of this week as a key
        date.setDate(date.getDate() - date.getDay() + 1);
        const weekKey = date.toISOString().slice(0, 10);
        
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = { hours: 0, revenue: 0 };
        }
        
        weeklyData[weekKey].hours += entry.hours;
        weeklyData[weekKey].revenue += entry.amount;
    });
    
    // Convert to arrays for Chart.js
    const weeks = Object.keys(weeklyData);
    const hours = weeks.map(week => weeklyData[week].hours);
    const revenue = weeks.map(week => weeklyData[week].revenue);
    
    // Format week labels to be more readable
    const formattedWeeks = weeks.map(week => {
        const date = new Date(week);
        return `${date.toLocaleDateString(undefined, { month: 'short' })} ${date.getDate()}`;
    });
    
    return {
        weeks: formattedWeeks,
        hours,
        revenue
    };
}

function getMonthlyData() {
    // Sort entries by date
    const sortedEntries = [...timeEntries].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    if (sortedEntries.length === 0) {
        return { months: [], hours: [], revenue: [] };
    }
    
    // Group entries by month
    const monthlyData = {};
    
    sortedEntries.forEach(entry => {
        const date = new Date(entry.date);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { hours: 0, revenue: 0 };
        }
        
        monthlyData[monthKey].hours += entry.hours;
        monthlyData[monthKey].revenue += entry.amount;
    });
    
    // Convert to arrays for Chart.js
    const months = Object.keys(monthlyData);
    const hours = months.map(month => monthlyData[month].hours);
    const revenue = months.map(month => monthlyData[month].revenue);
    
    // Format month labels to be more readable
    const formattedMonths = months.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    });
    
    return {
        months: formattedMonths,
        hours,
        revenue
    };
}

let hoursChart, revenueChart, monthlyChart;

function updateHoursChart(data) {
    const ctx = document.getElementById('hours-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (hoursChart) {
        hoursChart.destroy();
    }
    
    hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.weeks,
            datasets: [{
                label: 'Hours per Week',
                data: data.hours,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                }
            }
        }
    });
}

function updateRevenueChart(data) {
    const ctx = document.getElementById('revenue-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.weeks,
            datasets: [{
                label: 'Revenue per Week ($)',
                data: data.revenue,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue ($)'
                    }
                }
            }
        }
    });
}

function updateMonthlyChart(data) {
    const ctx = document.getElementById('monthly-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.months,
            datasets: [
                {
                    label: 'Hours',
                    data: data.hours,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Revenue ($)',
                    data: data.revenue,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Revenue ($)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}