/**
 * Home returning-user priorities — presentation hierarchy (no new scoring).
 * Esegui: npx tsx --conditions=react-server scripts/verifica-home-returning.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyLinkedCampaignSuppression,
  buildMondayControlRoom,
  buildNativeAttentionItem,
} from "../src/lib/monday-control-room";
import { buildAllyOggiFallback } from "../src/lib/ally-oggi/fallback";
import { buildAllyOggiBriefContext } from "../src/lib/ally-oggi/build-context";
import {
  buildHomeDailySummaryCopy,
  partitionHomePriorities,
} from "../src/lib/home-priorities";
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
    daysActive: 8,
    spend: 100,
    resultsCount: 12,
    primaryCost: 34,
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
    threshold: 113,
    thresholdMode: null,
    source: "MANUAL",
    ...partial,
  };
}

const homeSrc = readFileSync(
  join(process.cwd(), "src/components/dashboard/DashboardHome.tsx"),
  "utf8",
);
const mondaySrc = readFileSync(
  join(process.cwd(), "src/components/dashboard/MondayControlRoomSection.tsx"),
  "utf8",
);
const briefSrc = readFileSync(
  join(process.cwd(), "src/components/dashboard/AllyOggiBrief.tsx"),
  "utf8",
);

console.log("\nHome returning-user refinement\n");

// Structural
assert(!homeSrc.includes("Ciao, sono Ally") || homeSrc.includes("isActiveWorkspace"), "returning path omits assistant badge");
assert(!homeSrc.includes("QUICK_ACTIONS"), "feature cards removed from Home");
assert(!homeSrc.includes("AllyFeatureCard"), "AllyFeatureCard unused on Home");
assert(!homeSrc.includes("Buongiorno"), "no duplicate Home greeting");
assert(homeSrc.includes("startMetaImportFlow"), "CASE F: Meta import preserved");
assert(homeSrc.includes("chooseMeta"), "CASE F: chooseMeta preserved");
assert(homeSrc.includes("Cerca") && homeSrc.includes("cliente"), "search kept");
assert(homeSrc.includes("HomeAskAllyBar"), "compact Chiedi ad Ally entry");
assert(
  homeSrc.includes("sm:flex-row sm:items-center") ||
    homeSrc.includes("Cerca cliente o campagna"),
  "returning search compact/inline",
);
assert(homeSrc.includes("max-w-[840px]"), "wider returning Home content");
assert(homeSrc.includes("totaleCheck > 0"), "empty activity gated");
assert(
  mondaySrc.includes("Vedi storico") &&
    !mondaySrc.includes("revisione storica"),
  "historical de-emphasized to secondary link",
);
assert(mondaySrc.includes("Da fare oggi"), "DA FARE OGGI section");
assert(mondaySrc.includes("Da monitorare"), "DA MONITORARE section");
assert(mondaySrc.includes("In preparazione"), "IN PREPARAZIONE section");
assert(mondaySrc.includes(">Oggi<") || mondaySrc.includes("Oggi"), "OGGI state summary");
assert(mondaySrc.includes("Da fare"), "summary Da fare label");
assert(mondaySrc.includes("daily.doNowCount"), "summary uses doNow count");
assert(mondaySrc.includes("daily.monitorCount"), "summary uses monitor count");
assert(mondaySrc.includes("daily.prepCount"), "summary uses prep count");
assert(!mondaySrc.includes("azione richiede"), "no action-count summary copy");
assert(!mondaySrc.includes("azioni richiedono"), "no plural action-count summary");
assert(mondaySrc.includes("Perché?"), "Perché? on cards");
assert(mondaySrc.includes("Prossima azione"), "Prossima azione integrated");
assert(mondaySrc.includes("Apri campagna"), "single open CTA");
assert(!mondaySrc.includes("AllyNextAction"), "no nested next-action card");
assert(!mondaySrc.includes("fetchCampaignDiagnosis"), "no diagnosis AI on Home cards");
assert(mondaySrc.includes("Vedi le campagne"), "drafts CTA to Campagne");
assert(mondaySrc.includes("flex-col gap-4"), "visible gap between section boxes");
assert(
  !mondaySrc.includes('className="aff-panel-white min-w-0 p-4 sm:p-5"'),
  "no giant outer Home priorities card",
);
assert(!briefSrc.includes("Leggi il briefing di Ally"), "AI briefing CTA removed");

// CASE A: revision must not say Nessuna urgenza
{
  const rev = campagna({
    id: "11111111-1111-4111-8111-111111111111",
    status: "REVISION_REQUESTED",
    nomeCliente: "Studio Dentistico Aurora",
  });
  const item = buildNativeAttentionItem({
    campagna: rev,
    check: null,
    checksForTrend: [],
  });
  const summary = buildMondayControlRoom([item]);
  const buckets = partitionHomePriorities(summary);
  const daily = buildHomeDailySummaryCopy({
    totalWorkspaceCampaigns: 1,
    buckets,
  });
  const fb = buildAllyOggiFallback(
    buildAllyOggiBriefContext({
      attentionItems: [item],
      nativeCampaigns: [rev],
      metaItems: [],
      linkedNativeIds: new Set(),
    }),
  );
  assert(buckets.doNow.length === 1, "CASE A: revision in Da fare oggi");
  assert(buckets.revisionCount === 1, "CASE A: revision counted");
  assert(daily.doNowCount === 1, `CASE A doNow count: ${daily.doNowCount}`);
  assert(daily.monitorCount === 0, "CASE A monitor count 0");
  assert(!/azione richiede|azioni richiedono/i.test(JSON.stringify(daily)), "CASE A no action-count language");
  assert(!/nessuna urgenza/i.test(fb.headline), `CASE A fallback: ${fb.headline}`);
}

// CASE B: 1 revision + 1 monitoring + 3 drafts
{
  const rev = campagna({
    id: "11111111-1111-4111-8111-111111111111",
    status: "REVISION_REQUESTED",
  });
  const mon = campagna({
    id: "22222222-2222-4222-8222-222222222222",
    status: "APPROVED",
    nomeCliente: "Studio Dentistico Aurora",
  });
  const drafts = [0, 1, 2].map((i) =>
    campagna({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, "0")}`,
      status: "DRAFT",
      nomeCliente: `Draft ${i}`,
    }),
  );
  const items = [
    buildNativeAttentionItem({
      campagna: rev,
      check: null,
      checksForTrend: [],
    }),
    buildNativeAttentionItem({
      campagna: mon,
      check: check({
        campaignId: mon.id,
        healthStatus: "YELLOW",
        primaryCost: 100,
        threshold: 113,
        resultsCount: 8,
      }),
      checksForTrend: [],
    }),
    ...drafts.map((c) =>
      buildNativeAttentionItem({
        campagna: c,
        check: null,
        checksForTrend: [],
      }),
    ),
  ];
  const summary = buildMondayControlRoom(
    applyLinkedCampaignSuppression(items, new Set()),
  );
  const buckets = partitionHomePriorities(summary);
  const daily = buildHomeDailySummaryCopy({
    totalWorkspaceCampaigns: 5,
    buckets,
  });
  assert(buckets.revisionCount === 1, "CASE B: 1 revision");
  assert(buckets.monitor.length === 1, "CASE B: 1 monitor");
  assert(buckets.draftCount === 3, "CASE B: 3 drafts");
  assert(buckets.doNow.length >= 1, "CASE B: doNow has revision");
  assert(daily.doNowCount === buckets.doNow.length, "CASE B summary Da fare matches");
  assert(daily.monitorCount === 1, "CASE B summary Da monitorare = 1");
  assert(daily.prepCount === 3, "CASE B summary In preparazione = 3");
  assert(/5 campagne totali/i.test(daily.secondaryLine ?? ""), `CASE B secondary: ${daily.secondaryLine}`);
  assert(!/azione richiede|azioni richiedono/i.test(JSON.stringify(daily)), "CASE B no action-count language");
}

// CASE C: drafts grouped — no individual draft expansion expected in partition UI contract
{
  const drafts = [0, 1, 2].map((i) =>
    campagna({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb${String(i).padStart(2, "0")}`,
      status: "DRAFT",
    }),
  );
  const items = drafts.map((c) =>
    buildNativeAttentionItem({
      campagna: c,
      check: null,
      checksForTrend: [],
    }),
  );
  const buckets = partitionHomePriorities(buildMondayControlRoom(items));
  assert(buckets.draftCount === 3, "CASE C: draft count");
  assert(buckets.doNow.length === 0, "CASE C: drafts not in Da fare oggi");
  assert(
    mondaySrc.includes("campagne in preparazione") ||
      mondaySrc.includes("campagna in preparazione"),
    "CASE C: grouped prep copy in UI",
  );
  assert(
    !mondaySrc.includes("La campagna è ancora in bozza") ||
      mondaySrc.includes("In preparazione"),
    "CASE C: prep section present",
  );
}

// CASE D: nothing actionable
{
  const c = campagna({
    id: "33333333-3333-4333-8333-333333333333",
    status: "APPROVED",
  });
  const item = buildNativeAttentionItem({
    campagna: c,
    check: check({
      campaignId: c.id,
      healthStatus: "GREEN",
      primaryCost: 20,
      resultsCount: 20,
      createdAt: "2026-09-01T12:00:00Z",
    }),
    checksForTrend: [
      check({
        campaignId: c.id,
        healthStatus: "GREEN",
        primaryCost: 22,
        resultsCount: 10,
        createdAt: "2026-08-20T12:00:00Z",
      }),
      check({
        campaignId: c.id,
        healthStatus: "GREEN",
        primaryCost: 20,
        resultsCount: 20,
        createdAt: "2026-09-01T12:00:00Z",
      }),
    ],
  });
  const buckets = partitionHomePriorities(buildMondayControlRoom([item]));
  const daily = buildHomeDailySummaryCopy({
    totalWorkspaceCampaigns: 1,
    buckets,
  });
  assert(buckets.actionableCount === 0, "CASE D: no actionable");
  assert(
    buckets.doNow.length === 0,
    "CASE D: nothing in Da fare oggi",
  );
  assert(daily.doNowCount === 0, "CASE D summary Da fare = 0");
  assert(daily.monitorCount === 0 || buckets.monitor.length === daily.monitorCount, "CASE D monitor consistent");
  assert(
    /1 campagna totale/i.test(daily.secondaryLine ?? "") || buckets.stable.length === 1,
    `CASE D secondary: ${daily.secondaryLine}`,
  );
}

// CASE E: monitoring keeps next-action path via AttentionRow
{
  assert(mondaySrc.includes("Prossima azione"), "CASE E: next action block");
  assert(mondaySrc.includes("resolveNextAction"), "CASE E: uses next-action resolver");
}

if (falliti > 0) {
  console.error(`\n${falliti} check falliti`);
  process.exit(1);
}
console.log("\nHOME RETURNING-USER CHECKS OK\n");
