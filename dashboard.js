// dashboard.js - Dashboard functionality (FINAL - Accepts state/deps)

// Keep track of chart instances locally
let chartInstances = {
    hours: null, revenue: null, client: null,
    project: null, weekday: null, monthly: null
};

// --- Helper functions ---
function addDashboardListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Dashboard listener warning: Element ID "${id}" not found.`);
    }
}

// Helper to get input value
function getInputValue(id) {
    try {
        const element = document.getElementById(id);
        return element ? element.value : '';
    } catch (error) {
        console.warn(`Error getting value from element ${id}:`, error);
        return '';
    }
}

// Simple notification function
function showNotification(message, type = 'info') {
    console.log(`[DASHBOARD-${type.toUpperCase()}]: ${message}`);
    
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after a delay
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 3500);
}

// --- Initialization ---
export function initDashboard(appState, dependencies) {
    console.log("Initializing dashboard module...");
    
    return new Promise((resolve, reject) => {
        try {
            // Check if dashboard tab exists and is accessible
            const dashboardTab = document.getElementById('dashboard-tab');
            if (!dashboardTab) {
                const error = new Error("Dashboard tab not found in DOM. Skipping initialization.");
                console.warn(error.message);
                reject(error);
                return;
            }
            
            // Function to complete initialization
            const completeInitialization = () => {
                try {
                    console.log("Setting up dashboard listeners...");
                    setupDashboardListeners(appState, dependencies);
                    
                    // Initial update
                    console.log("Performing initial dashboard update...");
                    handleDashDateRangeChange(appState, dependencies);
                    updateDashboard(appState, dependencies);
                    
                    console.log("Dashboard initialization completed successfully");
                    resolve();
                } catch (initError) {
                    console.error("Error during dashboard initialization:", initError);
                    reject(initError);
                }
            };
            
            // Ensure all dashboard elements exist before adding listeners
            if (!elementsExist(['refresh-dashboard', 'dash-date-range', 'dash-client', 'dash-project'])) {
                console.warn("Dashboard elements not found. Dashboard may not be fully loaded.");
                
                // Try again after a short delay to ensure DOM is ready
                const retryTimeout = setTimeout(() => {
                    if (elementsExist(['refresh-dashboard', 'dash-date-range', 'dash-client', 'dash-project'])) {
                        console.log("Dashboard elements now available after delay.");
                        completeInitialization();
                    } else {
                        const error = new Error("Dashboard elements still not available after delay.");
                        console.error(error.message);
                        reject(error);
                    }
                }, 1000); // Longer delay to ensure elements are loaded
                
                // Add safety timeout clear in case the promise is resolved/rejected elsewhere
                setTimeout(() => clearTimeout(retryTimeout), 5000);
            } else {
                // Elements exist, complete initialization immediately
                completeInitialization();
            }
        } catch (error) {
            console.error("Critical error during dashboard initialization:", error);
            reject(error);
        }
    });
}

// Helper to check if elements exist
function elementsExist(elementIds) {
    return elementIds.every(id => document.getElementById(id) !== null);
}

// Setup dashboard listeners
function setupDashboardListeners(appState, dependencies) {
    addDashboardListener('refresh-dashboard', 'click', () => {
        console.log("Dashboard refresh requested...");
        updateDashboard(appState, dependencies);
    });
    
    addDashboardListener('dash-date-range', 'change', () => handleDashDateRangeChange(appState, dependencies));
    addDashboardListener('dash-client', 'change', () => updateDashboard(appState, dependencies));
    addDashboardListener('dash-project', 'change', () => updateDashboard(appState, dependencies));
    
    // Custom date range inputs
    addDashboardListener('dash-date-from', 'change', () => updateDashboard(appState, dependencies));
    addDashboardListener('dash-date-to', 'change', () => updateDashboard(appState, dependencies));
}

function handleDashDateRangeChange(appState, dependencies) {
    const dateRangeSelect = document.getElementById('dash-date-range');
    const customDateContainer = document.getElementById('dash-custom-date-range');
    if (dateRangeSelect && customDateContainer) {
        customDateContainer.style.display = dateRangeSelect.value === 'custom' ? 'flex' : 'none';
    }
}

// --- Core Update Function ---
export function updateDashboard(appState, dependencies) {
    const Chart = dependencies?.Chart;
    const showNotification = dependencies?.showNotification || console.error;
    const formatCurrency = dependencies?.formatCurrency || ((amount, currency) => `$${(amount ?? 0).toFixed(2)}`);
    const formatDate = dependencies?.formatDate || ((d) => d); // Basic fallback
    // Get dependencies with fallbacks
    let getDateRangeFromOption = dependencies?.getDateRangeFromOption;
    
    if (!Chart) {
        console.error("Chart.js library not available");
        showNotification("Chart.js library not available. Charts can't be displayed.", "error");
        // Continue execution to at least update the statistics
    }
    
    // Define a fallback getDateRangeFromOption if not provided
    if (!getDateRangeFromOption) {
        console.warn("Date range helper not provided, using simple implementation");
        getDateRangeFromOption = function(option, fromDate, toDate) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
            
            let from = null;
            let to = null;
            
            switch (option) {
                case 'today':
                    from = today;
                    to = new Date(today);
                    to.setDate(to.getDate() + 1);
                    break;
                case 'this-week':
                    from = new Date(today);
                    from.setDate(from.getDate() - from.getDay()); // Start of week (Sunday)
                    to = new Date(from);
                    to.setDate(to.getDate() + 7);
                    break;
                case 'this-month':
                    from = new Date(today.getFullYear(), today.getMonth(), 1);
                    to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    break;
                case 'last-month':
                    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    to = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;
                case 'this-year':
                    from = new Date(today.getFullYear(), 0, 1);
                    to = new Date(today.getFullYear(), 11, 31);
                    break;
                case 'custom':
                    if (fromDate) from = new Date(fromDate);
                    if (toDate) to = new Date(toDate);
                    break;
                case 'all':
                default:
                    // No date filtering
                    break;
            }
            
            return { startDate: from, endDate: to };
        };
    }

    console.log("Updating dashboard...");
    try {
        const entries = appState?.entries || [];
        const expenses = appState?.expenses || [];
        const settings = appState?.settings || {};

        // Get dashboard filter values
        const dateRange = getInputValue('dash-date-range');
        const client = getInputValue('dash-client');
        const project = getInputValue('dash-project');
        const customFrom = getInputValue('dash-date-from');
        const customTo = getInputValue('dash-date-to');

        // Get date range
        const dateRangeResult = getDateRangeFromOption(dateRange, customFrom, customTo);
        
        // Handle different return structures (backward compatibility)
        let startDate, endDate;
        if (dateRangeResult.from !== undefined && dateRangeResult.to !== undefined) {
            startDate = dateRangeResult.from;
            endDate = dateRangeResult.to;
        } else if (dateRangeResult.startDate !== undefined && dateRangeResult.endDate !== undefined) {
            startDate = dateRangeResult.startDate;
            endDate = dateRangeResult.endDate;
        } else {
            console.log("Date range function returned unexpected format, using defaults");
            startDate = null;
            endDate = null;
        }

        // Filter data
        let filteredEntries = [...entries];
        let filteredExpenses = [...expenses];
        
        // Filter by client if not "all"
        if (client && client !== 'all') {
            filteredEntries = filteredEntries.filter(entry => entry.client === client);
            filteredExpenses = filteredExpenses.filter(expense => expense.client === client);
        }
        
        // Filter by project if not "all"
        if (project && project !== 'all') {
            filteredEntries = filteredEntries.filter(entry => entry.project === project);
            filteredExpenses = filteredExpenses.filter(expense => expense.project === project);
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

        if (filteredEntries.length === 0 && filteredExpenses.length === 0 && dateRange !== 'all') {
            console.log("Dashboard: No data found for selected filters.");
             showNoDataMessage(Chart); // Show message on charts
            updateDashboardStats([], [], startDate, endDate, settings, formatCurrency); // Update stats to zero
            // Optionally show a message elsewhere: showNotification("No data for selected period.", "info");
            return;
        } else if (entries.length === 0 && expenses.length === 0) {
             console.log("Dashboard: No data available at all.");
             showNoDataMessage(Chart);
             updateDashboardStats([], [], startDate, endDate, settings, formatCurrency);
             return;
        }


        // Update UI components
        updateDashboardStats(filteredEntries, filteredExpenses, startDate, endDate, settings, formatCurrency);
        updateDashboardCharts(filteredEntries, filteredExpenses, startDate, endDate, Chart, settings, formatCurrency, formatDate);

    } catch (err) {
        console.error('Error updating dashboard:', err);
        showNotification('Error updating dashboard', 'error');
        showNoDataMessage(Chart); // Show no data on error
    }
}

// --- Update Stats ---
function updateDashboardStats(entries, expenses, startDate, endDate, settings, formatCurrency) {
    const totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const totalRevenue = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const netIncome = totalRevenue - totalExpenses;
    let avgWeeklyHours = 0; 
    let avgWeeklyRevenue = 0;
    let daysDiff = 1;
    
    // Handle case when startDate or endDate might be null
    if (startDate && endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        daysDiff = timeDiff >= 0 ? Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24))) : 1; // Ensure at least 1 day
    }
    
    const weeksCount = Math.max(1, daysDiff / 7);
    avgWeeklyHours = totalHours / weeksCount; 
    avgWeeklyRevenue = totalRevenue / weeksCount;
    const avgRate = totalHours > 0 ? totalRevenue / totalHours : 0;
    const trackedDays = new Set(entries.map(entry => entry.date)).size;

    setTextContent('dash-total-hours', totalHours.toFixed(2));
    setTextContent('dash-total-revenue', formatCurrency(totalRevenue, settings.currency));
    setTextContent('dash-avg-hours', avgWeeklyHours.toFixed(2));
    setTextContent('dash-avg-revenue', formatCurrency(avgWeeklyRevenue, settings.currency));
    setTextContent('dash-avg-rate', formatCurrency(avgRate, settings.currency));
    setTextContent('dash-total-expenses', formatCurrency(totalExpenses, settings.currency));
    setTextContent('dash-net-income', formatCurrency(netIncome, settings.currency));
    setTextContent('dash-days-tracked', trackedDays);
}

// --- Update Charts ---
function updateDashboardCharts(entries, expenses, startDate, endDate, Chart, settings, formatCurrency, formatDate) {
    if (!Chart) {
        console.error("Chart.js library not available for rendering charts");
        showNoDataMessage(Chart);
        return;
    }
    
    try {
        const dailyData = getDailyChartData(entries, startDate, endDate, formatDate);
        const clientData = getClientChartData(entries);
        const projectData = getProjectChartData(entries);
        const weekdayData = getWeekdayChartData(entries);
        const monthlyData = getMonthlyChartData(entries, formatDate);

        updateChart('hours', ctx => createBarChart(ctx, Chart, dailyData.dates, 'Hours', dailyData.hours, 'rgba(53, 162, 235, 0.5)', 'rgba(53, 162, 235, 1)', 'Hours'));
        updateChart('revenue', ctx => createBarChart(ctx, Chart, dailyData.dates, 'Revenue', dailyData.revenue, 'rgba(75, 192, 192, 0.5)', 'rgba(75, 192, 192, 1)', `Revenue (${formatCurrency(0, settings.currency).replace(/[\d.,\s]/g, '')})`));
        updateChart('client', ctx => createPieChart(ctx, Chart, clientData.clients, 'Revenue', clientData.revenue, settings, formatCurrency));
        updateChart('project', ctx => createDoughnutChart(ctx, Chart, projectData.projects, 'Hours', projectData.hours));
        updateChart('weekday', ctx => createBarChart(ctx, Chart, weekdayData.weekdays, 'Hours', weekdayData.hours, 'rgba(153, 102, 255, 0.5)', 'rgba(153, 102, 255, 1)', 'Hours'));
        updateChart('monthly', ctx => createMonthlyChart(ctx, Chart, monthlyData, settings, formatCurrency));
    } catch (err) {
        console.error("Error creating dashboard charts:", err);
        showNoDataMessage(Chart);
    }
}

// --- Chart Data Processing ---
function getDailyChartData(entries, startDate, endDate, formatDate) {
    console.log("Getting daily chart data for", entries.length, "entries");
    
    // Default to last 30 days if no date range specified
    if (!startDate) {
        const today = new Date();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
    }
    
    if (!endDate) {
        endDate = new Date();
    }
    
    // Get all dates in the range
    const dates = [];
    const hours = [];
    const revenue = [];
    
    // Fill with zeros for all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dates.push(formatDate ? formatDate(dateStr) : dateStr);
        hours.push(0);
        revenue.push(0);
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Sum hours and revenue for each day
    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        
        // Skip entries outside the range
        if (entryDate < startDate || entryDate > endDate) return;
        
        // Format date to match our array index
        const dateStr = entryDate.toISOString().split('T')[0];
        const formattedDate = formatDate ? formatDate(dateStr) : dateStr;
        
        // Find index in our arrays
        const index = dates.indexOf(formattedDate);
        if (index !== -1) {
            hours[index] += Number(entry.hours || 0);
            revenue[index] += Number(entry.amount || 0);
        }
    });
    
    return { dates, hours, revenue };
}

function getClientChartData(entries) {
    console.log("Getting client chart data for", entries.length, "entries");
    
    // Group by client
    const clientMap = {};
    
    entries.forEach(entry => {
        const client = entry.client || 'Unassigned';
        
        if (!clientMap[client]) {
            clientMap[client] = { hours: 0, revenue: 0 };
        }
        
        clientMap[client].hours += Number(entry.hours || 0);
        clientMap[client].revenue += Number(entry.amount || 0);
    });
    
    // Extract data for charts
    const clients = Object.keys(clientMap);
    const hours = clients.map(client => clientMap[client].hours);
    const revenue = clients.map(client => clientMap[client].revenue);
    
    return { clients, hours, revenue };
}

function getProjectChartData(entries) {
    console.log("Getting project chart data for", entries.length, "entries");
    
    // Group by project
    const projectMap = {};
    
    entries.forEach(entry => {
        const project = entry.project || 'Unassigned';
        
        if (!projectMap[project]) {
            projectMap[project] = { hours: 0, revenue: 0 };
        }
        
        projectMap[project].hours += Number(entry.hours || 0);
        projectMap[project].revenue += Number(entry.amount || 0);
    });
    
    // Extract data for charts
    const projects = Object.keys(projectMap);
    const hours = projects.map(project => projectMap[project].hours);
    const revenue = projects.map(project => projectMap[project].revenue);
    
    return { projects, hours, revenue };
}

function getWeekdayChartData(entries) {
    console.log("Getting weekday chart data for", entries.length, "entries");
    
    // Initialize weekday data
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hours = [0, 0, 0, 0, 0, 0, 0];
    const revenue = [0, 0, 0, 0, 0, 0, 0];
    
    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        const weekdayIndex = entryDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        hours[weekdayIndex] += Number(entry.hours || 0);
        revenue[weekdayIndex] += Number(entry.amount || 0);
    });
    
    return { weekdays, hours, revenue };
}

function getMonthlyChartData(entries, formatDate) {
    console.log("Getting monthly chart data for", entries.length, "entries");
    
    // Group by month
    const monthMap = {};
    
    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`;
        
        if (!monthMap[monthKey]) {
            monthMap[monthKey] = { 
                hours: 0, 
                revenue: 0,
                // For sorting
                year: entryDate.getFullYear(),
                month: entryDate.getMonth() + 1
            };
        }
        
        monthMap[monthKey].hours += Number(entry.hours || 0);
        monthMap[monthKey].revenue += Number(entry.amount || 0);
    });
    
    // Sort by date
    const sortedMonths = Object.keys(monthMap).sort((a, b) => {
        const aData = monthMap[a];
        const bData = monthMap[b];
        
        if (aData.year !== bData.year) {
            return aData.year - bData.year;
        }
        
        return aData.month - bData.month;
    });
    
    // Format month labels
    const months = sortedMonths.map(key => {
        const data = monthMap[key];
        const date = new Date(data.year, data.month - 1, 1);
        
        // Format: "Jan 2023"
        return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    });
    
    const hours = sortedMonths.map(key => monthMap[key].hours);
    const revenue = sortedMonths.map(key => monthMap[key].revenue);
    
    return { months, hours, revenue };
}

