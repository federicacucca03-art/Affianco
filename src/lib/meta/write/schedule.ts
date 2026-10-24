/**
 * M11A.1/M11A.2 — Schedule normalization against ad account timezone.
 * Browser/server local TZ are never write authority.
 * Historical / past starts block write until user updates.
 */

/** User explicitly chose scheduling (vs stale implicit start from an old preview). */
export function isSchedulingExplicitlyEnabled(input: {
  startAtIso: string | null;
  endAtIso: string | null;
  nowMs?: number;
}): boolean {
  const end = input.endAtIso?.trim() || null;
  const start = input.startAtIso?.trim() || null;
  if (end) return true;
  if (!start) return false;
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return false;
  const now = input.nowMs ?? Date.now();
  return startMs >= now - 60 * 60 * 1000;
}

/**
 * PAUSED create: optional schedule. Drop stale past start-only rows that were never
 * an explicit bounded window (end absent). Explicit past schedules are kept for PAST_SCHEDULE.
 */
export function stripImplicitStaleSchedule(input: {
  startAtIso: string | null;
  endAtIso: string | null;
  nowMs?: number;
}): {
  startAtIso: string | null;
  endAtIso: string | null;
  clearedStale: boolean;
} {
  const start = input.startAtIso?.trim() || null;
  const end = input.endAtIso?.trim() || null;
  if (!start && !end) {
    return { startAtIso: null, endAtIso: null, clearedStale: false };
  }
  if (isSchedulingExplicitlyEnabled({ startAtIso: start, endAtIso: end, nowMs: input.nowMs })) {
    return { startAtIso: start, endAtIso: end, clearedStale: false };
  }
  return { startAtIso: null, endAtIso: null, clearedStale: true };
}

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
 * Meta PAUSED create: start_time / end_time are optional on the Graph payload.
 * Both absent + timezone present → ok (unscheduled / continuous; no invented dates).
 * End without start → MISSING_SCHEDULE.
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

  // Optional for PAUSED create — Graph omits start_time/end_time when unset.
  if (!start && !end) {
    return {
      ok: true,
      startTime: null,
      endTime: null,
      continuous: true,
    };
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
    continuous: Boolean(start && !end) || (!start && !end),
  };
}
