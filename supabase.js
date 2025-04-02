// supabase.js - Supabase client initialization and API functions (FINAL - Complete)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// === Configuration ===
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://uhjwlnvnwjlroratyuto.supabase.co'; // Replace with your URL if different
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoandsbnZud2pscm9yYXR5dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzNDI0NjMsImV4cCI6MjA1NzkxODQ2M30.wxHaInP7oAWtCk5IAgrmqCpT4tqXPs7dxyWYUp0xIPY'; // Replace with your Anon Key if different

// === Initialize Client ===
// Added schema option for auth, might be needed depending on setup
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // autoRefreshToken: true, // Default: true
        // persistSession: true, // Default: true
        // detectSessionInUrl: true // Default: true
    }
});

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

// --- Time Entries ---
export async function getTimeEntries() {
    console.log("Fetching time entries...");
    const { data, error } = await supabase.from('time_entries').select('*').order('date', { ascending: false });
    if (error) { console.error('Error fetching time entries:', error); throw new Error(`Supabase error: ${error.message}`); }
    console.log(`Workspaceed ${data?.length ?? 0} time entries.`);
    return mapToCamelCase(data || []).map(entry => ({ ...entry, hours: Number(entry.hours || 0), rate: Number(entry.rate || 0), amount: Number(entry.amount || 0) }));
}
export async function addTimeEntry(entryDataCamel) {
    console.log('Adding time entry (camelCase):', entryDataCamel);
    try {
        if (!entryDataCamel.date || !entryDataCamel.description || !entryDataCamel.hours || !entryDataCamel.rate || !entryDataCamel.userId) { throw new Error('Entry missing fields'); }
        const entryDataSnake = mapToSnakeCase({ ...entryDataCamel, hours: Number(entryDataCamel.hours), rate: Number(entryDataCamel.rate), amount: Number(entryDataCamel.hours) * Number(entryDataCamel.rate) });
        const { data, error } = await supabase.from('time_entries').insert([entryDataSnake]).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after insert.");
        console.log('Successfully added entry.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error in addTimeEntry API:', err); throw new Error(`Failed to add time entry: ${err.message}`); }
}
export async function updateTimeEntry(entryDataCamel) {
    console.log('Updating time entry (camelCase):', entryDataCamel);
    if (!entryDataCamel.id) throw new Error("Missing ID for updateTimeEntry.");
    try {
        const entryDataSnake = mapToSnakeCase({ ...entryDataCamel, hours: Number(entryDataCamel.hours), rate: Number(entryDataCamel.rate), amount: Number(entryDataCamel.hours) * Number(entryDataCamel.rate) });
        const { id, userId, createdAt, updatedAt, ...updateData } = entryDataSnake;
        const { data, error } = await supabase.from('time_entries').update(updateData).eq('id', id).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after update.");
        console.log('Successfully updated entry.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error in updateTimeEntry API:', err); throw new Error(`Failed to update time entry: ${err.message}`); }
}
export async function deleteTimeEntry(id) {
    console.log(`Deleting time entry with id: ${id}`);
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) { console.error('Error deleting time entry:', error); throw new Error(`Failed to delete time entry: ${error.message}`); }
    console.log('Successfully deleted time entry.'); return true;
}

// --- Expenses ---
export async function getExpenses() {
    console.log("Fetching expenses...");
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) { console.error('Error fetching expenses:', error); throw new Error(`Supabase error: ${error.message}`); }
    console.log(`Workspaceed ${data?.length ?? 0} expenses.`);
    return mapToCamelCase(data || []).map(exp => ({ ...exp, amount: Number(exp.amount || 0) }));
}
export async function addExpense(expenseDataCamel) {
    console.log('Adding expense (camelCase):', expenseDataCamel);
    try {
        if (!expenseDataCamel.date || !expenseDataCamel.description || !expenseDataCamel.amount || !expenseDataCamel.userId) { throw new Error('Expense missing fields'); }
        const expenseDataSnake = mapToSnakeCase({ ...expenseDataCamel, amount: Number(expenseDataCamel.amount) });
        const { data, error } = await supabase.from('expenses').insert([expenseDataSnake]).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after insert.");
        console.log('Successfully added expense.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error in addExpense API:', err); throw new Error(`Failed to add expense: ${err.message}`); }
}
export async function updateExpense(expenseDataCamel) {
    console.log('Updating expense (camelCase):', expenseDataCamel);
    if (!expenseDataCamel.id) throw new Error("Missing ID for updateExpense.");
     try {
        const expenseDataSnake = mapToSnakeCase({ ...expenseDataCamel, amount: Number(expenseDataCamel.amount) });
        const { id, userId, createdAt, updatedAt, ...updateData } = expenseDataSnake;
        const { data, error } = await supabase.from('expenses').update(updateData).eq('id', id).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after update.");
        console.log('Successfully updated expense.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error in updateExpense API:', err); throw new Error(`Failed to update expense: ${err.message}`); }
}
export async function deleteExpense(id) {
    console.log(`Deleting expense with id: ${id}`);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { console.error('Error deleting expense:', error); throw new Error(`Failed to delete expense: ${error.message}`); }
    console.log('Successfully deleted expense.'); return true;
}

