const SUPABASE_URL = "https://pcevxdnfwfagnvfznzxo.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_qIB4Hc4rw4yccJkL0n8BVg_ireoCMwj";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
