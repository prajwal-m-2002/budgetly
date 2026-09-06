import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ppmdhggwdwymbfxhnkpg.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_-IoaS7X5yj2U34jM4ZuPiw_MhPsfoLK";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
