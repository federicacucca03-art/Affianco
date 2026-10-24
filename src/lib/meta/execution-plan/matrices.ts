/**
 * ADV.2.1 — Static execution capability matrices (from code audit, not UI labels).
 * LIVE META WRITES: 0
 */

export type MatrixSupport =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "NOT_SUPPORTED"
  | "UNRESOLVED"
  | "PLAN_ONLY";

export const OBJECTIVE_EXECUTION_MATRIX = [
  {
    canonical: "AWARENESS",
    meta: "OUTCOME_AWARENESS",
    payloadSupport: "PLAN_ONLY" as MatrixSupport,
    preflightSupport: "SUPPORTED" as MatrixSupport,
    writeBuilderSupport: "PARTIALLY_SUPPORTED" as MatrixSupport,
    note: "REACH via conversion-resolver; dry-run plan only in ADV.2.1",
  },
  {
    canonical: "TRAFFIC",
    meta: "OUTCOME_TRAFFIC",
    payloadSupport: "PLAN_ONLY" as MatrixSupport,
    preflightSupport: "SUPPORTED" as MatrixSupport,
    writeBuilderSupport: "PARTIALLY_SUPPORTED" as MatrixSupport,
    note: "LINK_CLICKS / LANDING_PAGE_VIEWS in matrix; LPV honored from V2 intent",
  },
  {
    canonical: "ENGAGEMENT",
    meta: "OUTCOME_ENGAGEMENT",
    payloadSupport: "PLAN_ONLY" as MatrixSupport,
    preflightSupport: "PARTIALLY_SUPPORTED" as MatrixSupport,
    writeBuilderSupport: "PARTIALLY_SUPPORTED" as MatrixSupport,
    note: "CONVERSATIONS / WhatsApp path via destination WHATSAPP",
  },
  {
    canonical: "LEADS",
    meta: "OUTCOME_LEADS",
    payloadSupport: "SUPPORTED" as MatrixSupport,
    preflightSupport: "SUPPORTED" as MatrixSupport,
    writeBuilderSupport: "SUPPORTED" as MatrixSupport,
    note: "Instant Form is current Easy write path",
  },
  {
    canonical: "APP_PROMOTION",
    meta: "OUTCOME_APP_PROMOTION",
    payloadSupport: "PLAN_ONLY" as MatrixSupport,
    preflightSupport: "PARTIALLY_SUPPORTED" as MatrixSupport,
    writeBuilderSupport: "NOT_SUPPORTED" as MatrixSupport,
    note: "Requires real app id; blocks when unresolved",
  },
  {
    canonical: "SALES",
    meta: "OUTCOME_SALES",
    payloadSupport: "PLAN_ONLY" as MatrixSupport,
    preflightSupport: "SUPPORTED" as MatrixSupport,
    writeBuilderSupport: "PARTIALLY_SUPPORTED" as MatrixSupport,
    note: "OFFSITE_CONVERSIONS + PURCHASE; Pixel required; no LEADS fallback",
  },
] as const;

export const DESTINATION_EXECUTION_MATRIX = [
  { dest: "WEBSITE", status: "PARTIALLY_SUPPORTED" as MatrixSupport, note: "Sales/Traffic/Leads website via resolver" },
  { dest: "INSTANT_FORM", status: "SUPPORTED" as MatrixSupport, note: "META_LEAD_FORM Easy path" },
  { dest: "MESSAGING", status: "NOT_SUPPORTED" as MatrixSupport, note: "No Graph dest without channel" },
  { dest: "WHATSAPP", status: "PARTIALLY_SUPPORTED" as MatrixSupport, note: "CONVERSATIONS + WHATSAPP_MESSAGE CTA" },
  { dest: "PHONE", status: "PARTIALLY_SUPPORTED" as MatrixSupport, note: "QUALITY_CALL + CALL_NOW" },
  { dest: "APP", status: "PLAN_ONLY" as MatrixSupport, note: "APP_ID_REQUIRED when unresolved" },
] as const;

