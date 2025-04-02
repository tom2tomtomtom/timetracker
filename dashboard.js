// dashboard.js - Dashboard functionality (FINAL - Accepts state/deps)

// Keep track of chart instances locally
let chartInstances = {
    hours: null, revenue: null, client: null,
    project: null, weekday: null, monthly: null
};

// --- Initialization ---
export function initDashboard(appState, dependencies) {
    console.log("Initializing dashboard module...");
    addListener('refresh-dashboard', 'click', () => {
        console.log("Dashboard refresh requested...");
        // Pass current state and dependencies to update function
        updateDashboard(appState, dependencies);
    });
    addListener('dash-date-range', 'change', handleDashDateRangeChange);
    addListener('dash-client', 'change', () => updateDashboard(appState, dependencies)); // Update on filter change
    addListener('dash-project', 'change', () => updateDashboard(appState, dependencies)); // Update on filter change
    // Custom date range requires refresh button or listeners on date inputs + debounce
    addListener('dash-date-from', 'change', () => updateDashboard(appState, dependencies));
    addListener('dash-date-to', 'change', () => updateDashboard(appState, dependencies));

    handleDashDateRangeChange(); // Apply initial filter visibility
    // updateDashboard(appState, dependencies); // Initial update if needed
}

function handleDashDateRangeChange() {
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
    const getDateRangeFromOption = dependencies?.getDateRangeFromOption;

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

        const { from: startDate, to: endDate } = getDateRangeFromOption(dateRange, customFrom, customTo);

        // Filter data
        const filteredEntries = entries.filter(entry => { /* ... same filter logic ... */ });
        const filteredExpenses = expenses.filter(expense => { /* ... same filter logic ... */ });

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
    let avgWeeklyHours = 0; let avgWeeklyRevenue = 0;
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = timeDiff >= 0 ? Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24))) : 1; // Ensure at least 1 day
    const weeksCount = Math.max(1, daysDiff / 7);
    avgWeeklyHours = totalHours / weeksCount; avgWeeklyRevenue = totalRevenue / weeksCount;
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
}

// --- Chart Data Processing ---
function getDailyChartData(entries, startDate, endDate, formatDate) { /* ... same as V8 ... */ }
function getClientChartData(entries) { /* ... same as V8 ... */ }
function getProjectChartData(entries) { /* ... same as V8 ... */ }
function getWeekdayChartData(entries) { /* ... same as V8 ... */ }
function getMonthlyChartData(entries, formatDate) { /* ... same as V8 ... */ }

// --- Chart Rendering Helpers ---
const CHART_COLORS = [ /* ... same ... */ ];
const CHART_BORDER_COLORS = CHART_COLORS.map(c => c.replace('0.6', '1'));

function updateChart(chartKey, createChartFn) {
    const canvas = document.getElementById(`${chartKey}-chart`);
    if (!canvas) { console.warn(`Canvas not found for chart: ${chartKey}`); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (chartInstances[chartKey]) { chartInstances[chartKey].destroy(); chartInstances[chartKey] = null; }
    try { chartInstances[chartKey] = createChartFn(ctx); }
    catch (error) { console.error(`Failed to create chart "${chartKey}":`, error); }
}
function createBarChart(ctx, Chart, labels, label, data, bgColor, borderColor, yAxisLabel) { /* ... same ... */ }
function createPieChart(ctx, Chart, labels, label, data, settings, formatCurrency) { /* ... same ... */ }
function createDoughnutChart(ctx, Chart, labels, label, data) { /* ... same ... */ }
function createMonthlyChart(ctx, Chart, data, settings, formatCurrency) { /* ... same ... */ }

// --- Tooltip Callbacks ---
function pieTooltipLabel(context, formatCurrency, currencyCode) { /* ... same ... */ }
function doughnutTooltipLabel(context) { /* ... same ... */ }

// --- No Data Message ---
function showNoDataMessage(Chart) { /* ... same ... */ }

// --- Helper Functions ---
function getInputValue(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setTextContent(id, text) { const el = document.getElementById(id); if (el) el.textContent = text ?? ''; }
function addListener(id, event, handler) { // Local version for dashboard listeners
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, handler);
    else console.warn(`Dashboard: Element ID "${id}" not found for listener.`);
}

console.log("dashboard.js FINAL refactored loaded.");
