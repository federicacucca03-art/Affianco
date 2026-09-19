/**
 * M10F — Deterministic deep diagnosis builder.
 * Order: measurement → delivery → performance → funnel → economics → config → hypotheses.
 */

import {
  findDiagnostic,
  isApproximatelyStable,
  isMaterialWorsening,
  MATERIAL_CHANGE_PCT,
} from "@/lib/meta/deep-diagnosis/change-gates";
import type {
  DeepDiagnosis,
  DeepDiagnosisConfidence,
  DeepDiagnosisEvaluability,
  DeepDiagnosisInput,
  DeepDiagnosticLayer,
  DeepFinding,
} from "@/lib/meta/deep-diagnosis/types";

function finding(
  partial: Omit<DeepFinding, "limitations"> & { limitations?: string[] },
): DeepFinding {
  return {
    ...partial,
    limitations: partial.limitations ?? [],
  };
}

export function etichettaLayer(layer: DeepDiagnosticLayer): string {
  switch (layer) {
    case "MEASUREMENT":
      return "Misurazione";
    case "DELIVERY":
      return "Distribuzione";
    case "TRAFFIC":
      return "Generazione del clic";
    case "CONVERSION":
      return "Conversione post-click";
    case "ECONOMICS":
      return "Economia";
    case "CONFIGURATION":
      return "Configurazione";
  }
}

export function etichettaEvaluability(e: DeepDiagnosisEvaluability): string {
  switch (e) {
    case "FULL":
      return "Completa";
    case "LIMITED":
      return "Limitata";
    case "BLOCKED":
      return "Bloccata";
  }
}

export function etichettaConfidence(c: DeepDiagnosisConfidence): string {
  switch (c) {
    case "ALTA":
      return "Alta";
    case "MEDIA":
      return "Media";
    case "BASSA":
      return "Bassa";
  }
}

function isPausedStatus(status: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === "PAUSED" || s === "CAMPAIGN_PAUSED" || s.includes("PAUSED");
}

function conversionRate(
  results: number | null,
  linkClicks: number | null,
): number | null {
  if (results == null || linkClicks == null || linkClicks <= 0) return null;
  return results / linkClicks;
}

function materialConversionDrop(
  current: number | null,
  previous: number | null,
): boolean {
  if (current == null || previous == null || previous <= 0) return false;
  const deltaPct = ((current - previous) / previous) * 100;
  return deltaPct <= -MATERIAL_CHANGE_PCT;
}

