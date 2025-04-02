// dashboard.js - Dashboard functionality (Refactored to accept state/deps)

// Keep track of chart instances locally
let chartInstances = {
    hours: null,
    revenue: null,
    client: null,
    project: null,
    weekday: null,
    monthly: null
};

// --- Initialization ---

export function initDashboard(appState, dependencies) {
    console.log("Initializing dashboard module...");
    addListener('refresh-dashboard', 'click', () => {
        // Refresh needs appState and dependencies too
        console.log("Dashboard refresh requested...");
        updateDashboard(appState, dependencies);
    });
    addListener('dash-date-range', 'change', handleDashDateRangeChange);

    // Apply initial filter visibility based on default select value
    handleDashDateRangeChange();

    // Optionally perform initial update if data might already be in appState
    // updateDashboard(appState, dependencies);
}

function handleDashDateRangeChange() {
    const dateRangeSelect = document.getElementById('dash-date-range');
    const customDateContainer = document.getElementById('dash-custom-date-range');
    if (dateRangeSelect && customDateContainer) {
        customDateContainer.style.display = dateRangeSelect.value === 'custom' ? 'flex' : 'none'; // Use flex
    }
}

// --- Core Update Function ---

export function updateDashboard(appState, dependencies) {
    // Extract dependencies with fallbacks
    const Chart = dependencies?.Chart;
    const showNotification = dependencies?.showNotification || console.error; // Use console.error as fallback for notify
    const formatCurrency = dependencies?.formatCurrency || ((amount, currency) => `$${(amount ?? 0).toFixed(2)}`);
    const getDateRangeFromOption = dependencies?.getDateRangeFromOption; // Required dependency

    if (!Chart) return showNotification("Chart.js library not available.", "error");
    if (!getDateRangeFromOption) return showNotification("Date range helper not available.", "error");

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

        // Use helper to get date range
        const { from: startDate, to: endDate } = getDateRangeFromOption(dateRange, customFrom, customTo);

        // Filter data
        const filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.date);
            // Adjust date for comparison if needed (potential timezone issue)
            const entryDateOnly = new Date(Date.UTC(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate()));
            const filterStartDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
            const filterEndDate = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));


            const inDateRange = entryDateOnly >= filterStartDate && entryDateOnly <= filterEndDate;
            const clientMatch = client === 'all' || entry.client === client;
            const projectMatch = project === 'all' || entry.project === project;
            return inDateRange && clientMatch && projectMatch;
        });

        const filteredExpenses = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
             const expenseDateOnly = new Date(Date.UTC(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate()));
            const filterStartDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
            const filterEndDate = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));

            const inDateRange = expenseDateOnly >= filterStartDate && expenseDateOnly <= filterEndDate;
            const clientMatch = client === 'all' || expense.client === client;
            const projectMatch = project === 'all' || expense.project === project;
            return inDateRange && clientMatch && projectMatch;
        });

        // Check if there's data after filtering
        if (filteredEntries.length === 0 && filteredExpenses.length === 0) {
            showNoDataMessage(Chart);
            // Still update stats to zero
            updateDashboardStats([], [], startDate, endDate, settings, formatCurrency);
            return;
        }

        // Update UI components
        updateDashboardStats(filteredEntries, filteredExpenses, startDate, endDate, settings, formatCurrency);
        updateDashboardCharts(filteredEntries, filteredExpenses, startDate, endDate, Chart, settings, formatCurrency, dependencies?.formatDate); // Pass formatDate

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
    const timeDiff = endDate.getTime() - startDate.getTime();
    // Avoid division by zero or negative diff; ensure at least one day
    const daysDiff = timeDiff >= 0 ? Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1 : 1;
    const weeksCount = Math.max(1, daysDiff / 7); // Ensure at least 1 week to avoid division by zero

    if (weeksCount > 0) {
        avgWeeklyHours = totalHours / weeksCount;
        avgWeeklyRevenue = totalRevenue / weeksCount;
    }

    const avgRate = totalHours > 0 ? totalRevenue / totalHours : 0;
    const trackedDays = new Set(entries.map(entry => entry.date)).size;

    // Update DOM elements safely
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
    // Process data for each chart
    const dailyData = getDailyChartData(entries, startDate, endDate, formatDate);
    const clientData = getClientChartData(entries);
    const projectData = getProjectChartData(entries);
    const weekdayData = getWeekdayChartData(entries);
    const monthlyData = getMonthlyChartData(entries, formatDate);

    // Update chart instances
    updateChart('hours', ctx => createBarChart(ctx, Chart, dailyData.dates, 'Hours', dailyData.hours, 'rgba(53, 162, 235, 0.5)', 'rgba(53, 162, 235, 1)', 'Hours'));
    updateChart('revenue', ctx => createBarChart(ctx, Chart, dailyData.dates, 'Revenue', dailyData.revenue, 'rgba(75, 192, 192, 0.5)', 'rgba(75, 192, 192, 1)', formatCurrency(1, settings.currency).replace(/[\d.,\s]/g, ''))); // Get currency symbol
    updateChart('client', ctx => createPieChart(ctx, Chart, clientData.clients, 'Revenue', clientData.revenue, settings, formatCurrency));
    updateChart('project', ctx => createDoughnutChart(ctx, Chart, projectData.projects, 'Hours', projectData.hours));
    updateChart('weekday', ctx => createBarChart(ctx, Chart, weekdayData.weekdays, 'Hours', weekdayData.hours, 'rgba(153, 102, 255, 0.5)', 'rgba(153, 102, 255, 1)', 'Hours'));
    updateChart('monthly', ctx => createMonthlyChart(ctx, Chart, monthlyData, settings, formatCurrency)); // Specific function for combo chart
}

