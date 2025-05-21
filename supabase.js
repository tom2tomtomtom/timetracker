// supabase.js - Supabase client initialization and API functions (FINAL - Complete)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// === Configuration ===
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = "https://uhjwlnvnwjlroratyuto.supabase.co";'https://uhjwlnvnwjlroratyuto.supabase.co'; // Replace with your URL if different
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoandsbnZud2pscm9yYXR5dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzNDI0NjMsImV4cCI6MjA1NzkxODQ2M30.wxHaInP7oAWtCk5IAgrmqCpT4tqXPs7dxyWYUp0xIPY";'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoandsbnZud2pscm9yYXR5dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzNDI0NjMsImV4cCI6MjA1NzkxODQ2M30.wxHaInP7oAWtCk5IAgrmqCpT4tqXPs7dxyWYUp0xIPY'; // Replace with your Anon Key if different

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
export async function getTimeEntries(userId) {
    console.log("Fetching time entries for user:", userId);
    const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
    if (error) { console.error('Error fetching time entries:', error); throw new Error(`Supabase error: ${error.message}`); }
    return mapToCamelCase(data || []).map(entry => ({
        ...entry,
        hours: Number(entry.hours || 0),
        rate: Number(entry.rate || 0),
        days: Number(entry.days || 0),
        dayRate: Number(entry.dayRate || 0),
        amount: Number(entry.amount || 0),
        exchangeRateUsd: entry.exchangeRateUsd != null ? Number(entry.exchangeRateUsd) : null,
        amountUsd: entry.amountUsd != null ? Number(entry.amountUsd) : null
    }));
}
export async function addTimeEntry(entryDataCamel) {
    console.log('Adding time entry (camelCase):', entryDataCamel);
    try {
        if (!entryDataCamel.date || !entryDataCamel.description || !entryDataCamel.userId ||
            (!entryDataCamel.hours && !entryDataCamel.days) ||
            (!entryDataCamel.rate && !entryDataCamel.dayRate)) {
            throw new Error('Entry missing fields');
        }
        const amount = entryDataCamel.hours && entryDataCamel.rate
            ? Number(entryDataCamel.hours) * Number(entryDataCamel.rate)
            : Number(entryDataCamel.days) * Number(entryDataCamel.dayRate);
        const entryDataSnake = mapToSnakeCase({
            ...entryDataCamel,
            hours: Number(entryDataCamel.hours || 0),
            rate: Number(entryDataCamel.rate || 0),
            days: Number(entryDataCamel.days || 0),
            dayRate: Number(entryDataCamel.dayRate || 0),
            amount
        });
        const { data, error } = await supabase.from('time_entries').insert([entryDataSnake]).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after insert.");
        console.log('Successfully added entry.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error in addTimeEntry API:', err); throw new Error(`Failed to add time entry: ${err.message}`); }
}
export async function updateTimeEntry(id, fieldsToUpdateCamel) {
    console.log(`Updating time entry ${id} with fields:`, fieldsToUpdateCamel);
    
    if (!id) throw new Error("Missing ID for updateTimeEntry.");
    
    try {
        // Convert fields to snake case
        const fieldsToUpdateSnake = mapToSnakeCase(fieldsToUpdateCamel);
        
        // If hours/days or rate/dayRate are being updated, recalculate amount
        if (fieldsToUpdateCamel.hours !== undefined || fieldsToUpdateCamel.rate !== undefined ||
            fieldsToUpdateCamel.days !== undefined || fieldsToUpdateCamel.dayRate !== undefined) {
            // First get the current entry to get any missing values
            const { data: currentEntry, error: fetchError } = await supabase
                .from('time_entries')
                .select('*')
                .eq('id', id)
                .single();
                
            if (fetchError) throw fetchError;
            if (!currentEntry) throw new Error("Entry not found");
            
            const hours = fieldsToUpdateCamel.hours !== undefined
                ? Number(fieldsToUpdateCamel.hours)
                : Number(currentEntry.hours);
            const rate = fieldsToUpdateCamel.rate !== undefined
                ? Number(fieldsToUpdateCamel.rate)
                : Number(currentEntry.rate);
            const days = fieldsToUpdateCamel.days !== undefined
                ? Number(fieldsToUpdateCamel.days)
                : Number(currentEntry.days);
            const dayRate = fieldsToUpdateCamel.dayRate !== undefined
                ? Number(fieldsToUpdateCamel.dayRate)
                : Number(currentEntry.day_rate);

            if (hours && rate) {
                fieldsToUpdateSnake.amount = hours * rate;
            } else {
                fieldsToUpdateSnake.amount = days * dayRate;
            }
        }
        
        // Update the entry
        const { data, error } = await supabase
            .from('time_entries')
            .update(fieldsToUpdateSnake)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        if (!data) throw new Error("No data returned after update.");
        
        console.log('Successfully updated entry.');
        return mapToCamelCase(data);
    } catch (err) {
        console.error('Error in updateTimeEntry API:', err);
        throw new Error(`Failed to update time entry: ${err.message}`);
    }
}

