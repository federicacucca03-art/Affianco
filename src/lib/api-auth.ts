import { createClient } from "@supabase/supabase-js";

function supabaseProjectUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  if (!url) return "";
  return url.replace(/\/rest\/v1$/i, "");
}

export function tokenDaAuthorization(header: string | null): string | null {
  if (!header) return null;
  const m = header.trim().match(/^Bearer\s+(\S+)/i);
  return m?.[1]?.trim() || null;
}

/**
 * Auth per API route: JWT Bearer, stesso progetto Supabase del client.
 * Nessun cookie custom. Nessun nuovo sistema.
 */
export async function requireRouteUserId(
  request: Request,
): Promise<string | null> {
  const token = tokenDaAuthorization(
    request.headers.get("authorization") ??
      request.headers.get("Authorization"),
  );
  if (!token) return null;
  const url = supabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) return null;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}
