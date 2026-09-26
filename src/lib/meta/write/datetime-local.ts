/**
 * Account-timezone datetime-local helpers (client + server safe).
 * Browser local TZ is never write authority — use ad account TZ.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO → `YYYY-MM-DDTHH:mm` in the given IANA timezone. */
export function isoToDatetimeLocal(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
): string {
  if (!iso?.trim()) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const tz = (timeZone ?? "").trim() || "Europe/Rome";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const get = (t: string) =>
      parts.find((p) => p.type === t)?.value ?? "";
    const y = get("year");
    const m = get("month");
    const d = get("day");
    const h = get("hour");
    const min = get("minute");
    if (!y || !m || !d || !h || !min) return "";
    return `${y}-${m}-${d}T${h}:${min}`;
  } catch {
    return "";
  }
}

/**
 * `YYYY-MM-DDTHH:mm` interpreted in account TZ → ISO UTC.
 * Uses a binary search against Intl formatting (DST-safe).
 */
export function datetimeLocalToIso(
  local: string | null | undefined,
  timeZone: string | null | undefined,
): string | null {
  const raw = (local ?? "").trim();
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const tz = (timeZone ?? "").trim() || "Europe/Rome";

  // Rough UTC guess then refine
  let guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  for (let i = 0; i < 4; i += 1) {
    const shown = isoToDatetimeLocal(new Date(guess).toISOString(), tz);
    if (!shown) return null;
    const sm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(shown);
    if (!sm) return null;
    const sy = Number(sm[1]);
    const smo = Number(sm[2]);
    const sd = Number(sm[3]);
    const sh = Number(sm[4]);
    const smi = Number(sm[5]);
    const want = Date.UTC(y, mo - 1, d, h, mi);
    const got = Date.UTC(sy, smo - 1, sd, sh, smi);
    const delta = want - got;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}

/** Human schedule line in it-IT for a timezone. */
export function formatScheduleRangeIt(
  startIso: string | null,
  endIso: string | null,
  timeZone: string | null,
): string {
  const tz = (timeZone ?? "").trim() || "Europe/Rome";
  const fmt = (iso: string | null): string | null => {
    if (!iso) return null;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    try {
      return new Intl.DateTimeFormat("it-IT", {
        timeZone: tz,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(ms));
    } catch {
      return null;
    }
  };
  const start = fmt(startIso);
  const end = fmt(endIso);
  if (start && end) return `${start} → ${end} (${tz})`;
  if (start) return `Da ${start} (${tz})`;
  return "Da aggiornare";
}

export function formatDatetimeLocalDisplay(local: string): string {
  // YYYY-MM-DDTHH:mm → DD/MM/YYYY HH:mm
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return local;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** @deprecated keep pad2 exported for tests if needed */
export { pad2 };
