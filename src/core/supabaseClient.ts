import { createClient } from "@supabase/supabase-js";

// Credenciais do projeto Umbra/Tournament
export const SUPABASE_URL = "https://rfuiuujdelssjbjetnpy.supabase.co";
export const SUPABASE_KEY = "sb_publishable_3hElTU2saGAAPXo-UFwOHw_6bSdEj3m";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
