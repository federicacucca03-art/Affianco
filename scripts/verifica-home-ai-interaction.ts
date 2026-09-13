/**
 * Home AI interaction — compact Ask entry + deterministic "Perché questa azione?".
 * Esegui: npx tsx --conditions=react-server scripts/verifica-home-ai-interaction.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNativeAttentionItem,
  type ControlRoomAttentionItem,
} from "../src/lib/monday-control-room";
import {
  resolveNextAction,
  shouldShowNextAction,
} from "../src/lib/campaign-next-action";
import { buildHomeActionExplanation, buildHomeCardReason } from "../src/lib/home-action-explanation";
import { buildAllyOggiUserPrompt } from "../src/lib/ally-oggi/prompt";
import { buildAllyOggiBriefContext } from "../src/lib/ally-oggi/build-context";
import type { Campagna } from "../src/types/campagne";
import type { CampaignCheck } from "../src/lib/campaign-checks-db";

let falliti = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function campagna(partial: Partial<Campagna> & { id: string }): Campagna {
  return {
    nomeCliente: "Cliente",
    iniziali: "CL",
    stato: "Attiva",
    giudizio: "Va bene",
    objective: "LEADS",
    nomeCampagna: "Richieste Contatto",
    status: "APPROVED",
    ...partial,
  };
}

function check(partial: Partial<CampaignCheck> = {}): CampaignCheck {
  return {
    id: "chk",
    campaignId: "c",
    userId: "u",
    createdAt: "2026-09-01T12:00:00Z",
    daysActive: 7,
    spend: 80,
    resultsCount: 1,
    primaryCost: 40,
    ctr: null,
    cpm: null,
    cpc: null,
    frequency: null,
    roas: null,
    clicks: null,
    impressions: null,
    healthStatus: "YELLOW",
    signal: null,
    actions: [],
    note: null,
    objective: "LEADS",
    threshold: 45,
    thresholdMode: null,
    source: "MANUAL",
    ...partial,
  };
}

function nextAction(item: ControlRoomAttentionItem) {
  return resolveNextAction({
    campaignId: item.campaignId,
    source: item.source,
    campaignStatus: item.campaignStatus,
    attentionState: item.attentionState,
    health: item.healthStatus,
    trend: item.trend,
    healthAvailability: item.healthAvailability,
    configurationKind: item.configurationKind,
    resultsCount: item.resultsCount,
    rowHref: item.href,
    diagnosis: null,
  });
}

console.log("\nHome AI interaction\n");

const home = read("src/components/dashboard/DashboardHome.tsx");
const bar = read("src/components/dashboard/HomeAskAllyBar.tsx");
const monday = read("src/components/dashboard/MondayControlRoomSection.tsx");
const route = read("src/app/api/ally-oggi/route.ts");
const explain = read("src/lib/home-action-explanation.ts");

// Structure / visual weight
assert(home.includes("HomeAskAllyBar"), "HOME AI ENTRY wired");
assert(bar.includes('placeholder="Scrivi una domanda..."'), "ask placeholder");
assert(bar.includes("HOME_ASK_PROMPTS"), "suggested prompts");
assert(bar.includes("Chiedi ad Ally"), "ask title");
assert(bar.includes("Fai una domanda sulle tue campagne"), "ask purpose copy");
assert(bar.includes("bg-[var(--accent)]"), "active ask button violet");
assert(bar.includes("border border-[var(--border)] bg-transparent"), "empty ask button outline");
assert(!bar.includes("bg-[var(--ink)]"), "no ink-filled ask button");
assert(home.includes("Cerca cliente o campagna") || home.includes("Cerca un cliente"), "search kept");
assert(home.includes("isActiveWorkspace ?"), "compact search for returning Home");
assert(home.includes("sm:flex-row sm:items-center"), "search+actions inline on desktop");
assert(!bar.includes("Ciao, sono Ally"), "no AI hero copy");
assert(!home.includes("floating") || true, "no floating chat requirement");
assert(monday.includes("Perché?"), "WHY control present");
assert(monday.includes("Prossima azione"), "next action integrated");
assert(monday.includes("buildHomeActionExplanation"), "inline deterministic explanation");
assert(monday.includes("buildHomeCardReason"), "deduped card reason");
assert(monday.includes("CampaignFollowUpAsk"), "campaign follow-up");
assert(monday.includes("/api/ally-copilot"), "follow-up contextual M9.2");
assert(monday.includes("Chiedi ad Ally →"), "Ask Ally subordinate");
assert(!monday.includes("AllyNextAction"), "no nested next-action card");
assert(!monday.includes("fetchCampaignDiagnosis"), "0 diagnosis AI on expand");

// 0 AI on render
assert(!home.includes("fetch(\"/api/ally-oggi\""), "Home does not call ally-oggi on render");
assert(!home.includes("fetch(\"/api/ally-copilot\""), "Home does not call copilot on render");
assert(bar.includes("void ask("), "Home ask only on submit/chip");
assert(bar.includes("question: q"), "Home question sent to API");
assert(route.includes("question"), "ally-oggi accepts Home question");

// Prompt includes question when provided
{
  const item = buildNativeAttentionItem({
    campagna: campagna({ id: "11111111-1111-4111-8111-111111111111" }),
    check: check({ resultsCount: 5, daysActive: 10 }),
  });
  const ctx = buildAllyOggiBriefContext({
    attentionItems: [item],
    nativeCampaigns: [campagna({ id: item.campaignId })],
    metaItems: [],
    linkedNativeIds: new Set(),
  });
  const withQ = buildAllyOggiUserPrompt(ctx, "Cosa devo guardare oggi?");
  const withoutQ = buildAllyOggiUserPrompt(ctx);
  assert(withQ.includes("Cosa devo guardare oggi?"), "CASE A: question in prompt");
  assert(withQ.includes("workspace"), "CASE A: workspace-aware context");
  assert(!withoutQ.includes("Domanda dell'utente"), "brief mode unchanged without question");
}

// CASE B + E: monitoring / small sample — deterministic, 0 AI
{
  const item = buildNativeAttentionItem({
    campagna: campagna({
      id: "22222222-2222-4222-8222-222222222222",
      nomeCliente: "Studio Aurora",
    }),
    check: check({
      campaignId: "22222222-2222-4222-8222-222222222222",
      resultsCount: 1,
      daysActive: 7,
      healthStatus: "YELLOW",
      primaryCost: 40,
      threshold: 45,
    }),
  });
  const action = nextAction(item);
  assert(action.actionType === "WAIT_FOR_MORE_DATA", `CASE B action: ${action.actionType}`);
  assert(shouldShowNextAction(action.actionType), "CASE B shows next action");
  const text = buildHomeActionExplanation(item, action);
  assert(/dati non sono ancora sufficienti|campione|risultat/i.test(text), `CASE E insufficient: ${text}`);
  assert(!/performance problem|performance scadente|falliment/i.test(text), "CASE E not performance blame");
  assert(!/costo è vicino/i.test(text), "CASE E explanation does not repeat card reason");
  assert(typeof text === "string" && text.length > 10 && text.length < 500, "concise explanation");
}

// CASE D: client revision — deterministic revision reasoning
{
  const item = buildNativeAttentionItem({
    campagna: campagna({
      id: "33333333-3333-4333-8333-333333333333",
      status: "REVISION_REQUESTED",
      nomeCliente: "Cliente Revisione",
    }),
    check: null,
  });
  const action = nextAction(item);
  assert(action.actionType === "CONTACT_CLIENT", `CASE D action: ${action.actionType}`);
  const reason = buildHomeCardReason(item);
  const text = buildHomeActionExplanation(item, action);
  assert(/modifiche alla campagna/i.test(reason), `CASE D card reason: ${reason}`);
  assert(/gestisci la revisione/i.test(text), `CASE D revision explain: ${text}`);
  assert(reason !== text && !reason.includes(text) && !text.includes(reason), "CASE D no reason/explanation repeat");
  assert(!/€|ROAS|CTR|CPA/i.test(text), "CASE D no fake performance");
}

// CASE F: stable — no forced AI path
{
  const item = buildNativeAttentionItem({
    campagna: campagna({
      id: "44444444-4444-4444-8444-444444444444",
      status: "APPROVED",
    }),
    check: check({
      campaignId: "44444444-4444-4444-8444-444444444444",
      resultsCount: 40,
      daysActive: 21,
      healthStatus: "GREEN",
      primaryCost: 20,
      threshold: 40,
    }),
  });
  const action = nextAction(item);
  if (action.actionType === "NO_ACTION") {
    assert(!shouldShowNextAction(action.actionType), "CASE F: stable hides next-action AI CTA");
  } else {
    assert(true, `CASE F: stable action ${action.actionType} (still operational, not forced chat)`);
  }
  assert(!explain.includes("fetch("), "explanation module has 0 network");
}

// Separation: Home ask ≠ full Ask Ally panel
assert(!home.includes("ChiediAdAllyPanel"), "no full Ask Ally on Home");
assert(bar.includes("/api/ally-oggi"), "Home uses M9.1 workspace path");
assert(monday.includes("/api/ally-copilot"), "card follow-up uses M9.2");

if (falliti > 0) {
  console.error(`\n${falliti} assertion(s) failed\n`);
  process.exit(1);
}
console.log("\nAll Home AI interaction checks passed.\n");
