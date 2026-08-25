import { createClient } from "@supabase/supabase-js";

function supabaseProjectUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  if (!url) return "";
  // createClient richiede l'URL progetto, non l'endpoint REST /rest/v1
  return url.replace(/\/rest\/v1$/i, "");
}

const supabaseUrl = supabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
