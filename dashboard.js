// dashboard.js - Dashboard functionality for the time tracker application

// Initialize dashboard functionality
export function initDashboard() {
    // Get dashboard elements
    const refreshButton = document.getElementById('refresh-dashboard');
    const dashDateRange = document.getElementById('dash-date-range');
    
    // Add event listeners
    refreshButton?.addEventListener('click', updateDashboard);
    dashDateRange?.addEventListener('change', handleDashDateRangeChange);
    
    // Set default date range
    if (dashDateRange) {
        dashDateRange.value = 'this-month';
    }
}

// Handle dashboard date range change
function handleDashDateRangeChange() {
    const dateRange = document.getElementById('dash-date-range').value;
    const customDateRange = document.getElementById('dash-custom-date-range');
    
    // Show custom date range inputs if 'custom' is selected
    if (dateRange === 'custom') {
        customDateRange.style.display = 'block';
    } else {
        customDateRange.style.display = 'none';
    }
}

// Update dashboard with current data
export function updateDashboard() {
    try {
        // Get timeEntries from global scope
        const timeEntries = window.timeEntries || [];
        const expenses = window.expenses || [];
        
        if (!timeEntries || timeEntries.length === 0) {
            // No data to display
            showNoDataMessage();
            return;
        }
        
        // Get selected filters
        const dateRange = document.getElementById('dash-date-range').value;
        const client = document.getElementById('dash-client').value;
        const project = document.getElementById('dash-project').value;
        const customFrom = document.getElementById('dash-date-from').value;
        const customTo = document.getElementById('dash-date-to').value;
        
        // Filter entries based on selected filters
        const { from: startDate, to: endDate } = getDateRangeFromOption(
            dateRange, customFrom, customTo
        );
        
        // Filter entries
        const filteredEntries = timeEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            
            // Check date range
            const inDateRange = entryDate >= startDate && entryDate <= endDate;
            
            // Check client
            const clientMatch = client === 'all' || entry.client === client;
            
            // Check project
            const projectMatch = project === 'all' || entry.project === project;
            
            return inDateRange && clientMatch && projectMatch;
        });
        
        // Filter expenses
        const filteredExpenses = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            expenseDate.setHours(0, 0, 0, 0);
            
            // Check date range
            const inDateRange = expenseDate >= startDate && expenseDate <= endDate;
            
            // Check client
            const clientMatch = client === 'all' || expense.client === client;
            
            // Check project
            const projectMatch = project === 'all' || expense.project === project;
            
            return inDateRange && clientMatch && projectMatch;
        });
        
        // Calculate totals and statistics
        updateDashboardStats(filteredEntries, filteredExpenses, startDate, endDate);
        
        // Update charts
        updateDashboardCharts(filteredEntries, filteredExpenses, startDate, endDate);
    } catch (err) {
        console.error('Error updating dashboard:', err);
        showNotification('Error updating dashboard', 'error');
    }
}

