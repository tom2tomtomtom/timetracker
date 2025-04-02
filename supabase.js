// supabase.js - Supabase client initialization and API functions

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

// --- Time Entries ---
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

    console.log(`DEBUG/Supabase: Raw data fetched (${data?.length ?? 0}). First entry RAW:`, data ? data[0] : 'No raw data');

    const mappedData = mapToCamelCase(data || []).map(entry => ({
        ...entry,
        hours: Number(entry.hours || 0),
        rate: Number(entry.rate || 0),
        amount: Number(entry.amount || 0)
    }));

    console.log(`DEBUG/Supabase: Mapped data ready (${mappedData.length}). First entry MAPPED:`, mappedData[0]);

    return mappedData;
}

export async function addTimeEntry(entryDataCamel) {
    const entryDataSnake = mapToSnakeCase(entryDataCamel);
    
    const { data, error } = await supabase
        .from('time_entries')
        .insert([entryDataSnake])
        .select();
    
    if (error) {
        console.error('Error adding time entry:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data[0]);
}

export async function updateTimeEntry(entryDataCamel) {
    const entryDataSnake = mapToSnakeCase(entryDataCamel);
    const { id } = entryDataSnake;
    
    const { data, error } = await supabase
        .from('time_entries')
        .update(entryDataSnake)
        .eq('id', id)
        .select();
    
    if (error) {
        console.error('Error updating time entry:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data[0]);
}

export async function deleteTimeEntry(id) {
    const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting time entry:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return true;
}

// --- Expenses ---
export async function getExpenses() {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
    
    if (error) {
        console.error('Error fetching expenses:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data || []).map(expense => ({
        ...expense,
        amount: Number(expense.amount || 0)
    }));
}

export async function addExpense(expenseDataCamel) {
    const expenseDataSnake = mapToSnakeCase(expenseDataCamel);
    
    const { data, error } = await supabase
        .from('expenses')
        .insert([expenseDataSnake])
        .select();
    
    if (error) {
        console.error('Error adding expense:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data[0]);
}

export async function updateExpense(expenseDataCamel) {
    const expenseDataSnake = mapToSnakeCase(expenseDataCamel);
    const { id } = expenseDataSnake;
    
    const { data, error } = await supabase
        .from('expenses')
        .update(expenseDataSnake)
        .eq('id', id)
        .select();
    
    if (error) {
        console.error('Error updating expense:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data[0]);
}

export async function deleteExpense(id) {
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting expense:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return true;
}

// --- Settings ---
export async function getSettings(userId) {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    
    if (error) {
        console.error('Error fetching settings:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data || {});
}

export async function saveSettings(settingsCamel) {
    const settingsSnake = mapToSnakeCase(settingsCamel);
    const { user_id } = settingsSnake;
    
    // Check if settings exist
    const { data: existingData, error: checkError } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle();
    
    if (checkError) {
        console.error('Error checking settings:', checkError);
        throw new Error(`Supabase error: ${checkError.message}`);
    }
    
    if (existingData?.id) {
        // Update existing settings
        const { data, error } = await supabase
            .from('settings')
            .update(settingsSnake)
            .eq('user_id', user_id)
            .select();
        
        if (error) {
            console.error('Error updating settings:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }
        
        return mapToCamelCase(data[0]);
    } else {
        // Insert new settings
        const { data, error } = await supabase
            .from('settings')
            .insert([settingsSnake])
            .select();
        
        if (error) {
            console.error('Error creating settings:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }
        
        return mapToCamelCase(data[0]);
    }
}

// --- Form Data Persistence ---
export async function saveFormDataToDatabase(userId, formDataCamel) {
    const formDataSnake = { user_id: userId, form_data: formDataCamel };
    
    // Check if settings exist
    const { data: existingData, error: checkError } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    
    if (checkError) {
        console.error('Error checking settings:', checkError);
        throw new Error(`Supabase error: ${checkError.message}`);
    }
    
    if (existingData?.id) {
        // Update existing settings
        const { data, error } = await supabase
            .from('settings')
            .update({ form_data: formDataCamel })
            .eq('user_id', userId)
            .select();
        
        if (error) {
            console.error('Error updating form data:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }
        
        return true;
    } else {
        // Insert new settings with form data
        const { data, error } = await supabase
            .from('settings')
            .insert([formDataSnake])
            .select();
        
        if (error) {
            console.error('Error saving form data:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }
        
        return true;
    }
}

export async function getFormDataFromDatabase(userId) {
    const { data, error } = await supabase
        .from('settings')
        .select('form_data')
        .eq('user_id', userId)
        .maybeSingle();
    
    if (error) {
        console.error('Error fetching form data:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return data?.form_data || null;
}

// --- Auth Functions ---
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (error) {
        console.error('Signup error:', error);
        throw new Error(`Auth error: ${error.message}`);
    }
    
    return data;
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        console.error('Login error:', error);
        throw new Error(`Auth error: ${error.message}`);
    }
    
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        console.error('Signout error:', error);
        throw new Error(`Auth error: ${error.message}`);
    }
    
    return true;
}

// --- Rates ---
export async function getRates() {
    const { data, error } = await supabase
        .from('rates')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error fetching rates:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data || []).map(rate => ({
        ...rate,
        amount: Number(rate.amount || 0)
    }));
}

export async function addRate(rateDataCamel) {
    const rateDataSnake = mapToSnakeCase(rateDataCamel);
    
    const { data, error } = await supabase
        .from('rates')
        .insert([rateDataSnake])
        .select();
    
    if (error) {
        console.error('Error adding rate:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data[0]);
}

export async function deleteRate(id) {
    const { error } = await supabase
        .from('rates')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting rate:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return true;
}

// --- Recurring Entries ---
export async function getRecurringEntries() {
    const { data, error } = await supabase
        .from('recurring_entries')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error fetching recurring entries:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data || []).map(entry => ({
        ...entry,
        hours: Number(entry.hours || 0),
        rate: Number(entry.rate || 0)
    }));
}

export async function saveRecurringEntry(entryDataCamel) {
    const entryDataSnake = mapToSnakeCase(entryDataCamel);
    
    const { data, error } = await supabase
        .from('recurring_entries')
        .insert([entryDataSnake])
        .select();
    
    if (error) {
        console.error('Error saving recurring entry:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data[0]);
}

export async function deleteRecurringEntry(id) {
    const { error } = await supabase
        .from('recurring_entries')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting recurring entry:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return true;
}

// --- Invoices ---
export async function getInvoices() {
    const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false });
    
    if (error) {
        console.error('Error fetching invoices:', error);
        throw new Error(`Supabase error: ${error.message}`);
    }
    
    return mapToCamelCase(data || []);
}

// Export the initialized client
export { supabase };

console.log("supabase.js loaded.");