// --- Settings ---
export async function getSettings(userId) {
    console.log(`Workspaceing settings for user: ${userId}`);
    const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
    if (error) { console.error('Error fetching settings:', error); throw new Error(`Failed to get settings: ${error.message}`); }
    console.log('Fetched settings:', data); return data ? mapToCamelCase(data) : null;
}
export async function saveSettings(settingsCamel) {
    console.log('Saving settings (camelCase):', settingsCamel);
    if (!settingsCamel.userId) throw new Error("Missing userId for saveSettings.");
    try {
        const { formData, ...otherSettings } = settingsCamel; // Separate form data if exists
        const settingsSnake = mapToSnakeCase(otherSettings);
        const payload = settingsCamel.hasOwnProperty('formData') ? { ...settingsSnake, form_data: formData } : settingsSnake;
        const { data, error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' }).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after saving settings.");
        console.log('Successfully saved settings.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error saving settings:', err); throw new Error(`Failed to save settings: ${err.message}`); }
}

// --- Form Data Persistence ---
export async function saveFormDataToDatabase(userId, formDataCamel) {
    console.log('Saving form data to DB for user:', userId);
    try {
        const { error } = await supabase.from('settings').upsert({ user_id: userId, form_data: formDataCamel }, { onConflict: 'user_id' });
        if (error) throw error; console.log('Successfully saved form data to DB.'); return true;
    } catch (err) { console.error('Error saving form data to DB:', err); return false; }
}
export async function getFormDataFromDatabase(userId) {
    console.log('Fetching form data from DB for user:', userId);
    const { data, error } = await supabase.from('settings').select('form_data').eq('user_id', userId).maybeSingle();
    if (error) { console.error('Error fetching form data from DB:', error); return null; }
    console.log('Fetched form data (raw):', data); return data?.form_data || null;
}

// --- Auth Functions ---
export async function signUp(email, password) {
    console.log(`Attempting sign up for: ${email}`);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { console.error('Sign up error:', error); return { success: false, error }; }
    console.log('Sign up successful:', data.user?.email); return { success: true, user: data.user };
}
export async function signIn(email, password) {
    console.log(`Attempting sign in for: ${email}`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { console.error('Sign in error:', error); return { success: false, error }; }
    console.log('Sign in successful:', data.user?.email); return { success: true, user: data.user, session: data.session };
}
export async function signOut() {
    console.log('Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) { console.error('Sign out error:', error); return false; }
    console.log('Sign out successful.'); return true;
}

// --- Rates ---
export async function getRates() {
     console.log("Fetching rates...");
     const { data, error } = await supabase.from('rates').select('*').order('name');
     if (error) { console.error('Error fetching rates:', error); throw new Error(`Failed to get rates: ${error.message}`); }
     return mapToCamelCase(data || []).map(r => ({...r, amount: Number(r.amount || 0)}));
}
export async function addRate(rateDataCamel) {
     console.log("Adding rate:", rateDataCamel);
     if (!rateDataCamel.userId || !rateDataCamel.name || !rateDataCamel.amount) throw new Error("Rate data missing required fields.");
     const rateDataSnake = mapToSnakeCase({...rateDataCamel, amount: Number(rateDataCamel.amount)});
     const { data, error } = await supabase.from('rates').insert(rateDataSnake).select().single();
     if (error) { console.error('Error adding rate:', error); throw new Error(`Failed to add rate: ${error.message}`); }
     return mapToCamelCase(data);
}
export async function deleteRate(id) {
    console.log(`Deleting rate template with id: ${id}`);
    const { error } = await supabase.from('rates').delete().eq('id', id);
    if (error) { console.error('Error deleting rate:', error); throw new Error(`Failed to delete rate: ${error.message}`); }
    return true;
}
// TODO: Add updateRate if needed

// --- Recurring Entries ---
export async function getRecurringEntries() {
     console.log("Fetching recurring entries...");
     const { data, error } = await supabase.from('recurring_entries').select('*').order('description');
     if (error) { console.error(error); return []; }
     return mapToCamelCase(data || []).map(r => ({...r, hours: Number(r.hours || 0), rate: Number(r.rate || 0)}));
}
// TODO: export async function saveRecurringEntry(entryDataCamel) { ... }
// TODO: export async function deleteRecurringEntry(id) { ... }

// --- Invoices ---
export async function getInvoices() {
     console.log("Fetching invoices...");
     const { data, error } = await supabase.from('invoices').select('*').order('invoice_date', { ascending: false });
     if (error) { console.error(error); return []; }
     // Ensure numeric fields are numbers after mapping
     return mapToCamelCase(data || []).map(inv => ({
         ...inv,
         totalHours: Number(inv.totalHours || 0),
         totalAmount: Number(inv.totalAmount || 0),
         expensesAmount: Number(inv.expensesAmount || 0),
         grandTotal: Number(inv.grandTotal || 0)
     }));
}
// TODO: export async function saveInvoice(invoiceDataCamel) { ... }
// TODO: export async function saveInvoiceItems(itemsArrayCamel, invoiceId) { ... }
// TODO: export async function updateInvoiceStatus(invoiceId, status) { ... }
// TODO: export async function deleteInvoice(invoiceId) { ... }

// --- Danger Zone ---
// TODO: export async function deleteAllUserData(userId) { ... }

// Export the initialized client
export { supabase };

console.log("supabase.js FINAL with case mapping loaded."); // Updated version log
