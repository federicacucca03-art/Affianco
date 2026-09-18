/**
 * M10D — Deterministic configuration observations.
 * ISSUE only for clear incompatibilities. Prefer INFO / CHECK.
 */

import { etichettaOptimizationGoal } from "@/lib/meta/configuration/labels";
import { audienceBeginnerLabel } from "@/lib/meta/configuration/normalize-targeting";
import type {
  ConfigurationObservation,
  MetaAdSetConfiguration,
  MetaCampaignConfiguration,
} from "@/lib/meta/configuration/types";
import { resolvePerformanceFamily } from "@/lib/meta/objective-performance";

function leadCompatibleOptimization(goal: string | null): boolean | null {
  if (!goal) return null;
  const g = goal.toUpperCase();
  const ok = new Set([
    "LEAD_GENERATION",
    "QUALITY_LEAD",
    "OFFSITE_CONVERSIONS",
    "CONVERSATIONS",
  ]);
  const bad = new Set([
    "LINK_CLICKS",
    "LANDING_PAGE_VIEWS",
    "IMPRESSIONS",
    "REACH",
    "POST_ENGAGEMENT",
    "PAGE_LIKES",
    "THRUPLAY",
  ]);
  if (ok.has(g)) return true;
  if (bad.has(g)) return false;
  return null;
}

export function buildConfigurationObservations(input: {
  campaign: MetaCampaignConfiguration;
  adSets: MetaAdSetConfiguration[];
}): ConfigurationObservation[] {
  const out: ConfigurationObservation[] = [];
  const family = resolvePerformanceFamily(input.campaign.objective.value);

  if (input.campaign.budgetLevel === "CAMPAIGN") {
    out.push({
      severity: "INFO",
      scope: "CAMPAIGN",
      code: "BUDGET_AT_CAMPAIGN",
      title: "Budget a livello campagna",
      explanation:
        "Il budget risulta gestito a livello campagna.",
      evidence: [`budgetLevel=${input.campaign.budgetLevel}`],
    });
  } else if (input.campaign.budgetLevel === "AD_SET") {
    out.push({
      severity: "INFO",
      scope: "CAMPAIGN",
      code: "BUDGET_AT_ADSET",
      title: "Budget a livello gruppo di inserzioni",
      explanation:
        "Il budget risulta impostato sui gruppi di inserzioni, non sulla campagna.",
      evidence: [`budgetLevel=AD_SET`],
    });
  }

  const cats = input.campaign.specialAdCategories.value;
  if (cats && cats.length > 0) {
    out.push({
      severity: "INFO",
      scope: "CAMPAIGN",
      code: "SPECIAL_AD_CATEGORIES",
      title: "Categorie speciali Meta",
      explanation: `La campagna dichiara categorie speciali: ${cats.join(", ")}.`,
      evidence: cats,
    });
  }

  for (const adSet of input.adSets) {
    const goal = adSet.optimizationGoal.value;
    if (family === "LEADS") {
      const compat = leadCompatibleOptimization(goal);
      if (compat === false) {
        out.push({
          severity: "ISSUE",
          scope: "AD_SET",
          code: "LEADS_OPTIMIZATION_MISMATCH",
          title: "Ottimizzazione non allineata ai contatti",
          explanation: `Obiettivo campagna Contatti, ma il gruppo ottimizza per «${etichettaOptimizationGoal(goal)}».`,
          evidence: [
            `objective=${input.campaign.objective.value ?? "null"}`,
            `optimization_goal=${goal}`,
            `adSet=${adSet.name}`,
          ],
        });
      }
    }

    if (adSet.placements.value?.mode === "MANUAL") {
      out.push({
        severity: "CHECK",
        scope: "AD_SET",
        code: "MANUAL_PLACEMENTS",
        title: "Posizionamenti manuali",
        explanation:
          "I posizionamenti risultano vincolati manualmente. Vale la pena verificarli se stai cercando distribuzione ampia.",
        evidence: [`adSet=${adSet.name}`, "placements=MANUAL"],
      });
    }

    if (adSet.budgetKind === "LIFETIME" && adSet.endAt.value) {
      out.push({
        severity: "INFO",
        scope: "AD_SET",
        code: "LIFETIME_WITH_END",
        title: "Budget lifetime con data di fine",
        explanation:
          "Il gruppo ha un budget lifetime e una data di fine configurata su Meta.",
        evidence: [
          `adSet=${adSet.name}`,
          `end_time=${adSet.endAt.value}`,
        ],
      });
    }

    const audience = adSet.audience.value;
    if (audience?.geographyLabel) {
      out.push({
        severity: "INFO",
        scope: "AD_SET",
        code: "GEO_RESTRICTED",
        title: "Pubblico geograficamente delimitato",
        explanation: `Area: ${audience.geographyLabel}.`,
        evidence: [audience.geographyLabel],
      });
    }

    if (
      audience &&
      (audience.ageMin != null || audience.ageMax != null)
    ) {
      out.push({
        severity: "INFO",
        scope: "AD_SET",
        code: "AGE_CONSTRAINED",
        title: "Fascia d'età esplicita",
        explanation: audienceBeginnerLabel(audience),
        evidence: [
          `age_min=${audience.ageMin ?? "null"}`,
          `age_max=${audience.ageMax ?? "null"}`,
        ],
      });
    }

    const bid = adSet.bidStrategy.value?.toUpperCase() ?? "";
    if (
      bid === "COST_CAP" ||
      bid === "LOWEST_COST_WITH_BID_CAP" ||
      bid === "LOWEST_COST_WITH_MIN_ROAS"
    ) {
      out.push({
        severity: "CHECK",
        scope: "AD_SET",
        code: "BID_CAP_IN_USE",
        title: "Strategia di offerta con limite",
        explanation:
          "È configurato un limite di costo/offerta. Non è un errore, ma conviene verificarlo rispetto al target sostenibile.",
        evidence: [`bid_strategy=${adSet.bidStrategy.value}`],
      });
    }

    if (adSet.attributionSpec.availability === "AVAILABLE") {
      out.push({
        severity: "INFO",
        scope: "AD_SET",
        code: "ATTRIBUTION_CONFIGURED",
        title: "Attribuzione configurata su Meta",
        explanation:
          "Il gruppo ha una specifica di attribuzione esplicita (dettaglio tecnico).",
        evidence: [`adSet=${adSet.name}`],
      });
    }
  }

  return out;
}
