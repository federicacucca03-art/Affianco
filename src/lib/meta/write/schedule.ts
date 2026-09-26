/**
 * M11A.1/M11A.2 — Schedule normalization against ad account timezone.
 * Browser/server local TZ are never write authority.
 * Historical / past starts block write until user updates.
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
      reason:
        | "MISSING_TIMEZONE"
        | "INVALID_RANGE"
        | "MISSING_SCHEDULE"
        | "PAST_SCHEDULE";
    };

/**
 * If both start and end absent → MISSING_SCHEDULE (no silent continuous default).
 * If start present → validate end > start when end set.
 * Past starts (before now − 1h) → PAST_SCHEDULE (no auto-shift).
 */
export function resolveWriteSchedule(input: {
  startAtIso: string | null;
  endAtIso: string | null;
  timezoneName: string | null;
  nowMs?: number;
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
    const now = input.nowMs ?? Date.now();
    if (startMs < now - 60 * 60 * 1000) {
      return { ok: false, reason: "PAST_SCHEDULE" };
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
