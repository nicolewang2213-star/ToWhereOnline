import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configuredUrl || '') &&
  Boolean(configuredAnonKey) &&
  !configuredAnonKey.includes('your-') &&
  !configuredAnonKey.includes('your_');

if (!hasSupabaseConfig) {
  console.info('Supabase is not configured yet. The memory database features will stay empty.');
}

// A syntactically valid fallback keeps the static anniversary experience available
// before the owner's Supabase project is connected. Requests simply fail harmlessly.
export const supabase = createClient(
  hasSupabaseConfig ? configuredUrl : 'https://placeholder.supabase.co',
  hasSupabaseConfig ? configuredAnonKey : 'placeholder-anon-key'
);
