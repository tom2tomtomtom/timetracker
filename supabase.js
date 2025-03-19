// Supabase client initialization
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase URL and anon key
const SUPABASE_URL = 'https://uhjwlnvnwjlroratyuto.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoandsbnZud2pscm9yYXR5dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzNDI0NjMsImV4cCI6MjA1NzkxODQ2M30.wxHaInP7oAWtCk5IAgrmqCpT4tqXPs7dxyWYUp0xIPY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Export the Supabase client for direct access
export { supabase }

// Time entries functions
export async function getTimeEntries() {
  console.log("Fetching time entries from Supabase...");
  
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching time entries:', error)
    return []
  }
  
  console.log("Received time entries:", data.length);
  
  // Make sure all numeric fields are parsed as numbers
  const parsedData = data.map(entry => ({
    ...entry,
    hours: Number(entry.hours),
    rate: Number(entry.rate),
    amount: Number(entry.amount)
  }));
  
  return parsedData
}

export async function addTimeEntry(entry) {
  console.log('Adding time entry to Supabase:', entry);
  
  try {
    // Ensure the entry has all required fields
    if (!entry.date || !entry.description || !entry.hours || !entry.rate) {
      console.error('Invalid entry data:', entry);
      throw new Error('Entry is missing required fields');
    }
    
    // Make sure numeric values are numbers, not strings
    const formattedEntry = {
      ...entry,
      hours: Number(entry.hours),
      rate: Number(entry.rate),
      amount: Number(entry.hours) * Number(entry.rate),
    };
    
    console.log('Formatted entry for Supabase:', formattedEntry);
    
    const { data, error } = await supabase
      .from('time_entries')
      .insert([formattedEntry])
      .select();
    
    if (error) {
      console.error('Supabase error adding time entry:', error);
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.error('No data returned after insert');
      throw new Error('No data returned after insert');
    }
    
    console.log('Successfully added entry, returned data:', data[0]);
    return data[0];
  } catch (err) {
    console.error('Error in addTimeEntry:', err);
    alert(`Error adding time entry: ${err.message}`);
    return null;
  }
}

export async function updateTimeEntry(entry) {
  const { data, error } = await supabase
    .from('time_entries')
    .update(entry)
    .eq('id', entry.id)
    .select()
  
  if (error) {
    console.error('Error updating time entry:', error)
    return null
  }
  
  return data[0]
}

export async function deleteTimeEntry(id) {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting time entry:', error)
    return false
  }
  
  return true
}

// Expenses functions
export async function getExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching expenses:', error)
    return []
  }
  
  return data
}

export async function addExpense(expense) {
  const { data, error } = await supabase
    .from('expenses')
    .insert([expense])
    .select()
  
  if (error) {
    console.error('Error adding expense:', error)
    return null
  }
  
  return data[0]
}

export async function updateExpense(expense) {
  const { data, error } = await supabase
    .from('expenses')
    .update(expense)
    .eq('id', expense.id)
    .select()
  
  if (error) {
    console.error('Error updating expense:', error)
    return null
  }
  
  return data[0]
}

export async function deleteExpense(id) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting expense:', error)
    return false
  }
  
  return true
}

// Settings functions
export async function getSettings(userId) {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  
  if (error) {
    console.error('Error fetching settings:', error)
    return null
  }
  
  return data
}

export async function saveSettings(settings) {
  const { data, error } = await supabase
    .from('settings')
    .upsert(settings)
    .select()
  
  if (error) {
    console.error('Error saving settings:', error)
    return null
  }
  
  return data[0]
}

// Form data persistence functions
export async function saveFormDataToDatabase(userId, formData) {
  // Using the settings table to store form_data as a JSON field
  const { data, error } = await supabase
    .from('settings')
    .upsert({
      user_id: userId,
      form_data: formData
    }, { onConflict: 'user_id' })
    .select()
  
  if (error) {
    console.error('Error saving form data to database:', error)
    return false
  }
  
  return true
}

export async function getFormDataFromDatabase(userId) {
  const { data, error } = await supabase
    .from('settings')
    .select('form_data')
    .eq('user_id', userId)
    .maybeSingle()
  
  if (error) {
    console.error('Error fetching form data from database:', error)
    return null
  }
  
  return data?.form_data
}

// Auth functions
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) {
    console.error('Error signing up:', error)
    return { success: false, error }
  }
  
  return { success: true, user: data.user }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    console.error('Error signing in:', error)
    return { success: false, error }
  }
  
  return { success: true, user: data.user, session: data.session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Error signing out:', error)
    return false
  }
  
  return true
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}