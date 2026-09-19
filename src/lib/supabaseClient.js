import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// The anon key is intentionally public in a browser app. Keep the original
// project as a safe production fallback so a Vercel redeploy does not disable
// every database-backed feature when build-time env vars are omitted.
const fallbackUrl = 'https://fakokuvqtlpijcukvekj.supabase.co';
const fallbackAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZha29rdXZxdGxwaWpjdWt2ZWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTk0MzcsImV4cCI6MjA4MzQ5NTQzN30.Xy542SBt6AG_kEAySkHjbggJGZAGIa0wif0yOU0wuFg';
const hasSupabaseConfig =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configuredUrl || '') &&
  Boolean(configuredAnonKey) &&
  !configuredAnonKey.includes('your-') &&
  !configuredAnonKey.includes('your_');

if (!hasSupabaseConfig) {
  console.warn('Supabase environment variables are missing; using the original project fallback.');
}

export const supabase = createClient(
  hasSupabaseConfig ? configuredUrl : fallbackUrl,
  hasSupabaseConfig ? configuredAnonKey : fallbackAnonKey
);
