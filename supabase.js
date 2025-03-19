// Supabase client initialization
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase URL and anon key
const SUPABASE_URL = 'https://uhjwlnvnwjlroratyuto.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoandsbnZud2pscm9yYXR5dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzNDI0NjMsImV4cCI6MjA1NzkxODQ2M30.wxHaInP7oAWtCk5IAgrmqCpT4tqXPs7dxyWYUp0xIPY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Time entries functions
export async function getTimeEntries() {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching time entries:', error)
    return []
  }
  
  return data
}

export async function addTimeEntry(entry) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert([entry])
    .select()
  
  if (error) {
    console.error('Error adding time entry:', error)
    return null
  }
  
  return data[0]
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