function formatEuro(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Canonical CTR contract: PERCENTAGE_POINTS (2.87 means 2.87%).
 * Matches aggregateDailyInsights: (linkClicks / impressions) * 100.
 * Do NOT multiply by 100 again.
 */
export function formatCtrPercentagePoints(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(Math.round(n * 100) / 100).toLocaleString("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}%`;
}

function arrowForDirection(
  direction: "IMPROVING" | "WORSENING" | "STABLE" | null,
  /** For cost metrics, worsening = higher = ↑ */
  lowerIsBetter: boolean,
): string {
  if (direction === "STABLE" || direction == null) return "→";
  if (direction === "WORSENING") return lowerIsBetter ? "↑" : "↓";
  return lowerIsBetter ? "↓" : "↑";
}

/**
 * Build deep diagnosis. Pure / deterministic.
 */
export function buildDeepDiagnosis(input: DeepDiagnosisInput): DeepDiagnosis {
  const facts: string[] = [];
  const hypotheses: string[] = [];
  const unknowns: string[] = [];
  const blockers: string[] = [];
  const findings: DeepFinding[] = [];

  const th = input.trackingHealth;
  const perfConf = th?.performanceConfidence ?? "LIMITED";
  const mapping = input.resultMappingConfidence;
  const family = input.performanceFamily;
  const paused = input.isHistorical || isPausedStatus(input.effectiveStatus);

  // ——— Facts always safe to state ———
  if (paused) {
    facts.push("Campagna storica / in pausa: non richiede azione urgente.");
  }
  if (input.spend != null && input.spend > 0) {
    facts.push(`Spesa osservata: ${formatEuro(input.spend)}.`);
  }
  if (input.impressions != null && input.impressions > 0) {
    facts.push(
      `Impression osservate: ${input.impressions.toLocaleString("it-IT")}.`,
    );
  }
  if (input.ctr != null) {
    facts.push(`CTR osservato: ${formatCtrPercentagePoints(input.ctr)}.`);
  }
  if (input.cpc != null) {
    facts.push(`CPC osservato: ${formatEuro(input.cpc)}.`);
  }
  if (mapping === "AMBIGUOUS") {
    facts.push(
      "Il mapping del risultato Meta è ambiguo: conteggio risultato e CPL non sono canonici.",
    );
  }
  if (mapping === "UNKNOWN") {
    facts.push("Il risultato primario Meta non è determinato con certezza.");
  }
  if (th) {
    facts.push(
      `Affidabilità misurazione: ${th.beginnerLabel} (${th.reliability}).`,
    );
  }
  if (!input.hasTarget) {
    facts.push(
      "Target economico assente: non è possibile classificare il costo per risultato rispetto a un obiettivo di business.",
    );
  }

  // Self-comparison availability
  let selfComparison: DeepDiagnosis["selfComparison"] = "NOT_AVAILABLE";
  let comparisonWindowLabel: string | null = null;
  if (input.trend?.level === "TWO_WINDOW_COMPARISON") {
    selfComparison = "AVAILABLE";
    const cur = input.trend.currentWindow;
    const prev = input.trend.previousWindow;
    if (cur && prev) {
      comparisonWindowLabel = `${prev.since}–${prev.until} → ${cur.since}–${cur.until} (${input.trend.windowDays}g)`;
    }
  } else if (input.trend?.level === "INSUFFICIENT_TREND_DATA") {
    selfComparison = "PARTIAL";
    unknowns.push(
      input.trend.insufficientReason ??
        "Confronto temporale non disponibile: finestra insufficiente.",
    );
  }

  // ——— 1. MEASUREMENT GATE ———
  let evaluability: DeepDiagnosisEvaluability = "FULL";
  let primaryFocus: DeepDiagnosticLayer | null = null;
  let confidence: DeepDiagnosisConfidence = "MEDIA";

  const conversionFamily = family === "LEADS" || family === "SALES";

  if (perfConf === "BLOCKED" && conversionFamily) {
    evaluability = "BLOCKED";
    primaryFocus = "MEASUREMENT";
    confidence = "ALTA";
    blockers.push(
      "La misurazione delle conversioni non è abbastanza affidabile per una diagnosi di performance economica.",
    );
    findings.push(
      finding({
        code: "MEASUREMENT_BLOCKS_CONVERSION_DIAGNOSIS",
        layer: "MEASUREMENT",
        severity: "ISSUE",
        confidence: "ALTA",
        title: "Diagnosi conversioni bloccata dalla misurazione",
        explanation:
          "I dati indicano che Ally non può giudicare la performance di conversione finché la misurazione non è verificabile.",
        evidence: [
          `tracking.performanceConfidence=${perfConf}`,
          `family=${family}`,
        ],
        nextCheck:
          "Verifica Pixel/eventi e mapping del risultato prima di valutare conversioni o ROAS.",
      }),
    );
    unknowns.push(
      "Non è possibile stabilire se le conversioni siano basse o se manchi evidenza di misurazione.",
    );
  } else if (
    (perfConf === "LIMITED" || mapping === "AMBIGUOUS" || mapping === "UNKNOWN") &&
    conversionFamily
  ) {
    evaluability = "LIMITED";
    if (!primaryFocus) primaryFocus = "MEASUREMENT";
    confidence = "MEDIA";
    findings.push(
      finding({
        code: "MEASUREMENT_LIMITS_RESULT_DIAGNOSIS",
        layer: "MEASUREMENT",
        severity: "CHECK",
        confidence: "MEDIA",
        title: "Interpretazione del risultato limitata",
        explanation:
          "Il traffico può essere descritto, ma l'efficienza sui risultati (lead/acquisti) non è isolabile con certezza.",
        evidence: [
          `tracking.performanceConfidence=${perfConf}`,
          `result_mapping=${mapping}`,
        ],
        limitations: [
          "Niente CPL/ROAS inventati",
          "Niente root cause di conversione",
        ],
        nextCheck:
          "Prima di valutare il CPL, chiarisci il mapping del risultato e l'affidabilità della misurazione.",
      }),
    );
    unknowns.push(
      "Non possiamo isolare una causa di performance sui risultati canonici con i dati disponibili.",
    );
  }

  // ——— 2. DELIVERY ———
  const hasDelivery =
    (input.impressions != null && input.impressions > 0) ||
    (input.spend != null && input.spend > 0);

  if (!paused && !hasDelivery) {
    if (evaluability !== "BLOCKED") {
      primaryFocus = "DELIVERY";
      confidence = "ALTA";
    }
    findings.push(
      finding({
        code: "NOT_DELIVERING",
        layer: "DELIVERY",
        severity: "ISSUE",
        confidence: "ALTA",
        title: "Poca o nessuna evidenza di distribuzione",
        explanation:
          "I dati indicano che la campagna non sta generando delivery sufficiente: la diagnosi di conversione non è pertinente.",
        evidence: [
          `spend=${input.spend ?? "null"}`,
          `impressions=${input.impressions ?? "null"}`,
          `status=${input.effectiveStatus ?? "null"}`,
        ],
        nextCheck:
          "Verifica budget, stato di pubblicazione e vincoli di distribuzione prima di ottimizzare conversioni.",
      }),
    );
    facts.push("Evidenza di delivery insufficiente nel periodo osservato.");
  } else if (hasDelivery) {
    findings.push(
      finding({
        code: "DELIVERY_AVAILABLE",
        layer: "DELIVERY",
        severity: "INFO",
        confidence: "ALTA",
        title: "Distribuzione osservabile",
        explanation: "Sono presenti segnali di spesa e/o impression.",
        evidence: [
          `spend=${input.spend ?? "null"}`,
          `impressions=${input.impressions ?? "null"}`,
        ],
        nextCheck: null,
      }),
    );
  }

  if (paused) {
    findings.push(
      finding({
        code: "HISTORICAL_PAUSED",
        layer: "DELIVERY",
        severity: "INFO",
        confidence: "ALTA",
        title: "Campagna storica",
        explanation:
          "Lo stato indica una campagna in pausa / storica: nessuna urgenza operativa.",
        evidence: [`status=${input.effectiveStatus ?? "historical"}`],
        nextCheck: null,
      }),
    );
  }

  // ——— 3. CONFIGURATION / PLANNED VS ACTUAL ———
  const mismatches =
    input.plannedVsActual?.filter((p) => p.state === "DIFFERENT") ?? [];
  const configIssues =
    input.configuration?.observations.filter((o) => o.severity === "ISSUE") ??
    [];

  if (mismatches.length > 0) {
    if (evaluability !== "BLOCKED" && primaryFocus == null) {
      primaryFocus = "CONFIGURATION";
      confidence = "ALTA";
      if (evaluability === "FULL") {
        /* keep */
      }
    }
    const labels = mismatches
      .slice(0, 3)
      .map(
        (m) =>
          `${m.label}: pianificato ${m.plannedLabel ?? "—"} → attuale ${m.actualLabel ?? "—"}`,
      );
    findings.push(
      finding({
        code: "PLANNED_VS_ACTUAL_MISMATCH",
        layer: "CONFIGURATION",
        severity: "ISSUE",
        confidence: "ALTA",
        title: "Scostamento tra piano Ally e configurazione Meta",
        explanation:
          "Esiste una differenza deterministica tra quanto pianificato e quanto risulta su Meta.",
        evidence: labels,
        nextCheck:
          "Verifica perché la configurazione Meta differisce dal piano Ally approvato.",
      }),
    );
    facts.push(...labels.map((l) => `Configurazione: ${l}.`));
    if (primaryFocus === null || primaryFocus === "CONFIGURATION") {
      primaryFocus = "CONFIGURATION";
      confidence = "ALTA";
    }
  } else if (input.plannedVsActual == null) {
    // pure Meta — not an issue
  }

  if (configIssues.length > 0 && primaryFocus == null) {
    primaryFocus = "CONFIGURATION";
    confidence = "ALTA";
    const first = configIssues[0]!;
    findings.push(
      finding({
        code: first.code || "CONFIGURATION_ISSUE",
        layer: "CONFIGURATION",
        severity: "ISSUE",
        confidence: "ALTA",
        title: first.title,
        explanation: first.explanation,
        evidence: first.evidence,
        nextCheck: "Rivedi la configurazione Meta segnalata prima di scalare.",
      }),
    );
  }

  // ——— 4–5. TRAFFIC / CONVERSION via self-comparison (only if measurement allows) ———
  const allowConversionClaims =
    evaluability !== "BLOCKED" &&
    perfConf === "FULL" &&
    mapping === "CONFIDENT";

  const allowTrafficClaims =
    evaluability !== "BLOCKED" && hasDelivery && family !== "UNKNOWN";

  /**
   * When lead/sales result diagnosis is limited by measurement/ambiguity,
   * traffic observations may still be recorded — but must NOT become the
   * primary diagnostic focus (would overclaim causal isolation).
   */
  const measurementLimitsLeadDiagnosis =
    conversionFamily &&
    (mapping === "AMBIGUOUS" ||
      mapping === "UNKNOWN" ||
      perfConf === "LIMITED" ||
      perfConf === "BLOCKED" ||
      evaluability === "LIMITED" ||
      evaluability === "BLOCKED");

  let comparisonMetrics: DeepDiagnosis["comparisonMetrics"] = null;

  if (
    allowTrafficClaims &&
    selfComparison === "AVAILABLE" &&
    input.trend?.diagnostics
  ) {
    const ctrT = findDiagnostic(input.trend.diagnostics, "ctr");
    const cpcT = findDiagnostic(input.trend.diagnostics, "cpc");

    comparisonMetrics = {
      ctrPrevious: ctrT?.previous ?? null,
      ctrCurrent: ctrT?.current ?? null,
      ctrDeltaPercent: ctrT?.deltaPercent ?? null,
      cpcPrevious: cpcT?.previous ?? null,
      cpcCurrent: cpcT?.current ?? null,
      cpcDeltaPercent: cpcT?.deltaPercent ?? null,
    };

    const ctrWorse = isMaterialWorsening(ctrT);
    const cpcWorse = isMaterialWorsening(cpcT);
    const ctrStable = isApproximatelyStable(ctrT);
    const cpcStable = isApproximatelyStable(cpcT);

    const ctrCompareLabel =
      ctrT?.previous != null && ctrT.current != null
        ? `CTR ${formatCtrPercentagePoints(ctrT.previous)} → ${formatCtrPercentagePoints(ctrT.current)} ${arrowForDirection(ctrT.direction, false)}`
        : null;
    const cpcCompareLabel =
      cpcT?.previous != null && cpcT.current != null
        ? `CPC ${formatEuro(cpcT.previous)} → ${formatEuro(cpcT.current)} ${arrowForDirection(cpcT.direction, true)}`
        : null;

    if (ctrWorse || cpcWorse) {
      if (ctrCompareLabel) facts.push(`Confronto traffico: ${ctrCompareLabel}.`);
      if (cpcCompareLabel && cpcWorse) {
        facts.push(`Confronto traffico: ${cpcCompareLabel}.`);
      }
      facts.push(
        ctrWorse
          ? `CTR in peggioramento materiale rispetto al periodo precedente (|Δ relativo|≥${MATERIAL_CHANGE_PCT}%, regola Ally interna).`
          : `CTR circa stabile rispetto al periodo precedente.`,
      );
      if (cpcWorse) {
        facts.push(
          `CPC in peggioramento materiale rispetto al periodo precedente (|Δ relativo|≥${MATERIAL_CHANGE_PCT}%, regola Ally interna).`,
        );
      }

      // Conversion stability check when allowed
      let postClickStable = false;
      let postClickWorse = false;
      if (
        allowConversionClaims &&
        input.trend.currentAggregate &&
        input.trend.previousAggregate
      ) {
        const curCr = conversionRate(
          input.trend.currentAggregate.primaryResults,
          input.trend.currentAggregate.linkClicks,
        );
        const prevCr = conversionRate(
          input.trend.previousAggregate.primaryResults,
          input.trend.previousAggregate.linkClicks,
        );
        if (curCr != null && prevCr != null) {
          const deltaPct = ((curCr - prevCr) / prevCr) * 100;
          if (Math.abs(deltaPct) < MATERIAL_CHANGE_PCT) {
            postClickStable = true;
            facts.push(
              "Il tasso di conversione post-click risulta circa stabile tra i due periodi.",
            );
          } else if (deltaPct <= -MATERIAL_CHANGE_PCT) {
            postClickWorse = true;
            facts.push(
              "Il tasso di conversione post-click risulta in calo materiale tra i due periodi.",
            );
          }
        }
      }

      const trafficEvidence = [
        ctrCompareLabel,
        cpcCompareLabel,
        ctrT
          ? `CTR Δ relativo=${ctrT.deltaPercent ?? "n/d"}% (${ctrT.direction})`
          : null,
        cpcT
          ? `CPC Δ relativo=${cpcT.deltaPercent ?? "n/d"}% (${cpcT.direction})`
          : null,
      ].filter((x): x is string => Boolean(x));

      if ((ctrWorse || cpcWorse) && (postClickStable || !allowConversionClaims)) {
        const canClaimPrimaryTrafficFocus =
          !paused &&
          !measurementLimitsLeadDiagnosis &&
          (primaryFocus == null || primaryFocus === "MEASUREMENT");

        if (canClaimPrimaryTrafficFocus) {
          primaryFocus = "TRAFFIC";
          confidence = allowConversionClaims ? "MEDIA" : "BASSA";
        }

        findings.push(
          finding({
            code: "CLICK_STAGE_PRESSURE",
            layer: "TRAFFIC",
            severity: canClaimPrimaryTrafficFocus ? "CHECK" : "INFO",
            confidence: allowConversionClaims ? "MEDIA" : "BASSA",
            title: canClaimPrimaryTrafficFocus
              ? "Deterioramento osservabile prima della conversione"
              : "Osservazione traffico (informativa)",
            explanation: canClaimPrimaryTrafficFocus
              ? "Nei dati di traffico, il peggioramento osservabile si concentra nella generazione del clic. Non implica che creatività o pubblico siano 'sbagliati'."
              : paused
                ? "Nei dati di traffico storici risulta un peggioramento nella generazione del clic. È informativo: campagna storica, nessuna urgenza, e non isola la causa della performance lead."
                : "Nei dati di traffico, il peggioramento osservabile si concentra nella generazione del clic. Restano limitati i giudizi sulla performance lead per ambiguità/misurazione.",
            evidence: trafficEvidence,
            limitations: [
              "Niente giudizio qualitativo sulla creatività",
              "Niente claim 'pubblico sbagliato'",
              "Niente root cause lead se mapping/misurazione limitati",
            ],
            nextCheck: canClaimPrimaryTrafficFocus
              ? "Prima area da verificare: fase di generazione del clic (messaggio/offerta/asta), senza assumere un root cause creativo."
              : paused
                ? "Nessuna azione urgente: campagna storica."
                : "Prima di isolare una causa lead, chiarisci mapping/misurazione; il segnale traffico resta secondario.",
          }),
        );

        if (canClaimPrimaryTrafficFocus) {
          hypotheses.push(
            "Nei dati di traffico, il peggioramento osservabile si concentra nella generazione del clic.",
          );
        } else {
          hypotheses.push(
            "Compatibile con pressione pre-conversione nei dati di traffico: ipotesi informativa, non causa isolata della performance lead.",
          );
        }
        unknowns.push(
          "Non possiamo stabilire dai dati disponibili se il problema sia il messaggio creativo o la qualità del pubblico.",
        );
        if (measurementLimitsLeadDiagnosis) {
          unknowns.push(
            "Non possiamo isolare la causa della performance lead: risultato canonico non determinabile con certezza.",
          );
        }
      }

      if (
        allowConversionClaims &&
        !paused &&
        ctrStable &&
        cpcStable &&
        postClickWorse
      ) {
        if (evaluability !== "BLOCKED" && !measurementLimitsLeadDiagnosis) {
          primaryFocus = "CONVERSION";
          confidence = "MEDIA";
        }
        findings.push(
          finding({
            code: "POST_CLICK_CONVERSION_PRESSURE",
            layer: "CONVERSION",
            severity: "CHECK",
            confidence: "MEDIA",
            title: "Perdita concentrata dopo il clic",
            explanation:
              "Il traffico non mostra un deterioramento equivalente; la perdita sembra avvenire dopo il clic.",
            evidence: [
              ctrCompareLabel ?? `CTR ${ctrT?.direction ?? "n/d"}`,
              cpcCompareLabel ?? `CPC ${cpcT?.direction ?? "n/d"}`,
              "Conversione post-click in calo materiale",
            ],
            limitations: [
              "Landing/offer/form restano ipotesi non provate",
            ],
            nextCheck:
              "Controlla landing/form/offerta prima di aumentare il budget.",
          }),
        );
        hypotheses.push(
          "Compatibile con frizione post-click (landing, offerta o form): non dimostrato.",
        );
        unknowns.push(
          "Ally non può determinare se la causa sia landing page, offerta, form o qualità del lead.",
        );
      }
    } else if (
      allowConversionClaims &&
      !paused &&
      ctrStable &&
      cpcStable &&
      input.trend.currentAggregate &&
      input.trend.previousAggregate
    ) {
      const curCr = conversionRate(
        input.trend.currentAggregate.primaryResults,
        input.trend.currentAggregate.linkClicks,
      );
      const prevCr = conversionRate(
        input.trend.previousAggregate.primaryResults,
        input.trend.previousAggregate.linkClicks,
      );
      if (materialConversionDrop(curCr, prevCr)) {
        if (evaluability !== "BLOCKED" && !measurementLimitsLeadDiagnosis) {
          primaryFocus = "CONVERSION";
          confidence = "MEDIA";
        }
        findings.push(
          finding({
            code: "POST_CLICK_CONVERSION_PRESSURE",
            layer: "CONVERSION",
            severity: "CHECK",
            confidence: "MEDIA",
            title: "Perdita concentrata dopo il clic",
            explanation:
              "Il traffico non mostra un deterioramento equivalente; la perdita sembra avvenire dopo il clic.",
            evidence: [
              ctrCompareLabel ?? "CTR circa stabile",
              cpcCompareLabel ?? "CPC circa stabile",
              "Conversione post-click in calo materiale",
            ],
            nextCheck:
              "Controlla landing/form/offerta prima di aumentare il budget.",
          }),
        );
        hypotheses.push(
          "Compatibile con frizione post-click (landing, offerta o form): non dimostrato.",
        );
        unknowns.push(
          "Ally non può determinare se la causa sia landing page, offerta, form o qualità del lead.",
        );
      }
    }
  }

  // Saturation safety — frequency rising + CTR falling → hypothesis only
  if (
    allowTrafficClaims &&
    selfComparison === "AVAILABLE" &&
    input.frequency != null &&
    input.frequency >= 3
  ) {
    const ctrT = findDiagnostic(input.trend?.diagnostics ?? [], "ctr");
    if (isMaterialWorsening(ctrT)) {
      hypotheses.push(
        "Compatibile con saturazione / perdita di risposta (frequenza elevata + CTR in calo): ipotesi non dimostrata.",
      );
      unknowns.push(
        "Frequenza alta da sola non prova affaticamento del pubblico.",
      );
    }
  }

  // ——— 6. ECONOMICS (target only, no invented industry benchmarks) ———
  if (
    allowConversionClaims &&
    input.hasTarget &&
    input.targetValue != null &&
    input.costPerResult != null &&
    input.costPerResult > input.targetValue
  ) {
    facts.push(
      `Costo per risultato osservato (${formatEuro(input.costPerResult)}) sopra il target (${formatEuro(input.targetValue)}).`,
    );
    findings.push(
      finding({
        code: "ECONOMIC_PRESSURE",
        layer: "ECONOMICS",
        severity: "CHECK",
        confidence: "ALTA",
        title: "Pressione economica rispetto al target",
        explanation:
          "Il costo per risultato supera il target indicato. Il perché richiede le evidenze di funnel, non l'inverso.",
        evidence: [
          `cost_per_result=${input.costPerResult}`,
          `target=${input.targetValue}`,
        ],
        nextCheck: null,
      }),
    );
    if (primaryFocus == null) {
      primaryFocus = "ECONOMICS";
      confidence = "ALTA";
    }
  }

  // Awareness / traffic families — never invent lead/conversion diagnosis
  if (family === "AWARENESS") {
    unknowns.push(
      "Obiettivo Awareness: nessuna diagnosi CPL/lead applicabile.",
    );
    if (primaryFocus === "CONVERSION" || primaryFocus === "ECONOMICS") {
      primaryFocus = "DELIVERY";
    }
  }
  if (family === "TRAFFIC" && primaryFocus === "CONVERSION") {
    // keep conversion only if LPV path — still ok as post-click to destination
  }

  // Hierarchy concentration as FACT only
  if (input.hierarchyFocus?.lines?.length) {
    for (const line of input.hierarchyFocus.lines.slice(0, 2)) {
      facts.push(line);
    }
    if (input.hierarchyFocus.focusAdName) {
      facts.push(
        `Concentrazione osservata sull'inserzione: ${input.hierarchyFocus.focusAdName}.`,
      );
    } else if (input.hierarchyFocus.focusAdSetName) {
      facts.push(
        `Concentrazione osservata sul gruppo: ${input.hierarchyFocus.focusAdSetName}.`,
      );
    }
  }

  // Small sample
  if (input.sampleSufficient === false && conversionFamily) {
    if (evaluability === "FULL") evaluability = "LIMITED";
    blockers.push(
      "Campione insufficiente per conclusioni forti sulla performance.",
    );
    findings.push(
      finding({
        code: "INSUFFICIENT_SAMPLE",
        layer: primaryFocus ?? "DELIVERY",
        severity: "CHECK",
        confidence: "ALTA",
        title: "Dati insufficienti",
        explanation:
          "I dati indicano un campione ancora troppo piccolo per isolare una causa.",
        evidence: ["sampleSufficient=false"],
        nextCheck: "Raccogli più dati prima di intervenire.",
      }),
    );
    if (primaryFocus == null) primaryFocus = null;
    confidence = "BASSA";
  }

  // Healthy / no forced diagnosis
  const issueFindings = findings.filter(
    (f) => f.severity === "ISSUE" || f.severity === "CHECK",
  );
  const onlyInfo =
    issueFindings.length === 0 ||
    issueFindings.every((f) =>
      ["DELIVERY_AVAILABLE", "HISTORICAL_PAUSED"].includes(f.code),
    );

  if (
    onlyInfo &&
    allowConversionClaims &&
    input.hasTarget &&
    input.costPerResult != null &&
    input.targetValue != null &&
    input.costPerResult <= input.targetValue &&
    mismatches.length === 0
  ) {
    primaryFocus = null;
    confidence = "ALTA";
    findings.push(
      finding({
        code: "NO_FORCED_DIAGNOSIS",
        layer: "ECONOMICS",
        severity: "INFO",
        confidence: "ALTA",
        title: "Nessuna diagnosi forzata",
        explanation:
          "Tracking affidabile e performance entro target: Ally non inventa un problema.",
        evidence: [
          `cost_per_result=${input.costPerResult}`,
          `target=${input.targetValue}`,
        ],
        nextCheck: null,
      }),
    );
  }

  // ——— Summaries ———
  let beginnerSummary: string;
  let beginnerLabel: string;
  let nextCheck: string | null = null;

  if (paused && (mapping === "AMBIGUOUS" || perfConf === "LIMITED")) {
    beginnerLabel = "Diagnosi limitata";
    beginnerSummary =
      "Il traffico è misurabile, ma non è possibile isolare una causa di performance sui lead perché il risultato canonico non è determinabile con certezza.";
    nextCheck =
      "Nessuna azione urgente: campagna storica. Se ripresa, chiarisci prima il mapping del risultato.";
    // Historical + ambiguous: measurement is primary; traffic trends stay informational.
    primaryFocus = "MEASUREMENT";
    evaluability = "LIMITED";
    confidence = "MEDIA";
  } else if (evaluability === "BLOCKED" && primaryFocus === "MEASUREMENT") {
    beginnerLabel = "Diagnosi bloccata";
    beginnerSummary =
      "La diagnosi di performance è bloccata: la misurazione delle conversioni non è verificabile con i dati disponibili.";
    nextCheck =
      findings.find((f) => f.nextCheck)?.nextCheck ??
      "Verifica la misurazione prima di giudicare le conversioni.";
  } else if (primaryFocus === "DELIVERY" && !hasDelivery) {
    beginnerLabel = "Distribuzione";
    beginnerSummary =
      "Il problema sembra concentrarsi sulla distribuzione: non c'è abbastanza delivery per parlare di conversioni.";
    nextCheck =
      findings.find((f) => f.code === "NOT_DELIVERING")?.nextCheck ?? null;
  } else if (primaryFocus === "CONFIGURATION") {
    beginnerLabel = "Configurazione";
    beginnerSummary =
      "I dati indicano uno scostamento di configurazione rispetto al piano: questa è la prima area da verificare.";
    nextCheck =
      findings.find((f) => f.layer === "CONFIGURATION")?.nextCheck ?? null;
  } else if (primaryFocus === "TRAFFIC") {
    beginnerLabel = "Generazione del clic";
    beginnerSummary =
      "Nei dati di traffico, il peggioramento osservabile si concentra nella generazione del clic.";
    nextCheck =
      findings.find((f) => f.code === "CLICK_STAGE_PRESSURE")?.nextCheck ??
      null;
  } else if (primaryFocus === "CONVERSION") {
    beginnerLabel = "Conversione post-click";
    beginnerSummary =
      "Il problema sembra concentrarsi dopo il clic.";
    nextCheck =
      findings.find((f) => f.code === "POST_CLICK_CONVERSION_PRESSURE")
        ?.nextCheck ?? null;
  } else if (primaryFocus === "ECONOMICS") {
    beginnerLabel = "Economia";
    beginnerSummary =
      "Il costo per risultato supera il target; le evidenze di funnel indicano dove indagare per prime.";
    nextCheck =
      findings.find((f) => f.nextCheck)?.nextCheck ??
      "Usa le evidenze di traffico/conversione prima di cambiare budget.";
  } else if (primaryFocus === "MEASUREMENT") {
    beginnerLabel = "Misurazione";
    beginnerSummary =
      "Prima di una diagnosi di performance sui risultati, i dati indicano limiti di misurazione o di mapping.";
    nextCheck =
      findings.find((f) => f.layer === "MEASUREMENT")?.nextCheck ?? null;
  } else if (onlyInfo) {
    beginnerLabel = "Nessun problema isolato";
    beginnerSummary =
      "Con i dati disponibili Ally non isola un deterioramento che richieda intervento.";
    nextCheck = null;
    primaryFocus = null;
  } else {
    beginnerLabel = "Diagnosi non isolabile";
    beginnerSummary =
      "Diagnosi non isolabile con i dati disponibili.";
    nextCheck = "Raccogli più evidenze prima di intervenire.";
    confidence = "BASSA";
  }

  // Prefer finding nextCheck if summary didn't set one
  if (!nextCheck) {
    nextCheck =
      findings.find((f) => f.nextCheck && f.severity !== "INFO")?.nextCheck ??
      null;
  }

  const professionalLines: DeepDiagnosis["professionalLines"] = [
    {
      key: "evaluability",
      label: "Valutabilità",
      value: etichettaEvaluability(evaluability),
    },
    {
      key: "focus",
      label: "Focus diagnostico",
      value: primaryFocus ? etichettaLayer(primaryFocus) : "Non isolabile",
    },
    {
      key: "confidence",
      label: "Confidenza",
      value: etichettaConfidence(confidence),
    },
    {
      key: "selfComparison",
      label: "Confronto temporale",
      value:
        selfComparison === "AVAILABLE"
          ? `Disponibile${comparisonWindowLabel ? ` (${comparisonWindowLabel})` : ""}`
          : selfComparison === "PARTIAL"
            ? "Parziale"
            : "Non disponibile",
    },
  ];

  if (comparisonMetrics) {
    const parts: string[] = [];
    if (
      comparisonMetrics.ctrPrevious != null &&
      comparisonMetrics.ctrCurrent != null
    ) {
      parts.push(
        `CTR ${formatCtrPercentagePoints(comparisonMetrics.ctrPrevious)} → ${formatCtrPercentagePoints(comparisonMetrics.ctrCurrent)}`,
      );
    }
    if (
      comparisonMetrics.cpcPrevious != null &&
      comparisonMetrics.cpcCurrent != null
    ) {
      parts.push(
        `CPC ${formatEuro(comparisonMetrics.cpcPrevious)} → ${formatEuro(comparisonMetrics.cpcCurrent)}`,
      );
    }
    if (parts.length > 0) {
      professionalLines.push({
        key: "comparisonMetrics",
        label: "Confronto",
        value: parts.join(" · "),
      });
    }
  }

  if (facts.length > 0) {
    professionalLines.push({
      key: "facts",
      label: "Fatti",
      value: facts.slice(0, 8).join(" · "),
    });
  }
  if (hypotheses.length > 0) {
    professionalLines.push({
      key: "hypotheses",
      label: "Ipotesi",
      value: hypotheses.slice(0, 4).join(" · "),
    });
  }
  if (unknowns.length > 0) {
    professionalLines.push({
      key: "unknowns",
      label: "Sconosciuti",
      value: unknowns.slice(0, 4).join(" · "),
    });
  }
  if (nextCheck) {
    professionalLines.push({
      key: "nextCheck",
      label: "Prossimo controllo",
      value: nextCheck,
    });
  }

  return {
    evaluability,
    primaryFocus,
    beginnerSummary,
    beginnerLabel,
    confidence,
    findings,
    facts: [...new Set(facts)],
    hypotheses: [...new Set(hypotheses)],
    unknowns: [...new Set(unknowns)],
    blockers: [...new Set(blockers)],
    nextCheck,
    selfComparison,
    comparisonWindowLabel,
    comparisonMetrics,
    professionalLines,
  };
}
