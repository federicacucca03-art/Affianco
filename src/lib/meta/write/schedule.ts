/**
 * M11A.1 — Schedule normalization against ad account timezone.
 * Browser/server local TZ are never write authority.
 */

export type ScheduleResolve =
  | {
      ok: true;
      startTime: string | null;
      endTime: string | null;
      continuous: boolean;
    }
  | {
      ok: false;
      reason: "MISSING_TIMEZONE" | "INVALID_RANGE" | "MISSING_SCHEDULE";
    };

/**
 * If both start and end absent → MISSING_SCHEDULE (no silent continuous default).
 * If start present → validate end > start when end set.
 * Times stored as ISO; timezone_name recorded for future Graph formatting.
 */
export function resolveWriteSchedule(input: {
  startAtIso: string | null;
  endAtIso: string | null;
  timezoneName: string | null;
}): ScheduleResolve {
  const tz = (input.timezoneName ?? "").trim();
  if (!tz) return { ok: false, reason: "MISSING_TIMEZONE" };

  const start = input.startAtIso?.trim() || null;
  const end = input.endAtIso?.trim() || null;

  if (!start && !end) {
    return { ok: false, reason: "MISSING_SCHEDULE" };
  }

  if (start) {
    const startMs = Date.parse(start);
    if (!Number.isFinite(startMs)) {
      return { ok: false, reason: "INVALID_RANGE" };
    }
  }
  if (end) {
    const endMs = Date.parse(end);
    if (!Number.isFinite(endMs)) {
      return { ok: false, reason: "INVALID_RANGE" };
    }
    if (start) {
      const startMs = Date.parse(start);
      if (!(endMs > startMs)) {
        return { ok: false, reason: "INVALID_RANGE" };
      }
    } else {
      return { ok: false, reason: "MISSING_SCHEDULE" };
    }
  }

  return {
    ok: true,
    startTime: start,
    endTime: end,
    continuous: Boolean(start && !end),
  };
}