// --- Chart Rendering Helpers ---
const CHART_COLORS = [ /* ... same ... */ ];
const CHART_BORDER_COLORS = CHART_COLORS.map(c => c.replace('0.6', '1'));

function updateChart(chartKey, createChartFn) {
    try {
        // Get the canvas element
        const canvas = document.getElementById(`${chartKey}-chart`);
        if (!canvas) { 
            console.warn(`Canvas not found for chart: ${chartKey}`); 
            return; 
        }
        
        // Make sure Canvas API is available
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn(`Unable to get 2D context for chart: ${chartKey}`);
            return;
        }
        
        // Clean up any existing chart instance
        if (chartInstances[chartKey]) { 
            try {
                chartInstances[chartKey].destroy(); 
            } catch (destroyError) {
                console.warn(`Error destroying previous chart instance: ${chartKey}`, destroyError);
            }
            chartInstances[chartKey] = null; 
        }
        
        // Create new chart
        chartInstances[chartKey] = createChartFn(ctx);
        
        // Check if chart creation was successful
        if (!chartInstances[chartKey]) {
            console.warn(`Chart creation function did not return a chart instance: ${chartKey}`);
        }
    } catch (error) { 
        console.error(`Failed to create/update chart "${chartKey}":`, error);
        
        // Attempt to show error on canvas
        try {
            const canvas = document.getElementById(`${chartKey}-chart`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.font = '12px Arial';
                    ctx.fillStyle = '#ff3b30';
                    ctx.textAlign = 'center';
                    ctx.fillText('Error loading chart', canvas.width / 2, canvas.height / 2);
                }
            }
        } catch (e) {
            // Ignore errors in error handling
        }
    }
}
function createBarChart(ctx, Chart, labels, label, data, bgColor, borderColor, yAxisLabel) { /* ... same ... */ }
function createPieChart(ctx, Chart, labels, label, data, settings, formatCurrency) { /* ... same ... */ }
function createDoughnutChart(ctx, Chart, labels, label, data) { /* ... same ... */ }
function createMonthlyChart(ctx, Chart, data, settings, formatCurrency) { /* ... same ... */ }

