import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://gkppjknrjciymcoorrjt.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_M3xMEMLW3_RUhBImWwytXw_nd9ysaPT";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
