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
    document.getElementById('generate-invoice').addEventListener('click', generateInvoice);
    document.getElementById('print-invoice').addEventListener('click', () => window.print());
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', importData);
    document.getElementById('refresh-dashboard').addEventListener('click', updateDashboard);
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
    
    // Tab navigation listeners - simplified direct approach
    document.querySelector('[data-tab="time-tracking-tab"]').addEventListener('click', e => openTab(e, 'time-tracking-tab'));
    document.querySelector('[data-tab="dashboard-tab"]').addEventListener('click', e => openTab(e, 'dashboard-tab'));
    document.querySelector('[data-tab="invoice-tab"]').addEventListener('click', e => openTab(e, 'invoice-tab'));
    document.querySelector('[data-tab="reports-tab"]').addEventListener('click', e => openTab(e, 'reports-tab'));
    document.querySelector('[data-tab="settings-tab"]').addEventListener('click', e => openTab(e, 'settings-tab'));
    
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