// --- Chart Data Processing ---

function getDailyChartData(entries, startDate, endDate, formatDate) {
    const datesMap = new Map();
    let currentDate = new Date(startDate);
    // Ensure start date is adjusted for UTC comparison if needed
    currentDate = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
    const finalEndDate = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));

    while (currentDate <= finalEndDate) {
        const dateString = currentDate.toISOString().slice(0, 10);
        datesMap.set(dateString, { hours: 0, revenue: 0 });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Use UTC date increment
    }

    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        const dateString = new Date(Date.UTC(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate())).toISOString().slice(0,10);
        if (datesMap.has(dateString)) {
            const dayData = datesMap.get(dateString);
            dayData.hours += entry.hours || 0;
            dayData.revenue += entry.amount || 0;
        }
    });

    const sortedDates = Array.from(datesMap.keys()).sort();
    const format = formatDate || ((d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    return {
        dates: sortedDates.map(d => format(d, 'MM/DD')), // Use a shorter format for labels
        hours: sortedDates.map(d => datesMap.get(d).hours),
        revenue: sortedDates.map(d => datesMap.get(d).revenue),
    };
}

function getClientChartData(entries) {
    const clientMap = new Map();
    entries.forEach(entry => {
        const client = entry.client || 'No Client';
        const data = clientMap.get(client) || { hours: 0, revenue: 0 };
        data.hours += entry.hours || 0;
        data.revenue += entry.amount || 0;
        clientMap.set(client, data);
    });
    const sortedClients = Array.from(clientMap.entries()).sort(([, a], [, b]) => b.revenue - a.revenue);
    return {
        clients: sortedClients.map(([client]) => client),
        hours: sortedClients.map(([, data]) => data.hours),
        revenue: sortedClients.map(([, data]) => data.revenue),
    };
}

function getProjectChartData(entries) {
     const projectMap = new Map();
    entries.forEach(entry => {
        const project = entry.project || 'No Project';
        const data = projectMap.get(project) || { hours: 0, revenue: 0 };
        data.hours += entry.hours || 0;
        data.revenue += entry.amount || 0;
        projectMap.set(project, data);
    });
    // Sort by hours for doughnut chart
    const sortedProjects = Array.from(projectMap.entries()).sort(([, a], [, b]) => b.hours - a.hours);
    return {
        projects: sortedProjects.map(([project]) => project),
        hours: sortedProjects.map(([, data]) => data.hours),
        revenue: sortedProjects.map(([, data]) => data.revenue), // Keep revenue if needed for tooltips
    };
}

function getWeekdayChartData(entries) {
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Shorter names
    const weekdayData = Array(7).fill(0).map(() => ({ hours: 0, revenue: 0 }));
    entries.forEach(entry => {
        const date = new Date(entry.date);
        // Adjust date to ensure correct day regardless of timezone vs UTC storage
        const localDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        const weekday = localDate.getDay(); // 0 = Sun
        if (weekday >= 0 && weekday < 7) {
             weekdayData[weekday].hours += entry.hours || 0;
             weekdayData[weekday].revenue += entry.amount || 0;
        }
    });
    return {
        weekdays: weekdayNames,
        hours: weekdayData.map(day => day.hours),
        revenue: weekdayData.map(day => day.revenue),
    };
}

function getMonthlyChartData(entries, formatDate) {
    const monthMap = new Map();
    entries.forEach(entry => {
        const date = new Date(entry.date);
         const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const monthKey = dateUTC.toISOString().slice(0, 7); // YYYY-MM
        const data = monthMap.get(monthKey) || { hours: 0, revenue: 0 };
        data.hours += entry.hours || 0;
        data.revenue += entry.amount || 0;
        monthMap.set(monthKey, data);
    });
    const sortedMonths = Array.from(monthMap.keys()).sort();
     const format = formatDate || ((d, f) => new Date(d + '-01T00:00:00Z').toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone:'UTC' })); // Format based on UTC
    return {
        months: sortedMonths.map(m => format(m, 'YYYY-MM')), // Use appropriate format string
        hours: sortedMonths.map(m => monthMap.get(m).hours),
        revenue: sortedMonths.map(m => monthMap.get(m).revenue),
    };
}