// Keep the original function for backward compatibility
export async function updateTimeEntryFull(entryDataCamel) {
    console.log('Updating full time entry (camelCase):', entryDataCamel);
    if (!entryDataCamel.id) throw new Error("Missing ID for updateTimeEntryFull.");
    try {
        const amount = entryDataCamel.hours && entryDataCamel.rate
            ? Number(entryDataCamel.hours) * Number(entryDataCamel.rate)
            : Number(entryDataCamel.days) * Number(entryDataCamel.dayRate);
        const entryDataSnake = mapToSnakeCase({
            ...entryDataCamel,
            hours: Number(entryDataCamel.hours || 0),
            rate: Number(entryDataCamel.rate || 0),
            days: Number(entryDataCamel.days || 0),
            dayRate: Number(entryDataCamel.dayRate || 0),
            amount
        });
        const { id, userId, createdAt, updatedAt, ...updateData } = entryDataSnake;
        const { data, error } = await supabase.from('time_entries').update(updateData).eq('id', id).select().single();
        if (error) throw error; if (!data) throw new Error("No data returned after update.");
        console.log('Successfully updated entry.'); return mapToCamelCase(data);
    } catch (err) { console.error('Error in updateTimeEntryFull API:', err); throw new Error(`Failed to update time entry: ${err.message}`); }
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
// Bulk data operations for import/export functionality
export async function replaceTimeEntries(entries) {
    console.log("Replacing all time entries...");
    
    // Get user ID from first entry (assuming all entries belong to same user)
    const userId = entries.length > 0 ? entries[0].userId : null;
    if (!userId) throw new Error("No user ID found in entries");
    
    try {
        // Start a transaction to delete and re-add all entries
        const { data, error } = await supabase.rpc('replace_time_entries', {
            p_user_id: userId,
            p_entries: mapToSnakeCase(entries.map(entry => ({
                ...entry,
                hours: Number(entry.hours || 0),
                rate: Number(entry.rate || 0),
                amount: Number(entry.amount || 0)
            })))
        });
        
        if (error) throw error;
        
        console.log("Successfully replaced all time entries");
        return true;
    } catch (error) {
        console.error("Error replacing time entries:", error);
        throw new Error(`Failed to replace time entries: ${error.message}`);
    }
}

export async function replaceExpenses(expenses) {
    console.log("Replacing all expenses...");
    
    // Get user ID from first expense (assuming all expenses belong to same user)
    const userId = expenses.length > 0 ? expenses[0].userId : null;
    if (!userId) throw new Error("No user ID found in expenses");
    
    try {
        // Delete all existing expenses for this user
        const { error: deleteError } = await supabase
            .from('expenses')
            .delete()
            .eq('user_id', userId);
        
        if (deleteError) throw deleteError;
        
        // If there are expenses to add, add them
        if (expenses.length > 0) {
            // Format expenses data
            const expensesData = expenses.map(expense => mapToSnakeCase({
                ...expense,
                amount: Number(expense.amount || 0)
            }));
            
            // Insert new expenses
            const { error: insertError } = await supabase
                .from('expenses')
                .insert(expensesData);
            
            if (insertError) throw insertError;
        }
        
        console.log("Successfully replaced all expenses");
        return true;
    } catch (error) {
        console.error("Error replacing expenses:", error);
        throw new Error(`Failed to replace expenses: ${error.message}`);
    }
}

export async function replaceRecurringEntries(entries) {
    console.log("Replacing all recurring entries...");
    
    // Get user ID from first entry (assuming all entries belong to same user)
    const userId = entries.length > 0 ? entries[0].userId : null;
    if (!userId) throw new Error("No user ID found in recurring entries");
    
    try {
        // Delete all existing recurring entries for this user
        const { error: deleteError } = await supabase
            .from('recurring_entries')
            .delete()
            .eq('user_id', userId);
        
        if (deleteError) throw deleteError;
        
        // If there are entries to add, add them
        if (entries.length > 0) {
            // Format entries data
            const entriesData = entries.map(entry => mapToSnakeCase({
                ...entry,
                hours: Number(entry.hours || 0),
                rate: Number(entry.rate || 0)
            }));
            
            // Insert new entries
            const { error: insertError } = await supabase
                .from('recurring_entries')
                .insert(entriesData);
            
            if (insertError) throw insertError;
        }
        
        console.log("Successfully replaced all recurring entries");
        return true;
    } catch (error) {
        console.error("Error replacing recurring entries:", error);
        throw new Error(`Failed to replace recurring entries: ${error.message}`);
    }
}

export async function replaceRates(rates) {
    console.log("Replacing all rate templates...");
    
    // Get user ID from first rate (assuming all rates belong to same user)
    const userId = rates.length > 0 ? rates[0].userId : null;
    if (!userId) throw new Error("No user ID found in rates");
    
    try {
        // Delete all existing rates for this user
        const { error: deleteError } = await supabase
            .from('rates')
            .delete()
            .eq('user_id', userId);
        
        if (deleteError) throw deleteError;
        
        // If there are rates to add, add them
        if (rates.length > 0) {
            // Format rates data
            const ratesData = rates.map(rate => mapToSnakeCase({
                ...rate,
                amount: Number(rate.amount || 0)
            }));
            
            // Insert new rates
            const { error: insertError } = await supabase
                .from('rates')
                .insert(ratesData);
            
            if (insertError) throw insertError;
        }
        
        console.log("Successfully replaced all rates");
        return true;
    } catch (error) {
        console.error("Error replacing rates:", error);
        throw new Error(`Failed to replace rates: ${error.message}`);
    }
}

export async function updateSettings(settings) {
    console.log("Updating settings...");
    
    if (!settings.userId) throw new Error("No user ID found in settings");
    
    try {
        const settingsSnake = mapToSnakeCase(settings);
        
        // Upsert settings
        const { error } = await supabase
            .from('settings')
            .upsert(settingsSnake, { onConflict: 'user_id' });
        
        if (error) throw error;
        
        console.log("Successfully updated settings");
        return true;
    } catch (error) {
        console.error("Error updating settings:", error);
        throw new Error(`Failed to update settings: ${error.message}`);
    }
}

// TODO: export async function deleteAllUserData(userId) { ... }

// Export the initialized client
export { supabase };

console.log("supabase.js FINAL with case mapping loaded."); // Updated version log
