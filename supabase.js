// supabase.js - Supabase client initialization and API functions (V7 - With Debug Logs)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// === Configuration ===
const SUPABASE_URL = 'https://uhjwlnvnwjlroratyuto.supabase.co'; // Replace with your URL if different
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoandsbnZud2pscm9yYXR5dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzNDI0NjMsImV4cCI6MjA1NzkxODQ2M30.wxHaInP7oAWtCk5IAgrmqCpT4tqXPs7dxyWYUp0xIPY'; // Replace with your Anon Key if different

// === Initialize Client ===
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Case Conversion Helpers ===
function mapToCamelCase(obj) {
    if (obj === null || typeof obj !== 'object') { return obj; }
    if (Array.isArray(obj)) { return obj.map(mapToCamelCase); }
    return Object.keys(obj).reduce((result, key) => {
        if (key.includes('_')) {
            const camelCaseKey = key.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));
            result[camelCaseKey] = mapToCamelCase(obj[key]);
        } else { result[key] = mapToCamelCase(obj[key]); }
        return result;
    }, {});
}
function mapToSnakeCase(obj) {
    if (obj === null || typeof obj !== 'object') { return obj; }
     if (Array.isArray(obj)) { return obj.map(mapToSnakeCase); }
    return Object.keys(obj).reduce((result, key) => {
        const snakeCaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        result[snakeCaseKey] = mapToSnakeCase(obj[key]);
        return result;
    }, {});
}

// === API Functions ===

// --- Time Entries (WITH DEBUG LOGS) ---
export async function getTimeEntries() {
    console.log("Fetching time entries...");
    const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .order('date', { ascending: false }); // DB returns snake_case

    if (error) {
        console.error('Error fetching time entries:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }

    // --- ADDED DEBUG LOG 1 --- (Log raw data from Supabase)
    console.log(`DEBUG/Supabase: Raw data fetched (${data?.length ?? 0}). First entry RAW:`, data ? data[0] : 'No raw data');

    const mappedData = mapToCamelCase(data || []).map(entry => ({
        ...entry,
        hours: Number(entry.hours || 0),
        rate: Number(entry.rate || 0),
        amount: Number(entry.amount || 0)
    }));

    // --- ADDED DEBUG LOG 2 --- (Log data AFTER mapping)
    console.log(`DEBUG/Supabase: Mapped data ready (${mappedData.length}). First entry MAPPED:`, mappedData[0]);

    return mappedData; // Return the mapped data
}
// --- End of modified getTimeEntries ---

export async function addTimeEntry(entryDataCamel) { /* ... same as V6 ... */ }
export async function updateTimeEntry(entryDataCamel) { /* ... same as V6 ... */ }
export async function deleteTimeEntry(id) { /* ... same as V6 ... */ }

// --- Expenses ---
export async function getExpenses() { /* ... same as V6 ... */ }
export async function addExpense(expenseDataCamel) { /* ... same as V6 ... */ }
export async function updateExpense(expenseDataCamel) { /* ... same as V6 ... */ }
export async function deleteExpense(id) { /* ... same as V6 ... */ }

// --- Settings ---
export async function getSettings(userId) { /* ... same as V6 ... */ }
export async function saveSettings(settingsCamel) { /* ... same as V6 ... */ }

// --- Form Data Persistence ---
export async function saveFormDataToDatabase(userId, formDataCamel) { /* ... same as V6 ... */ }
export async function getFormDataFromDatabase(userId) { /* ... same as V6 ... */ }

// --- Auth Functions ---
export async function signUp(email, password) { /* ... same as V6 ... */ }
export async function signIn(email, password) { /* ... same as V6 ... */ }
export async function signOut() { /* ... same as V6 ... */ }

// --- Rates ---
export async function getRates() { /* ... same as V6 ... */ }
export async function addRate(rateDataCamel) { /* ... same as V6 ... */ }
export async function deleteRate(id) { /* ... same as V6 ... */ }
// TODO: Add updateRate function if needed

// --- Recurring Entries ---
export async function getRecurringEntries() { /* ... same as V6 ... */ }
// TODO: export async function saveRecurringEntry(entryDataCamel) { ... }
// TODO: export async function deleteRecurringEntry(id) { ... }

// --- Invoices ---
export async function getInvoices() { /* ... same as V6 ... */ }
// TODO: export async function saveInvoice(invoiceDataCamel) { ... }
// TODO: export async function saveInvoiceItems(itemsArrayCamel, invoiceId) { ... }
// TODO: export async function updateInvoiceStatus(invoiceId, status) { ... }
// TODO: export async function deleteInvoice(invoiceId) { ... }

// --- Danger Zone ---
// TODO: Implement if needed - BE VERY CAREFUL WITH THIS
// export async function deleteAllUserData(userId) { ... delete from all tables ... }

// Export the initialized client
export { supabase };

console.log("supabase.js V7 with debug logs loaded."); // Updated version log
