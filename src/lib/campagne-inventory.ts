/**
 * Canonical native campaign inventory for account-level surfaces.
 * Supabase owned campaigns only — never browser localStorage.
 */

import type { Campagna } from "@/types/campagne";
import { leggiCampagneDaSupabase } from "@/lib/campagne-db";

/**
 * Account-level native inventory — same source for /campagne and Home / Ally oggi.
 * No client filter, no setup filter, no Control Room filter, no localStorage merge.
 */
export async function leggiInventarioCampagneNative(): Promise<Campagna[]> {
  return leggiCampagneDaSupabase();
}
