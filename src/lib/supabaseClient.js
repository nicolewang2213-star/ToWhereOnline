import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// The anon key is intentionally public in a browser app. Keep the migrated
// project as a safe production fallback so a Vercel redeploy does not disable
// every database-backed feature when build-time env vars are omitted.
const fallbackUrl = 'https://xnnewfjkibkaehlesipy.supabase.co';
const fallbackAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmV3ZmpraWJrYWVobGVzaXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTk1MzYsImV4cCI6MjA4ODI5NTUzNn0.6BFwHjR1Pd_ml1wYy1I_MOAZX8ikSnr1nVSFTJHy2XA';
const hasSupabaseConfig =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configuredUrl || '') &&
  Boolean(configuredAnonKey) &&
  !configuredAnonKey.includes('your-') &&
  !configuredAnonKey.includes('your_');

if (!hasSupabaseConfig) {
  console.warn('Supabase environment variables are missing; using the migrated project fallback.');
}

export const supabase = createClient(
  hasSupabaseConfig ? configuredUrl : fallbackUrl,
  hasSupabaseConfig ? configuredAnonKey : fallbackAnonKey
);
