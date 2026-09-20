/**
 * Campagne inventory-first page — presentation regression.
 * Esegui: npx tsx --conditions=react-server scripts/verifica-campagne-inventory.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInventarioRighe,
  buildInventarioSummary,
  filterInventarioRighe,
  resolveInventarioCtaLabel,
  resolveInventarioStatoMeta,
  resolveInventarioStatoNative,
  type InventarioRiga,
} from "../src/lib/campagne-inventory-ui";
import type { Campagna } from "../src/types/campagne";
import type { MetaCampaignMonitoringRow } from "../src/lib/meta/meta-campaign-monitoring-row";

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

function baseNative(overrides: Partial<Campagna> = {}): Campagna {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nomeCliente: "Cliente",
    iniziali: "CL",
    stato: "Bozza",
    giudizio: "Ancora presto",
    objective: "LEADS",
    nomeCampagna: "Cliente - Richieste Contatto - Agosto 2026",
    status: "DRAFT",
    ...overrides,
  };
}

function baseMeta(
  overrides: Partial<MetaCampaignMonitoringRow> = {},
): MetaCampaignMonitoringRow {
  return {
    id: "meta-row-1",
    clientId: "client-1",
    clientName: "Technon",
    metaCampaignId: "120000",
    name: "[B2B Lead Gen] 3M VHB - Test 100€",
    effectiveStatus: "PAUSED",
    rawObjective: "OUTCOME_LEADS",
    lastSyncedAt: null,
    insightsPeriodSince: null,
    insightsPeriodUntil: null,
    insightsLastSyncedAt: null,
    spend: 99.97,
    impressions: 1000,
    linkClicks: 50,
    ctr: 2.87,
    cpc: 0.24,
    cpm: null,
    frequency: null,
    primaryResults: null,
    primaryKpi: null,
    targetValue: null,
    storedPrimaryKpi: null,
    storedTargetValue: null,
    targetSource: "NONE",
    linkState: "UNLINKED",
    linkedCampaignId: null,
    linkedCampaignName: null,
    mode: "HISTORICAL_REVIEW",
    healthAvailability: "AVAILABLE",
    healthStatus: "GREEN",
    ...overrides,
  };
}

console.log("\n=== CAMPAGNE INVENTORY ===\n");

const page = read("src/app/campagne/page.tsx");
const nuova = read("src/app/campagne/nuova/page.tsx");
const lista = read("src/components/ListaCampagne.tsx");
const riga = read("src/components/RigaCampagna.tsx");
const ui = read("src/lib/campagne-inventory-ui.ts");
const sidebar = read("src/components/shell/SecondarySidebar.tsx");
const inventoryLoader = read("src/lib/campagne-inventory.ts");

assert(!page.includes("BannerHero"), "inventory page has no create hero");
assert(!page.includes("CreaCampagnaConCliente"), "inventory page has no create wizard");
assert(!page.includes("Da dove vuoi partire"), "no create headline on inventory");
assert(page.includes("Gestisci tutte le campagne"), "inventory support copy");
assert(page.includes("/campagne/nuova"), "Nuova campagna links to create page");
assert(page.includes("startMetaImportFlow"), "Importa da Meta preserved");

assert(nuova.includes("BannerHero"), "create page keeps BannerHero");
assert(nuova.includes("CreaCampagnaConCliente"), "create page keeps brief+objectives");

assert(lista.includes("leggiInventarioCampagneNative"), "Supabase native inventory");
assert(!lista.includes("getCampaigns"), "no localStorage inventory");
assert(inventoryLoader.includes("leggiCampagneDaSupabase"), "canonical native loader");
assert(
  inventoryLoader.includes("never browser localStorage") ||
    inventoryLoader.includes("never localStorage"),
  "inventory loader documents no localStorage authority",
);
assert(!inventoryLoader.includes("localStorage.getItem"), "no localStorage.getItem in loader");
assert(!inventoryLoader.includes("getCampaigns"), "no getCampaigns in loader");
assert(lista.includes("Cerca campagna o cliente"), "search");
assert(lista.includes("Filtra per cliente") || lista.includes("Cliente"), "client filter");
assert(lista.includes("Filtra per stato") || lista.includes("Stato"), "status filter");
assert(lista.includes("Origine"), "origin filter");
assert(lista.includes("Ally + Meta"), "Ally + Meta origin option");
assert(lista.includes("loadMetaMondayBundle"), "Meta rows from canonical loader");
assert(lista.includes("Non hai ancora campagne"), "empty state copy");
assert(lista.includes("/campagne/nuova"), "empty state Nuova campagna");
assert(lista.includes("Storico"), "historical secondary section");
assert(lista.includes("Non riesco a caricare"), "error state copy");

assert(riga.includes("RigaCampagnaInventario"), "inventory row component");
assert(riga.includes("ctaLabel") || riga.includes("Prossimo passo"), "CTA / next action");
assert(ui.includes("In attesa di approvazione"), "clear approval-pending label");
assert(ui.includes("Bozza"), "draft label");
assert(ui.includes("Revisione richiesta"), "revision label");
assert(ui.includes("Attiva su Meta"), "Meta ACTIVE label");
assert(ui.includes("In pausa su Meta"), "Meta PAUSED label");
assert(!ui.includes('label: "Stabile"'), "no performance Stabile label in Meta status");
assert(!ui.includes("healthStatus"), "Meta inventory status ignores health");
assert(sidebar.includes("/campagne/nuova"), "sidebar Nuova campagna → create page");

// CASE A–D Ally workflow
{
  const a = resolveInventarioStatoNative(baseNative({ status: "DRAFT" }));
  assert(a.label === "Bozza" && a.chiave === "DRAFT", `CASE A draft: ${a.label}`);
  assert(a.label !== "In attesa di approvazione", "CASE A draft ≠ awaiting");

  const b = resolveInventarioStatoNative(
    baseNative({ status: "DRAFT", approvalToken: "tok-abc" }),
  );
  assert(
    b.label === "In attesa di approvazione" && b.chiave === "APPROVAL_PENDING",
    `CASE B pending: ${b.label}`,
  );

  const c = resolveInventarioStatoNative(
    baseNative({ status: "REVISION_REQUESTED", approvalToken: undefined }),
  );
  assert(
    c.label === "Revisione richiesta" && c.chiave === "REVISION",
    `CASE C revision: ${c.label}`,
  );

  const d = resolveInventarioStatoNative(baseNative({ status: "APPROVED" }));
  assert(
    d.label === "Approvata" && d.chiave === "APPROVED",
    `CASE D approved: ${d.label}`,
  );
}

// CASE E–F Meta delivery (not performance)
{
  const paused = resolveInventarioStatoMeta(
    baseMeta({ effectiveStatus: "PAUSED", healthStatus: "GREEN" }),
  );
  assert(
    paused.label === "In pausa su Meta" && paused.chiave === "META_PAUSED",
    `CASE E PAUSED: ${paused.label}`,
  );
  assert(paused.historical === true, "CASE E PAUSED → historical section");

  const active = resolveInventarioStatoMeta(
    baseMeta({
      effectiveStatus: "ACTIVE",
      mode: "ACTIVE_MONITORING",
      healthStatus: "RED",
    }),
  );
  assert(
    active.label === "Attiva su Meta" && active.chiave === "META_ACTIVE",
    `CASE F ACTIVE: ${active.label}`,
  );
  assert(
    active.label !== "Da controllare" && active.label !== "Stabile",
    "CASE F Meta status ≠ performance",
  );
}

// CASE G linked Ally + Meta → no duplicate
{
  const nativeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ally = baseNative({
    id: nativeId,
    nomeCliente: "Studio",
    nomeCampagna: "Campagna collegata",
    status: "APPROVED",
  });
  const meta = baseMeta({
    id: "meta-linked",
    name: "Campagna collegata Meta",
    linkState: "LINKED",
    linkedCampaignId: nativeId,
    effectiveStatus: "ACTIVE",
    mode: "ACTIVE_MONITORING",
  });
  const rows = buildInventarioRighe({
    native: [
      {
        campagna: ally,
        linkedToMeta: true,
        nextActionTitle: null,
        objectiveLabel: "Leads",
        periodLabel: null,
      },
    ],
    meta: [{ row: meta, nextActionTitle: null }],
  });
  assert(rows.length === 1, `CASE G single row: ${rows.length}`);
  assert(rows[0].origine === "ALLY_META", `CASE G origin: ${rows[0].origine}`);
  assert(rows[0].sourceLabel === "Ally + Meta", `CASE G label: ${rows[0].sourceLabel}`);
  assert(!rows.some((r) => r.id.startsWith("meta-")), "CASE G no separate Meta row");
}

// CASE H similar names, no link → separate
{
  const a = baseNative({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    nomeCampagna: "Aurora Contatti",
    nomeCliente: "Aurora",
  });
  const b = baseNative({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    nomeCampagna: "Aurora Contatti",
    nomeCliente: "Aurora",
  });
  const meta = baseMeta({
    id: "meta-similar",
    name: "Aurora Contatti",
    clientName: "Aurora",
    linkState: "UNLINKED",
    linkedCampaignId: null,
    effectiveStatus: "PAUSED",
  });
  const rows = buildInventarioRighe({
    native: [
      {
        campagna: a,
        linkedToMeta: false,
        nextActionTitle: null,
        objectiveLabel: null,
        periodLabel: null,
      },
      {
        campagna: b,
        linkedToMeta: false,
        nextActionTitle: null,
        objectiveLabel: null,
        periodLabel: null,
      },
    ],
    meta: [{ row: meta, nextActionTitle: null }],
  });
  assert(rows.length === 3, `CASE H three separate rows: ${rows.length}`);
}

assert(ui.includes("etichettaMetaObjectiveUtente"), "uses canonical Meta objective mapper");
assert(!ui.includes("objectiveLabel: row.rawObjective"), "never assign raw Meta objective to label");

// CASE I Technon real imported campaign included
{
  const technon = baseMeta();
  const rows = buildInventarioRighe({
    native: [],
    meta: [{ row: technon, nextActionTitle: null }],
  });
  assert(rows.length === 1, "CASE I Technon included");
  assert(
    rows[0].title.includes("3M VHB"),
    `CASE I title: ${rows[0].title}`,
  );
  assert(rows[0].clientName === "Technon", "CASE I client Technon");
  assert(rows[0].origine === "META", "CASE I origin Meta");
  assert(rows[0].sourceLabel === "Meta", "CASE I source label Meta");
  assert(
    rows[0].statoLabel === "In pausa su Meta",
    `CASE I status: ${rows[0].statoLabel}`,
  );
  assert(rows[0].objectiveLabel === "Contatti", `CASE I objective: ${rows[0].objectiveLabel}`);
  assert(rows[0].objectiveLabel !== "OUTCOME_LEADS", "CASE I no raw OUTCOME_LEADS");
  assert(rows[0].href.includes("campaignId="), "CASE I stable id route");
  assert(rows[0].ctaLabel === "Apri risultati", "CASE I CTA Apri risultati");
  assert(rows[0].historical === true, "CASE I Storico grouping");
}

// CASE objective labels — raw Meta enums never surface
{
  const cases: { raw: string; expected: string }[] = [
    { raw: "OUTCOME_LEADS", expected: "Contatti" },
    { raw: "OUTCOME_SALES", expected: "Vendite" },
    { raw: "OUTCOME_TRAFFIC", expected: "Traffico" },
    { raw: "OUTCOME_AWARENESS", expected: "Notorietà" },
  ];
  for (const c of cases) {
    const rows = buildInventarioRighe({
      native: [],
      meta: [
        {
          row: baseMeta({
            id: `meta-obj-${c.raw}`,
            rawObjective: c.raw,
            effectiveStatus: "ACTIVE",
            mode: "ACTIVE_MONITORING",
          }),
          nextActionTitle: null,
        },
      ],
    });
    assert(
      rows[0].objectiveLabel === c.expected,
      `objective ${c.raw} → ${rows[0].objectiveLabel} (want ${c.expected})`,
    );
    assert(
      !(rows[0].objectiveLabel ?? "").includes("OUTCOME_"),
      `no OUTCOME_ leak for ${c.raw}`,
    );
  }
  // ENGAGEMENT: mapper must never leak raw enum (label via canonical mapper)
  {
    const rows = buildInventarioRighe({
      native: [],
      meta: [
        {
          row: baseMeta({
            id: "meta-obj-ENGAGEMENT",
            rawObjective: "OUTCOME_ENGAGEMENT",
            effectiveStatus: "ACTIVE",
            mode: "ACTIVE_MONITORING",
          }),
          nextActionTitle: null,
        },
      ],
    });
    assert(
      rows[0].objectiveLabel !== "OUTCOME_ENGAGEMENT",
      "OUTCOME_ENGAGEMENT not raw",
    );
    assert(
      !(rows[0].objectiveLabel ?? "").includes("OUTCOME_"),
      "no OUTCOME_ leak for ENGAGEMENT",
    );
    assert(
      rows[0].objectiveLabel === "Interazioni" ||
        rows[0].objectiveLabel === "Notorietà",
      `ENGAGEMENT human label: ${rows[0].objectiveLabel}`,
    );
  }
}

// Structural: inventory UI module must not emit raw OUTCOME_* as labels
{
  const sample = buildInventarioRighe({
    native: [],
    meta: [
      { row: baseMeta({ rawObjective: "OUTCOME_LEADS" }), nextActionTitle: null },
      { row: baseMeta({ id: "m2", rawObjective: "OUTCOME_SALES" }), nextActionTitle: null },
      { row: baseMeta({ id: "m3", rawObjective: "OUTCOME_TRAFFIC" }), nextActionTitle: null },
      { row: baseMeta({ id: "m4", rawObjective: "OUTCOME_AWARENESS" }), nextActionTitle: null },
      { row: baseMeta({ id: "m5", rawObjective: "OUTCOME_ENGAGEMENT" }), nextActionTitle: null },
    ],
  });
  const leaked = sample.filter((r) =>
    /OUTCOME_[A-Z_]+/.test(r.objectiveLabel ?? ""),
  );
  assert(leaked.length === 0, `RAW META OBJECTIVE ENUMS IN INVENTORY: ${leaked.length}`);
}

// CASE J filters/search
{
  const rows: InventarioRiga[] = buildInventarioRighe({
    native: [
      {
        campagna: baseNative({
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          nomeCliente: "X",
          nomeCampagna: "Ally draft",
          status: "DRAFT",
        }),
        linkedToMeta: false,
        nextActionTitle: null,
        objectiveLabel: "Leads",
        periodLabel: null,
      },
    ],
    meta: [
      {
        row: baseMeta({ id: "meta-j", clientName: "Technon" }),
        nextActionTitle: null,
      },
    ],
  });
  const byOrigin = filterInventarioRighe(rows, {
    query: "",
    cliente: "",
    stato: "",
    origine: "META",
  });
  assert(byOrigin.length === 1 && byOrigin[0].origine === "META", "CASE J origin Meta");
  const byClient = filterInventarioRighe(rows, {
    query: "",
    cliente: "Technon",
    stato: "",
    origine: "",
  });
  assert(byClient.length === 1, "CASE J client filter");
  const bySearch = filterInventarioRighe(rows, {
    query: "vhb",
    cliente: "",
    stato: "",
    origine: "",
  });
  assert(bySearch.length === 1, "CASE J search");
  const byStato = filterInventarioRighe(rows, {
    query: "",
    cliente: "",
    stato: "DRAFT",
    origine: "",
  });
  assert(byStato.length === 1 && byStato[0].statoChiave === "DRAFT", "CASE J status");
  const summary = buildInventarioSummary(rows);
  assert(summary.totale === rows.length, "CASE J summary totale matches set");
}

// CASE K zero campaigns → empty inventory shape
{
  const rows = buildInventarioRighe({ native: [], meta: [] });
  assert(rows.length === 0, "CASE K empty inventory");
  assert(lista.includes("Non hai ancora campagne"), "CASE K empty UI copy");
  assert(lista.includes("Importa da Meta"), "CASE K empty Import CTA");
}

// CASE L error ≠ fake empty
{
  assert(lista.includes("Non riesco a caricare le campagne"), "CASE L error title");
  assert(lista.includes("Riprova"), "CASE L retry");
  // Structural: error branch sets errore true and clears lists, empty branch only when !errore && length 0
  assert(
    lista.includes("setErrore(true)") && lista.includes("allRows.length === 0"),
    "CASE L error and empty are distinct branches",
  );
}

// CTA labels
assert(
  resolveInventarioCtaLabel({ origine: "ALLY", statoChiave: "DRAFT" }) ===
    "Continua",
  "CTA draft Continua",
);
assert(
  resolveInventarioCtaLabel({ origine: "ALLY", statoChiave: "REVISION" }) ===
    "Rivedi",
  "CTA revision Rivedi",
);
assert(
  resolveInventarioCtaLabel({ origine: "META", statoChiave: "META_PAUSED" }) ===
    "Apri risultati",
  "CTA Meta Apri risultati",
);

// No Meta writes / ads_management in inventory UI
assert(!ui.includes("ads_management"), "no ads_management in inventory UI");
assert(!lista.includes("ads_management"), "no ads_management in list");
assert(!ui.match(/method:\s*["']POST["']/), "no POST writes in inventory UI");

if (falliti > 0) {
  console.error(`\n=== CAMPAGNE INVENTORY FAIL (${falliti}) ===\n`);
  process.exit(1);
}
console.log("\n=== CAMPAGNE INVENTORY PASS ===\n");