export const PLACEMENT_EXECUTION_MATRIX = [
  {
    mode: "ADVANTAGE_PLUS",
    status: "SUPPORTED" as MatrixSupport,
    note: "resolveWritePlacements ok — no publisher_platforms array",
  },
  {
    mode: "MANUAL",
    status: "NOT_SUPPORTED" as MatrixSupport,
    note: "MANUAL_UNSUPPORTED in write placements; design preserved as blocker",
  },
  {
    mode: "Facebook Feed / IG Stories (manual surfaces)",
    status: "NOT_SUPPORTED" as MatrixSupport,
    note: "UI history only — not Graph-writable today",
  },
] as const;

export const CTA_EXECUTION_MATRIX = [
  { destination: "META_LEAD_FORM", type: "SIGN_UP", labelIt: "Iscriviti" },
  { destination: "WEBSITE", type: "LEARN_MORE", labelIt: "Scopri di più" },
  { destination: "WHATSAPP", type: "WHATSAPP_MESSAGE", labelIt: "WhatsApp" },
  { destination: "PHONE", type: "CALL_NOW", labelIt: "Chiama ora" },
] as const;

export const AUDIENCE_EXECUTION_MATRIX = [
  { kind: "BROAD", status: "SUPPORTED" as MatrixSupport },
  { kind: "ADVANTAGE_PLUS", status: "SUPPORTED" as MatrixSupport },
  { kind: "MANUAL", status: "PARTIALLY_SUPPORTED" as MatrixSupport, note: "No Brand Brain→interests" },
  { kind: "CUSTOM_AUDIENCE_INTENT", status: "UNRESOLVED" as MatrixSupport, note: "Needs resolvedMetaAudienceId" },
  { kind: "LOOKALIKE_INTENT", status: "UNRESOLVED" as MatrixSupport, note: "No LAL create in ADV.2.1" },
] as const;

export const TRACKING_EXECUTION_MATRIX = [
  { path: "LEADS Instant Form", requirement: "REQUIRED_INSTANT_FORM", status: "SUPPORTED" as MatrixSupport },
  { path: "SALES Website Purchase", requirement: "REQUIRED_WEBSITE_PIXEL", status: "UNRESOLVED" as MatrixSupport },
  { path: "TRAFFIC Website", requirement: "OPTIONAL", status: "SUPPORTED" as MatrixSupport },
  { path: "AWARENESS", requirement: "OPTIONAL", status: "SUPPORTED" as MatrixSupport },
  { path: "APP", requirement: "APP_ID_REQUIRED", status: "UNRESOLVED" as MatrixSupport },
] as const;

export const IDENTITY_REQUIREMENT_MATRIX = [
  { path: "Instant Form", page: "REQUIRED", instagram: "OPTIONAL", form: "REQUIRED" },
  { path: "Website Sales/Traffic", page: "REQUIRED", instagram: "OPTIONAL", form: "NOT_REQUIRED" },
  { path: "WhatsApp", page: "REQUIRED", instagram: "OPTIONAL", form: "NOT_REQUIRED" },
  { path: "Awareness", page: "OPTIONAL", instagram: "OPTIONAL", form: "NOT_REQUIRED" },
] as const;

export const EXECUTION_DEPENDENCY_GRAPH = [
  "Campaign",
  "→ Ad Sets",
  "→ Creative assets / creatives",
  "→ Ads",
] as const;

export const IDEMPOTENCY_READINESS = {
  status: "DESIGNED" as const,
  note: "operationKeys ally.op.{campaign|adset|creative|ad}.{ids} — no retry execution yet",
};

export const LEGACY_EXECUTION_PATHS = [
  { path: "src/lib/meta/write/preview.ts + execute.ts", class: "CURRENT" as const },
  { path: "src/lib/meta/write/instant-form-builder.ts", class: "CURRENT" as const },
  { path: "src/lib/meta/publish/*", class: "CURRENT" as const },
  { path: "src/lib/meta/write/conversion-resolver.ts", class: "CURRENT" as const },
  { path: "src/lib/meta/execution-plan/*", class: "CURRENT" as const },
  { path: "src/lib/meta/guided-plan/*", class: "COMPATIBILITY" as const },
  { path: "legacy Technon historical objective remaps", class: "DEAD" as const },
] as const;