// Update dashboard statistics
function updateDashboardStats(entries, expenses, startDate, endDate) {
    // Calculate totals
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalRevenue = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const netIncome = totalRevenue - totalExpenses;
    
    // Calculate averages
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const weeksCount = daysDiff / 7;
    const avgWeeklyHours = totalHours / weeksCount;
    const avgWeeklyRevenue = totalRevenue / weeksCount;
    
    // Calculate average hourly rate
    const avgRate = totalHours > 0 ? totalRevenue / totalHours : 0;
    
    // Get tracked days (unique dates in entries)
    const uniqueDates = new Set(entries.map(entry => entry.date));
    const trackedDays = uniqueDates.size;
    
    // Update dashboard values
    document.getElementById('dash-total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('dash-total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('dash-avg-hours').textContent = avgWeeklyHours.toFixed(2);
    document.getElementById('dash-avg-revenue').textContent = formatCurrency(avgWeeklyRevenue);
    document.getElementById('dash-avg-rate').textContent = formatCurrency(avgRate);
    document.getElementById('dash-total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('dash-net-income').textContent = formatCurrency(netIncome);
    document.getElementById('dash-days-tracked').textContent = trackedDays;
}

// Update dashboard charts
function updateDashboardCharts(entries, expenses, startDate, endDate) {
    // Process data for charts
    const dailyData = getDailyChartData(entries, startDate, endDate);
    const clientData = getClientChartData(entries);
    const projectData = getProjectChartData(entries);
    const weekdayData = getWeekdayChartData(entries);
    const monthlyData = getMonthlyChartData(entries);
    
    // Update charts
    updateHoursChart(dailyData);
    updateRevenueChart(dailyData);
    updateClientChart(clientData);
    updateProjectChart(projectData);
    updateWeekdayChart(weekdayData);
    updateMonthlyChart(monthlyData);
}

// Get daily chart data
function getDailyChartData(entries, startDate, endDate) {
    // Generate all dates in range
    const dates = [];
    const hours = [];
    const revenue = [];
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().slice(0, 10);
        dates.push(dateString);
        
        // Find entries for this date
        const dayEntries = entries.filter(entry => entry.date === dateString);
        
        // Calculate totals for this date
        const dayHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const dayRevenue = dayEntries.reduce((sum, entry) => sum + entry.amount, 0);
        
        hours.push(dayHours);
        revenue.push(dayRevenue);
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Format dates for display
    const formattedDates = dates.map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    
    return {
        dates: formattedDates,
        hours,
        revenue
    };
}

// Get client chart data
function getClientChartData(entries) {
    // Group by client
    const clientData = {};
    
    entries.forEach(entry => {
        const client = entry.client || 'No Client';
        
        if (!clientData[client]) {
            clientData[client] = {
                hours: 0,
                revenue: 0
            };
        }
        
        clientData[client].hours += entry.hours;
        clientData[client].revenue += entry.amount;
    });
    
    // Sort by revenue (descending)
    const sortedClients = Object.keys(clientData).sort((a, b) => 
        clientData[b].revenue - clientData[a].revenue
    );
    
    // Create arrays for chart
    const clients = sortedClients;
    const hours = clients.map(client => clientData[client].hours);
    const revenue = clients.map(client => clientData[client].revenue);
    
    return {
        clients,
        hours,
        revenue
    };
}

// Get project chart data
function getProjectChartData(entries) {
    // Group by project
    const projectData = {};
    
    entries.forEach(entry => {
        const project = entry.project || 'No Project';
        
        if (!projectData[project]) {
            projectData[project] = {
                hours: 0,
                revenue: 0
            };
        }
        
        projectData[project].hours += entry.hours;
        projectData[project].revenue += entry.amount;
    });
    
    // Sort by revenue (descending)
    const sortedProjects = Object.keys(projectData).sort((a, b) => 
        projectData[b].revenue - projectData[a].revenue
    );
    
    // Create arrays for chart
    const projects = sortedProjects;
    const hours = projects.map(project => projectData[project].hours);
    const revenue = projects.map(project => projectData[project].revenue);
    
    return {
        projects,
        hours,
        revenue
    };
}

// Get weekday chart data
function getWeekdayChartData(entries) {
    // Initialize weekday data
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = weekdayNames.map(() => ({ hours: 0, revenue: 0 }));
    
    // Group by weekday
    entries.forEach(entry => {
        const date = new Date(entry.date);
        const weekday = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        weekdayData[weekday].hours += entry.hours;
        weekdayData[weekday].revenue += entry.amount;
    });
    
    // Create arrays for chart
    const hours = weekdayData.map(day => day.hours);
    const revenue = weekdayData.map(day => day.revenue);
    
    return {
        weekdays: weekdayNames,
        hours,
        revenue
    };
}

// Get monthly chart data
function getMonthlyChartData(entries) {
    // Group by month
    const monthlyData = {};
    
    entries.forEach(entry => {
        const date = new Date(entry.date);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                hours: 0,
                revenue: 0
            };
        }
        
        monthlyData[monthKey].hours += entry.hours;
        monthlyData[monthKey].revenue += entry.amount;
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort();
    
    // Create arrays for chart
    const months = sortedMonths.map(monthKey => {
        const date = new Date(monthKey + '-01');
        return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    });
    
    const hours = sortedMonths.map(month => monthlyData[month].hours);
    const revenue = sortedMonths.map(month => monthlyData[month].revenue);
    
    return {
        months,
        hours,
        revenue
    };
}

// Update hours chart
function updateHoursChart(data) {
    const ctx = document.getElementById('hours-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Get Chart.js from global scope
    const Chart = window.Chart;
    if (!Chart) {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Check if chart already exists
    const chartInstance = Chart.getChart(ctx.canvas);
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Hours',
                data: data.hours,
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
                borderColor: 'rgba(53, 162, 235, 1)',
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

// Update revenue chart
function updateRevenueChart(data) {
    const ctx = document.getElementById('revenue-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Get Chart.js from global scope
    const Chart = window.Chart;
    if (!Chart) {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Check if chart already exists
    const chartInstance = Chart.getChart(ctx.canvas);
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Revenue ($)',
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

// Update client chart
function updateClientChart(data) {
    const ctx = document.getElementById('client-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Get Chart.js from global scope
    const Chart = window.Chart;
    if (!Chart) {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Check if chart already exists
    const chartInstance = Chart.getChart(ctx.canvas);
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.clients,
            datasets: [{
                label: 'Revenue',
                data: data.revenue,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)',
                    'rgba(199, 199, 199, 0.5)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(199, 199, 199, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update project chart
function updateProjectChart(data) {
    const ctx = document.getElementById('project-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Get Chart.js from global scope
    const Chart = window.Chart;
    if (!Chart) {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Check if chart already exists
    const chartInstance = Chart.getChart(ctx.canvas);
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.projects,
            datasets: [{
                label: 'Hours',
                data: data.hours,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)',
                    'rgba(199, 199, 199, 0.5)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(199, 199, 199, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value.toFixed(2)} hours (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update weekday chart
function updateWeekdayChart(data) {
    const ctx = document.getElementById('weekday-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Get Chart.js from global scope
    const Chart = window.Chart;
    if (!Chart) {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Check if chart already exists
    const chartInstance = Chart.getChart(ctx.canvas);
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.weekdays,
            datasets: [{
                label: 'Hours',
                data: data.hours,
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                borderColor: 'rgba(153, 102, 255, 1)',
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

// Update monthly chart
function updateMonthlyChart(data) {
    const ctx = document.getElementById('monthly-chart')?.getContext('2d');
    if (!ctx) return;
    
    // Get Chart.js from global scope
    const Chart = window.Chart;
    if (!Chart) {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Check if chart already exists
    const chartInstance = Chart.getChart(ctx.canvas);
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    new Chart(ctx, {
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
                    yAxisID: 'hours'
                },
                {
                    label: 'Revenue ($)',
                    data: data.revenue,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    yAxisID: 'revenue',
                    type: 'line'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                hours: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                revenue: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
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

// Show a message when no data is available
function showNoDataMessage() {
    // Clear charts
    const chartIds = ['hours-chart', 'revenue-chart', 'client-chart', 'project-chart', 'weekday-chart', 'monthly-chart'];
    
    chartIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const chartInstance = window.Chart?.getChart(canvas);
            if (chartInstance) {
                chartInstance.destroy();
            }
            
            // Draw "No data" message
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#999';
                ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            }
        }
    });
    
    // Reset all stat values to zero
    document.getElementById('dash-total-hours').textContent = '0';
    document.getElementById('dash-total-revenue').textContent = '$0';
    document.getElementById('dash-avg-hours').textContent = '0';
    document.getElementById('dash-avg-revenue').textContent = '$0';
    document.getElementById('dash-avg-rate').textContent = '$0';
    document.getElementById('dash-total-expenses').textContent = '$0';
    document.getElementById('dash-net-income').textContent = '$0';
    document.getElementById('dash-days-tracked').textContent = '0';
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

// Helper function to format currency
function formatCurrency(amount) {
    return '$' + amount.toFixed(2);
}

// Show a notification
function showNotification(message, type = 'info') {
    // Check if the showNotification function exists in the global scope
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        // Fallback implementation
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}