// --- Tooltip Callbacks ---
function pieTooltipLabel(context, formatCurrency, currencyCode) { /* ... same ... */ }
function doughnutTooltipLabel(context) { /* ... same ... */ }

// --- No Data Message ---
function showNoDataMessage(Chart) {
    // Clear any existing charts
    const chartCanvases = ['hours-chart', 'revenue-chart', 'client-chart', 'project-chart', 'weekday-chart', 'monthly-chart'];
    
    chartCanvases.forEach(canvasId => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Clear out existing chart
        if (chartInstances[canvasId.replace('-chart', '')]) {
            chartInstances[canvasId.replace('-chart', '')].destroy();
            chartInstances[canvasId.replace('-chart', '')] = null;
        }
        
        // If Chart.js is not available, just add a text message
        if (!Chart) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '14px Arial';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText('Chart.js not available', canvas.width / 2, canvas.height / 2);
            }
            return;
        }
        
        // Create a simple "no data" message chart
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            chartInstances[canvasId.replace('-chart', '')] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        label: 'No data available for the selected filters',
                        data: [0],
                        backgroundColor: 'rgba(200, 200, 200, 0.2)',
                        borderColor: 'rgba(200, 200, 200, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error(`Error creating no-data chart for ${canvasId}:`, error);
        }
    });
}

// --- Helper Functions ---
function setTextContent(id, text) { 
    const el = document.getElementById(id); 
    if (el) el.textContent = text ?? ''; 
}

console.log("dashboard.js FINAL refactored loaded.");