// --- Chart Rendering Helpers ---

const CHART_COLORS = [
    'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
    'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
    'rgba(199, 199, 199, 0.6)', 'rgba(83, 109, 254, 0.6)', 'rgba(46, 204, 113, 0.6)'
];
const CHART_BORDER_COLORS = CHART_COLORS.map(c => c.replace('0.6', '1'));

// Generic function to update a chart
function updateChart(chartKey, createChartFn) {
    const canvas = document.getElementById(`${chartKey}-chart`);
    if (!canvas) return console.warn(`Canvas not found for chart: ${chartKey}`);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy previous instance if it exists
    if (chartInstances[chartKey]) {
        chartInstances[chartKey].destroy();
        chartInstances[chartKey] = null;
    }

    // Create the new chart using the provided function
    chartInstances[chartKey] = createChartFn(ctx);
}

// Factory for basic Bar chart
function createBarChart(ctx, Chart, labels, label, data, bgColor, borderColor, yAxisLabel) {
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label, data, backgroundColor: bgColor, borderColor: borderColor, borderWidth: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
             plugins: { legend: { display: data.length < 20 } }, // Hide legend if too many bars
            scales: { y: { beginAtZero: true, title: { display: true, text: yAxisLabel } } }
        }
    });
}

// Factory for Pie chart
function createPieChart(ctx, Chart, labels, label, data, settings, formatCurrency) {
    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ label, data, backgroundColor: CHART_COLORS, borderColor: CHART_BORDER_COLORS, borderWidth: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', display: labels.length < 10 }, // Hide if too many slices
                tooltip: { callbacks: { label: context => pieTooltipLabel(context, formatCurrency, settings.currency) } }
            }
        }
    });
}
// Factory for Doughnut chart
function createDoughnutChart(ctx, Chart, labels, label, data) {
     return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ label, data, backgroundColor: CHART_COLORS, borderColor: CHART_BORDER_COLORS, borderWidth: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                 legend: { position: 'right', display: labels.length < 10 },
                 tooltip: { callbacks: { label: doughnutTooltipLabel } }
            }
        }
    });
}


// Factory for Monthly combo chart
function createMonthlyChart(ctx, Chart, data, settings, formatCurrency) {
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.months,
            datasets: [
                {
                    label: 'Hours', data: data.hours,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)', borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1, yAxisID: 'yHours'
                },
                {
                    label: 'Revenue', data: data.revenue,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)', borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2, yAxisID: 'yRevenue', type: 'line', tension: 0.1 // Make revenue a line
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                yHours: {
                    type: 'linear', position: 'left', beginAtZero: true,
                    title: { display: true, text: 'Hours' }
                },
                yRevenue: {
                    type: 'linear', position: 'right', beginAtZero: true,
                    title: { display: true, text: `Revenue (${formatCurrency(0, settings.currency).replace(/[\d.,\s]/g, '')})` }, // Currency symbol
                    grid: { drawOnChartArea: false } // Only show grid for hours axis
                }
            }
        }
    });
}


// --- Tooltip Callbacks ---

function pieTooltipLabel(context, formatCurrency, currencyCode) {
    const label = context.label || '';
    const value = context.raw || 0;
    const total = context.dataset.data.reduce((a, b) => a + b, 0);
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    return `${label}: ${formatCurrency(value, currencyCode)} (${percentage}%)`;
}

function doughnutTooltipLabel(context) {
     const label = context.label || '';
     const value = context.raw || 0;
     const total = context.dataset.data.reduce((a, b) => a + b, 0);
     const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
     return `${label}: ${value.toFixed(2)} hours (${percentage}%)`;
}


// --- No Data Message ---

function showNoDataMessage(Chart) {
    console.log("Dashboard: No data to display.");
    Object.keys(chartInstances).forEach(key => {
        const canvas = document.getElementById(`${key}-chart`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Clear existing chart
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            chartInstances[key] = null;
        }

        // Draw "No data" message if context and Chart are available
        if (ctx && Chart) {
             const { width, height } = canvas;
             ctx.clearRect(0, 0, width, height); // Clear canvas
             ctx.save();
             ctx.font = '16px Arial';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillStyle = '#999';
             ctx.fillText('No data available for selected period', width / 2, height / 2);
             ctx.restore();
        }
    });
     // Stats are reset to zero by updateDashboard calling updateDashboardStats with empty arrays
}

// --- Helper Functions --- (Copied from app.js for standalone use if needed, better to import)
// These should ideally be imported from a shared utils.js or passed in dependencies

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function setTextContent(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text ?? '';
}

// AddListener helper (if not importing from app.js)
function addListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`Dashboard: Element with ID "${id}" not found for listener.`);
    }
}

console.log("dashboard.js refactored loaded.");
