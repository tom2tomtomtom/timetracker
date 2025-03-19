// Utility script to check if Supabase is properly set up
import { supabase } from './supabase.js';

// This function will run a series of tests to verify Supabase setup
export async function runSetupChecks() {
    console.log("🔍 Starting Supabase setup checks...");
    const results = {
        connection: false,
        tables: {
            time_entries: false,
            expenses: false,
            settings: false,
            rates: false,
            invoices: false,
            invoice_items: false,
            recurring_entries: false
        },
        auth: false
    };
    
    try {
        // Step 1: Check connection to Supabase
        console.log("📡 Testing connection to Supabase...");
        const { data: connectionTest, error: connectionError } = await supabase.from('_meta').select('*').limit(1).maybeSingle();
        
        if (connectionError && connectionError.code !== 'PGRST116') {
            // PGRST116 is "Table not found" which is expected for _meta
            console.error("❌ Connection to Supabase failed:", connectionError);
            results.connection = false;
        } else {
            console.log("✅ Successfully connected to Supabase!");
            results.connection = true;
        }
        
        // Step 2: Check if tables exist
        console.log("🗃️ Checking if required tables exist...");
        
        // Check each table
        for (const table of Object.keys(results.tables)) {
            console.log(`   Checking ${table} table...`);
            try {
                const { data, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                
                if (error) {
                    console.error(`   ❌ Table '${table}' check failed:`, error.message);
                    results.tables[table] = false;
                } else {
                    console.log(`   ✅ Table '${table}' exists!`);
                    results.tables[table] = true;
                }
            } catch (err) {
                console.error(`   ❌ Error checking table '${table}':`, err.message);
                results.tables[table] = false;
            }
        }
        
        // Step 3: Check if auth is working
        console.log("🔐 Checking auth functionality...");
        try {
            const { data: authData, error: authError } = await supabase.auth.getSession();
            console.log("   Auth system response:", authData ? "Received data" : "No data", authError ? `Error: ${authError.message}` : "No error");
            
            // Even if there's no session, we just want to check if the auth API works
            results.auth = !authError;
            console.log(results.auth ? "   ✅ Auth system is working!" : "   ❌ Auth system has issues!");
        } catch (err) {
            console.error("   ❌ Error checking auth system:", err.message);
            results.auth = false;
        }
        
        // Summary
        console.log("\n📋 Setup Check Summary:");
        console.log(`Connection to Supabase: ${results.connection ? "✅ Good" : "❌ Failed"}`);
        console.log("Required tables:");
        
        let allTablesExist = true;
        for (const [table, exists] of Object.entries(results.tables)) {
            console.log(`   ${table}: ${exists ? "✅ Exists" : "❌ Missing"}`);
            if (!exists) allTablesExist = false;
        }
        
        console.log(`Auth System: ${results.auth ? "✅ Working" : "❌ Issues"}`);
        
        // Final result
        const setupComplete = results.connection && allTablesExist && results.auth;
        console.log(`\n🏁 Overall Setup: ${setupComplete ? "✅ READY TO USE" : "❌ NEEDS ATTENTION"}`);
        
        if (!setupComplete) {
            console.log("\n❗ Setup incomplete. Please check the following:");
            
            if (!results.connection) {
                console.log("   - Verify your Supabase URL and API key");
                console.log("   - Check if your Supabase project is running");
            }
            
            if (!allTablesExist) {
                console.log("   - Run the SQL setup script from schema.sql");
                console.log("   - Check for any errors in the SQL execution");
            }
            
            if (!results.auth) {
                console.log("   - Verify auth settings in your Supabase project");
            }
        }
        
        return { success: setupComplete, results };
        
    } catch (err) {
        console.error("❌ Critical error during setup check:", err);
        return { success: false, error: err.message };
    }
}