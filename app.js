// App.js - Main application logic
import * as SupabaseAPI from './supabase.js';

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
    // Check for existing session
    currentUser = await SupabaseAPI.getCurrentUser();
    
    if (currentUser) {
        // User is logged in, load their data
        await loadUserData();
        showApp();
    } else {
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

function setupEventListeners() {
    // Auth related listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('show-signup-link').addEventListener('click', toggleAuthForms);
    document.getElementById('show-login-link').addEventListener('click', toggleAuthForms);
    
    // App related listeners
    document.getElementById('add-entry').addEventListener('click', addTimeEntry);
    document.getElementById('update-entry').addEventListener('click', updateTimeEntry);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
    document.getElementById('generate-invoice').addEventListener('click', generateInvoice);
    document.getElementById('print-invoice').addEventListener('click', () => window.print());
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('refresh-dashboard').addEventListener('click', updateDashboard);
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
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
            
            // Reset the form
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