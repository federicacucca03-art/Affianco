/**
 * M10G — Deterministic creative intelligence composer.
 * Read-only. Reuses M10F MATERIAL_CHANGE_PCT + computeMetaTrend.
 */

import {
  MATERIAL_CHANGE_PCT,
  findDiagnostic,
  formatCtrPercentagePoints,
  isMaterialWorsening,
} from "@/lib/meta/deep-diagnosis";
import { computeMetaTrend } from "@/lib/meta/meta-trend";
import type { PerformanceObjectiveFamily } from "@/lib/meta/objective-performance";
import { etichettaMetaDeliveryStatus } from "@/lib/meta/hierarchy-evaluate";
import {
  DELIVERY_IMBALANCE_SPEND_SHARE,
  FATIGUE_FREQ_RISE_ABS,
  MIN_DELIVERY_DAYS_FOR_COMPARE,
  MIN_IMPRESSIONS_FOR_COMPARE,
  MIN_PEER_SPEND_SHARE,
} from "@/lib/meta/creative-intelligence/evidence-gates";
import type {
  CreativeAdInput,
  CreativeAdSnapshot,
  CreativeComparisonMode,
  CreativeConfidence,
  CreativeFinding,
  CreativeIntelligence,
  CreativeIntelligenceInput,
  CreativePrimaryObservation,
} from "@/lib/meta/creative-intelligence/types";

export function etichettaComparisonMode(
  mode: CreativeComparisonMode,
): string {
  switch (mode) {
    case "SELF_TREND":
      return "andamento della stessa inserzione nel tempo";
    case "CROSS_AD":
      return "confronto tra inserzioni";
    case "SINGLE_AD_ONLY":
      return "una sola inserzione disponibile per l'analisi";
    case "NONE":
      return "nessun confronto creativo disponibile";
    default:
      return "nessun confronto creativo disponibile";
  }
}

function isMetaAdActive(ad: CreativeAdInput): boolean {
  const s = (ad.effectiveStatus ?? ad.status ?? "").trim().toUpperCase();
  return s === "ACTIVE";
}

function metaAdStatusFact(ad: CreativeAdInput): string | null {
  const label = etichettaMetaDeliveryStatus(
    ad.effectiveStatus ?? ad.status,
  );
  if (label) return `Stato Meta inserzione «${ad.name}»: ${label}.`;
  return null;
}

function formatEuro(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "non disponibile";
  return `${n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function formatPctPoints(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "non disponibile";
  return formatCtrPercentagePoints(n);
}

function formatInt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "non disponibile";
  return Math.round(n).toLocaleString("it-IT");
}

function spendOf(ad: CreativeAdInput): number {
  return ad.spend != null && ad.spend > 0 ? ad.spend : 0;
}

function impressionsOf(ad: CreativeAdInput): number {
  return ad.impressions != null && ad.impressions > 0 ? ad.impressions : 0;
}

function adSampleSufficient(ad: CreativeAdInput): boolean {
  return (
    ad.dayCount >= MIN_DELIVERY_DAYS_FOR_COMPARE &&
    impressionsOf(ad) >= MIN_IMPRESSIONS_FOR_COMPARE
  );
}

function allowsTrafficMetrics(family: PerformanceObjectiveFamily): boolean {
  return (
    family === "LEADS" ||
    family === "SALES" ||
    family === "TRAFFIC" ||
    family === "ENGAGEMENT" ||
    family === "UNKNOWN"
  );
}

function allowsResultStage(
  input: CreativeIntelligenceInput,
): boolean {
  if (
    input.performanceFamily !== "LEADS" &&
    input.performanceFamily !== "SALES"
  ) {
    return false;
  }
  if (input.trackingPerformanceConfidence === "BLOCKED") return false;
  if (input.campaignResultMapping !== "CONFIDENT") return false;
  return true;
}

function allowsAwarenessMetrics(family: PerformanceObjectiveFamily): boolean {
  return family === "AWARENESS";
}

function messageFingerprint(ad: CreativeAdInput): string {
  return [
    (ad.creativeTitle ?? "").trim().toLowerCase(),
    (ad.creativeBody ?? "").trim().toLowerCase(),
    (ad.creativeCta ?? "").trim().toLowerCase(),
  ].join("||");
}

function avgDailyFrequency(
  rows: CreativeAdInput["insightRows"],
): number | null {
  const vals = rows
    .filter((r) => r.spend != null && r.spend > 0 && r.frequency != null)
    .map((r) => r.frequency as number);
  if (vals.length < MIN_DELIVERY_DAYS_FOR_COMPARE) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / vals.length;
}

function relativeDeltaPct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildSnapshots(
  ads: CreativeAdInput[],
  totalSpend: number,
  comparableIds: Set<string>,
): CreativeAdSnapshot[] {
  return ads.map((ad) => ({
    metaAdId: ad.metaAdId,
    metaAdSetId: ad.metaAdSetId,
    adSetName: ad.adSetName,
    name: ad.name,
    status: ad.status,
    effectiveStatus: ad.effectiveStatus,
    creativeId: ad.creativeId,
    creativeTitle: ad.creativeTitle,
    creativeBody: ad.creativeBody,
    creativeCta: ad.creativeCta,
    creativeLinkUrl: ad.creativeLinkUrl,
    creativeThumbnailUrl: ad.creativeThumbnailUrl,
    spend: ad.spend,
    impressions: ad.impressions,
    linkClicks: ad.linkClicks,
    ctr: ad.ctr,
    cpc: ad.cpc,
    cpm: ad.cpm,
    results: ad.results,
    costPerResult: ad.costPerResult,
    resultMappingConfidence: ad.resultMappingConfidence,
    spendShare: totalSpend > 0 ? spendOf(ad) / totalSpend : null,
    sampleSufficient: adSampleSufficient(ad),
    comparable: comparableIds.has(ad.metaAdId),
  }));
}

function professionalFrom(
  intel: Omit<CreativeIntelligence, "professionalLines">,
  ads: CreativeAdInput[],
): CreativeIntelligence["professionalLines"] {
  const lines: CreativeIntelligence["professionalLines"] = [
    {
      key: "evaluability",
      label: "Valutabilità",
      value: etichettaCreativeEvaluability(intel.evaluability),
    },
    {
      key: "comparison_mode",
      label: "Modalità confronto",
      value: intel.comparisonModeLabelIt,
    },
    {
      key: "primary",
      label: "Osservazione primaria",
      value: intel.beginnerLabel,
    },
    {
      key: "confidence",
      label: "Affidabilità",
      value: intel.confidence,
    },
    {
      key: "ad_count",
      label: "Inserzioni",
      value: String(ads.length),
    },
  ];
  for (const ad of intel.ads) {
    const prefix = `ad_${ad.metaAdId}`;
    lines.push({
      key: `${prefix}_name`,
      label: `Inserzione`,
      value: ad.name,
    });
    if (ad.ctr != null) {
      lines.push({
        key: `${prefix}_ctr`,
        label: `CTR · ${ad.name}`,
        value: formatPctPoints(ad.ctr),
      });
    }
    if (ad.cpc != null) {
      lines.push({
        key: `${prefix}_cpc`,
        label: `CPC · ${ad.name}`,
        value: formatEuro(ad.cpc),
      });
    }
    if (ad.impressions != null) {
      lines.push({
        key: `${prefix}_impr`,
        label: `Impression · ${ad.name}`,
        value: formatInt(ad.impressions),
      });
    }
    if (ad.spendShare != null) {
      lines.push({
        key: `${prefix}_share`,
        label: `Quota spesa · ${ad.name}`,
        value: `${Math.round(ad.spendShare * 100)}%`,
      });
    }
    if (ad.creativeTitle) {
      lines.push({
        key: `${prefix}_title`,
        label: `Titolo · ${ad.name}`,
        value: ad.creativeTitle,
      });
    }
    if (ad.creativeBody) {
      lines.push({
        key: `${prefix}_body`,
        label: `Testo · ${ad.name}`,
        value:
          ad.creativeBody.length > 160
            ? `${ad.creativeBody.slice(0, 157)}…`
            : ad.creativeBody,
      });
    }
    if (ad.creativeCta) {
      lines.push({
        key: `${prefix}_cta`,
        label: `CTA · ${ad.name}`,
        value: ad.creativeCta,
      });
    }
  }
  for (const f of intel.facts) {
    lines.push({ key: `fact_${lines.length}`, label: "Fatto", value: f });
  }
  for (const h of intel.hypotheses) {
    lines.push({
      key: `hyp_${lines.length}`,
      label: "Ipotesi (non provata)",
      value: h,
    });
  }
  for (const u of intel.unknowns) {
    lines.push({
      key: `unk_${lines.length}`,
      label: "Non determinabile",
      value: u,
    });
  }
  if (intel.nextTest) {
    lines.push({
      key: "next_test",
      label: "Prossimo test",
      value: intel.nextTest,
    });
  }
  return lines;
}

function finish(
  partial: Omit<CreativeIntelligence, "professionalLines" | "ads" | "comparisonModeLabelIt"> & {
    ads: CreativeAdSnapshot[];
    comparisonModeLabelIt?: string;
  },
  adInputs: CreativeAdInput[],
): CreativeIntelligence {
  const withLabel: Omit<CreativeIntelligence, "professionalLines"> = {
    ...partial,
    comparisonModeLabelIt:
      partial.comparisonModeLabelIt ??
      etichettaComparisonMode(partial.comparisonMode),
  };
  return {
    ...withLabel,
    professionalLines: professionalFrom(withLabel, adInputs),
  };
}

/**
 * Build deterministic creative intelligence for a campaign hierarchy.
 */
export function buildCreativeIntelligence(
  input: CreativeIntelligenceInput,
): CreativeIntelligence {
  const ads = input.ads;
  const facts: string[] = [];
  const hypotheses: string[] = [];
  const unknowns: string[] = [];
  const findings: CreativeFinding[] = [];

  if (ads.length === 0) {
    return finish(
      {
        evaluability: "INSUFFICIENT_DATA",
        comparisonMode: "NONE",
        confidence: "BASSA",
        beginnerLabel: "Dati creativi insufficienti",
        beginnerSummary:
          "Non ci sono ancora inserzioni con delivery da analizzare.",
        primaryObservation: "CREATIVE_DATA_INSUFFICIENT",
        ads: [],
        findings: [
          {
            code: "CREATIVE_DATA_INSUFFICIENT",
            confidence: "BASSA",
            title: "Nessuna inserzione",
            explanation:
              "Servono inserzioni con delivery prima di una lettura creativa.",
            evidence: [],
            limitations: [],
          },
        ],
        facts: [],
        hypotheses: [],
        unknowns: ["Nessuna inserzione disponibile per il confronto."],
        nextTest:
          "Pubblica almeno una inserzione e lascia accumulare delivery prima di valutare.",
        comparisonWindowLabel: null,
      },
      ads,
    );
  }

  const totalSpend = ads.reduce((s, a) => s + spendOf(a), 0);
  const adSetIds = new Set(ads.map((a) => a.metaAdSetId));
  const multiAdSet = adSetIds.size > 1;

  // Creative reuse note (same creative id on multiple ads)
  const byCreativeId = new Map<string, string[]>();
  for (const ad of ads) {
    if (!ad.creativeId) continue;
    const list = byCreativeId.get(ad.creativeId) ?? [];
    list.push(ad.name);
    byCreativeId.set(ad.creativeId, list);
  }
  for (const [cid, names] of byCreativeId) {
    if (names.length > 1) {
      facts.push(
        `Lo stesso creative id (${cid.slice(0, 8)}…) è riusato su ${names.length} inserzioni: ${names.join(", ")}.`,
      );
    }
  }

  // ——— SINGLE AD ———
  if (ads.length === 1) {
    const ad = ads[0]!;
    const sampleOk = adSampleSufficient(ad);
    facts.push(`È presente una sola inserzione: «${ad.name}».`);
    const statusFact = metaAdStatusFact(ad);
    if (statusFact) facts.push(statusFact);
    if (!isMetaAdActive(ad)) {
      facts.push(
        "Non descrivere questa inserzione come «attiva»: lo stato Meta non è ACTIVE.",
      );
    }
    if (ad.creativeTitle) {
      facts.push(`Titolo: ${ad.creativeTitle}`);
    }
    if (ad.creativeCta) {
      facts.push(`CTA: ${ad.creativeCta}`);
    }
    if (allowsTrafficMetrics(input.performanceFamily) && ad.ctr != null) {
      facts.push(`CTR (punti percentuali): ${formatPctPoints(ad.ctr)}`);
    }
    if (allowsTrafficMetrics(input.performanceFamily) && ad.cpc != null) {
      facts.push(`CPC: ${formatEuro(ad.cpc)}`);
    }
    if (ad.spend != null) {
      facts.push(`Spesa inserzione: ${formatEuro(ad.spend)}`);
    }

    unknowns.push(
      "Non è possibile confrontare varianti creative: manca almeno una seconda inserzione comparabile.",
    );
    unknowns.push(
      "Non possiamo isolare se il comportamento dipende dalla creatività o da altri fattori della campagna.",
    );

    if (
      !allowsResultStage(input) &&
      (input.campaignResultMapping === "AMBIGUOUS" ||
        input.campaignResultMapping === "UNKNOWN")
    ) {
      unknowns.push(
        "Conteggio risultati e costo/risultato per inserzione non determinabili con certezza (mapping non affidabile).",
      );
    }

    findings.push({
      code: "SINGLE_VARIANT_ONLY",
      confidence: "ALTA",
      title: "Una sola variante",
      explanation:
        "È presente una sola inserzione: non puoi distinguere se il comportamento dipende dalla creatività o da altri fattori.",
      evidence: [`Inserzioni: 1`, `Nome: ${ad.name}`],
      limitations: [],
    });

    let comparisonMode: CreativeIntelligence["comparisonMode"] = "SINGLE_AD_ONLY";
    let primaryObservation: CreativePrimaryObservation = "NO_COMPARISON_AVAILABLE";
    let confidence: CreativeConfidence = "MEDIA";
    let comparisonWindowLabel: string | null = null;

    // Self-trend when enough history
    if (sampleOk && ad.insightRows.length > 0) {
      const trend = computeMetaTrend(ad.insightRows);
      if (trend.level === "TWO_WINDOW_COMPARISON") {
        comparisonMode = "SELF_TREND";
        comparisonWindowLabel =
          trend.currentWindow && trend.previousWindow
            ? `${trend.previousWindow.since}–${trend.previousWindow.until} → ${trend.currentWindow.since}–${trend.currentWindow.until}`
            : null;
        const ctrT = findDiagnostic(trend.diagnostics, "ctr");
        const cpcT = findDiagnostic(trend.diagnostics, "cpc");

        if (
          allowsTrafficMetrics(input.performanceFamily) &&
          ctrT?.previous != null &&
          ctrT.current != null
        ) {
          facts.push(
            `CTR inserzione: ${formatPctPoints(ctrT.previous)} → ${formatPctPoints(ctrT.current)}.`,
          );
        }
        if (
          allowsTrafficMetrics(input.performanceFamily) &&
          cpcT?.previous != null &&
          cpcT.current != null
        ) {
          facts.push(
            `CPC inserzione: ${formatEuro(cpcT.previous)} → ${formatEuro(cpcT.current)}.`,
          );
        }

        if (
          allowsTrafficMetrics(input.performanceFamily) &&
          isMaterialWorsening(ctrT)
        ) {
          findings.push({
            code: "SELF_TREND_DECLINE",
            confidence: "MEDIA",
            title: "Risposta al clic in peggioramento",
            explanation:
              "La risposta al clic è peggiorata nel periodo più recente rispetto al precedente (confronto sull'unica inserzione).",
            evidence: [
              ctrT
                ? `CTR ${formatPctPoints(ctrT.previous)} → ${formatPctPoints(ctrT.current)} (Δ relativo ${ctrT.deltaPercent}%)`
                : "",
            ].filter(Boolean),
            limitations: [
              "Trend su una sola inserzione: non prova che la creatività sia la causa.",
            ],
          });
          primaryObservation = "ONE_AD_CONCENTRATES_TRAFFIC_DECLINE";
        }

        // Fatigue-compatible: frequency rise + CTR fall
        const delivery = ad.insightRows
          .filter((r) => r.spend != null && r.spend > 0)
          .sort((a, b) => a.dateStart.localeCompare(b.dateStart));
        if (delivery.length >= 14 && isMaterialWorsening(ctrT)) {
          const cur = delivery.slice(-7);
          const prev = delivery.slice(-14, -7);
          const freqCur = avgDailyFrequency(cur);
          const freqPrev = avgDailyFrequency(prev);
          if (
            freqCur != null &&
            freqPrev != null &&
            freqCur - freqPrev >= FATIGUE_FREQ_RISE_ABS
          ) {
            findings.push({
              code: "POSSIBLE_FATIGUE_PATTERN",
              confidence: "BASSA",
              title: "Pattern compatibile con perdita di risposta",
              explanation:
                "Frequenza giornaliera media in aumento e CTR in calo materiale: pattern compatibile con perdita di risposta / possibile saturazione — non confermato.",
              evidence: [
                `Frequenza media (giornaliera): ${freqPrev.toFixed(2)} → ${freqCur.toFixed(2)}`,
                ctrT
                  ? `CTR ${formatPctPoints(ctrT.previous)} → ${formatPctPoints(ctrT.current)}`
                  : "",
              ].filter(Boolean),
              limitations: [
                "La frequenza giornaliera non è la frequenza di periodo Meta su reach unico.",
                "Non è una conferma di creative fatigue.",
              ],
            });
            hypotheses.push(
              "Il pattern è compatibile con perdita di risposta / possibile saturazione (non provato).",
            );
            if (primaryObservation === "NO_COMPARISON_AVAILABLE") {
              primaryObservation = "POSSIBLE_FATIGUE_SIGNAL";
            }
            confidence = "BASSA";
          }
        }
      }
    } else if (!sampleOk) {
      findings.push({
        code: "CREATIVE_DATA_INSUFFICIENT",
        confidence: "BASSA",
        title: "Delivery ancora limitata",
        explanation:
          "Non ci sono ancora abbastanza dati per confrontare le inserzioni o leggere un trend stabile.",
        evidence: [
          `Giorni con insight: ${ad.dayCount}`,
          `Impression: ${formatInt(ad.impressions)}`,
        ],
        limitations: [],
      });
    }

    const beginnerSummary =
      primaryObservation === "ONE_AD_CONCENTRATES_TRAFFIC_DECLINE"
        ? "È presente una sola inserzione: il confronto tra varianti non è possibile. La risposta al clic è peggiorata nel periodo più recente."
        : primaryObservation === "POSSIBLE_FATIGUE_SIGNAL"
          ? "È presente una sola inserzione. Il pattern temporale è compatibile con perdita di risposta, ma non è una conferma."
          : "È presente una sola inserzione: non è possibile confrontare varianti creative.";

    if (input.isHistorical) {
      facts.push("Campagna storica/in pausa: nessuna urgenza operativa da questa lettura.");
    }

    return finish(
      {
        evaluability: sampleOk ? "LIMITED" : "INSUFFICIENT_DATA",
        comparisonMode,
        confidence,
        beginnerLabel: "Confronto creativo non disponibile",
        beginnerSummary,
        primaryObservation,
        ads: buildSnapshots(ads, totalSpend, new Set()),
        findings,
        facts,
        hypotheses,
        unknowns,
        nextTest:
          "Introduci una seconda variante nello stesso gruppo di inserzioni, mantenendo il più possibile invariati pubblico e impostazioni di distribuzione.",
        comparisonWindowLabel,
      },
      ads,
    );
  }

  // ——— MULTI AD ———
  const fingerprints = ads.map(messageFingerprint);
  const allSameMessage = fingerprints.every((f) => f === fingerprints[0]);
  const allHaveMessage = fingerprints.every((f) => f !== "||||");
  if (allHaveMessage) {
    if (allSameMessage) {
      findings.push({
        code: "MESSAGE_VARIANTS_SAME",
        confidence: "ALTA",
        title: "Messaggio condiviso",
        explanation: "Le inserzioni condividono lo stesso messaggio (titolo/testo/CTA).",
        evidence: [],
        limitations: [],
      });
      facts.push("Le inserzioni condividono lo stesso messaggio.");
    } else {
      findings.push({
        code: "MESSAGE_VARIANTS_DIFFER",
        confidence: "ALTA",
        title: "Messaggi diversi",
        explanation: "Le inserzioni usano messaggi diversi.",
        evidence: [],
        limitations: [],
      });
      facts.push("Le inserzioni usano messaggi diversi.");
    }
  }

  if (multiAdSet) {
    findings.push({
      code: "MULTI_AD_SET_CONFOUND",
      confidence: "MEDIA",
      title: "Gruppi di inserzioni diversi",
      explanation:
        "Le inserzioni sono distribuite in gruppi diversi; pubblico e distribuzione possono influenzare il confronto.",
      evidence: [`Gruppi distinti: ${adSetIds.size}`],
      limitations: [
        "Non attribuire la differenza solo alla creatività.",
      ],
    });
    unknowns.push(
      "Le inserzioni sono in gruppi diversi: pubblico e distribuzione possono confondere il confronto creativo.",
    );
  }

  // Delivery imbalance among ads with any spend
  const delivered = ads.filter((a) => spendOf(a) > 0 || impressionsOf(a) > 0);
  const deliveredSpend = delivered.reduce((s, a) => s + spendOf(a), 0);
  let imbalanceAd: CreativeAdInput | null = null;
  if (deliveredSpend > 0 && delivered.length >= 2) {
    for (const ad of delivered) {
      const share = spendOf(ad) / deliveredSpend;
      if (share >= DELIVERY_IMBALANCE_SPEND_SHARE) {
        imbalanceAd = ad;
        break;
      }
    }
  }

  if (imbalanceAd) {
    const share = spendOf(imbalanceAd) / deliveredSpend;
    findings.push({
      code: "DELIVERY_IMBALANCE",
      confidence: "ALTA",
      title: "Delivery sbilanciata",
      explanation: `Meta ha concentrato la maggior parte della spesa sull'inserzione «${imbalanceAd.name}».`,
      evidence: [
        `Quota spesa: ${Math.round(share * 100)}%`,
        `Impression: ${formatInt(imbalanceAd.impressions)}`,
      ],
      limitations: [
        "Le altre inserzioni non vanno etichettate come sottoperformanti solo per poca delivery.",
        "Non inferiamo perché Meta abbia distribuito così la spesa.",
      ],
    });
    facts.push(
      `Meta ha concentrato circa il ${Math.round(share * 100)}% della spesa sull'inserzione «${imbalanceAd.name}».`,
    );
  }

  // Comparability set
  const comparable: CreativeAdInput[] = [];
  for (const ad of ads) {
    if (!adSampleSufficient(ad)) continue;
    if (deliveredSpend > 0) {
      const share = spendOf(ad) / deliveredSpend;
      if (share < MIN_PEER_SPEND_SHARE && impressionsOf(ad) < MIN_IMPRESSIONS_FOR_COMPARE) {
        continue;
      }
    }
    comparable.push(ad);
  }

  // If imbalance and thin peers → NOT_COMPARABLE
  if (imbalanceAd && comparable.length < 2) {
    unknowns.push(
      "Il confronto tra inserzioni non è affidabile: la delivery è troppo sbilanciata.",
    );
    return finish(
      {
        evaluability: "NOT_COMPARABLE",
        comparisonMode: "NONE",
        confidence: "MEDIA",
        beginnerLabel: "Confronto non affidabile",
        beginnerSummary:
          "La spesa è concentrata su un'inserzione: non confrontare le altre come sottoperformanti.",
        primaryObservation: "DELIVERY_IMBALANCE",
        ads: buildSnapshots(ads, totalSpend, new Set()),
        findings,
        facts,
        hypotheses,
        unknowns,
        nextTest:
          "Lascia accumulare più delivery sulle altre inserzioni, oppure confronta nuove varianti con budget più equilibrato.",
        comparisonWindowLabel: null,
      },
      ads,
    );
  }

  if (comparable.length < 2) {
    unknowns.push(
      "Non ci sono ancora abbastanza dati per confrontare le inserzioni.",
    );
    return finish(
      {
        evaluability: "INSUFFICIENT_DATA",
        comparisonMode: "NONE",
        confidence: "BASSA",
        beginnerLabel: "Dati ancora insufficienti",
        beginnerSummary:
          "Non ci sono ancora abbastanza dati per confrontare le inserzioni.",
        primaryObservation: "CREATIVE_DATA_INSUFFICIENT",
        ads: buildSnapshots(ads, totalSpend, new Set()),
        findings,
        facts,
        hypotheses,
        unknowns,
        nextTest:
          "Lascia accumulare più delivery prima di confrontare le inserzioni.",
        comparisonWindowLabel: null,
      },
      ads,
    );
  }

  const comparableIds = new Set(comparable.map((a) => a.metaAdId));
  let confidence: CreativeConfidence = multiAdSet ? "BASSA" : "MEDIA";
  let primaryObservation: CreativePrimaryObservation = "NEUTRAL_DIFFERENCE";
  let evaluability: CreativeIntelligence["evaluability"] = multiAdSet
    ? "LIMITED"
    : "FULL";

  // Prefer same-ad-set peer group when possible
  const bySet = new Map<string, CreativeAdInput[]>();
  for (const ad of comparable) {
    const list = bySet.get(ad.metaAdSetId) ?? [];
    list.push(ad);
    bySet.set(ad.metaAdSetId, list);
  }
  let peers = comparable;
  for (const group of bySet.values()) {
    if (group.length >= 2) {
      peers = group;
      confidence = "ALTA";
      evaluability = "FULL";
      break;
    }
  }
  const peerIds = new Set(peers.map((a) => a.metaAdId));

  // Traffic-stage comparison
  if (
    allowsTrafficMetrics(input.performanceFamily) &&
    !allowsAwarenessMetrics(input.performanceFamily)
  ) {
    const withCtr = peers.filter((a) => a.ctr != null);
    if (withCtr.length >= 2) {
      const sorted = [...withCtr].sort(
        (a, b) => (b.ctr as number) - (a.ctr as number),
      );
      const best = sorted[0]!;
      const worst = sorted[sorted.length - 1]!;
      const delta = relativeDeltaPct(best.ctr as number, worst.ctr as number);
      facts.push(
        `Inserzione «${best.name}» CTR ${formatPctPoints(best.ctr)} rispetto a «${worst.name}» ${formatPctPoints(worst.ctr)} con delivery comparabile.`,
      );

      if (Math.abs(delta) >= MATERIAL_CHANGE_PCT) {
        findings.push({
          code: "CLICK_RESPONSE_DIFFERENCE",
          confidence,
          title: "Differenza di risposta al clic",
          explanation: `La differenza di risposta è concentrata: «${best.name}» genera più clic per impressione rispetto a «${worst.name}».`,
          evidence: [
            `CTR ${formatPctPoints(worst.ctr)} vs ${formatPctPoints(best.ctr)} (Δ relativo ${delta}%)`,
            `Soglia materiale Ally: |Δ|≥${MATERIAL_CHANGE_PCT}% (regola interna, non benchmark Meta).`,
          ],
          limitations: [
            "Non implica un giudizio estetico o di qualità sul contenuto.",
            "La causa della differenza rimane sconosciuta.",
          ],
        });
        primaryObservation = "ONE_AD_HAS_HIGHER_CLICK_EFFICIENCY";
        hypotheses.push(
          "La differenza è compatibile con una diversa risposta al messaggio/visual (non provata).",
        );
        unknowns.push(
          "Non possiamo stabilire dai dati disponibili quale elemento creativo abbia causato la differenza.",
        );

        const withCpc = peers.filter((a) => a.cpc != null);
        if (withCpc.length >= 2) {
          const byCpc = [...withCpc].sort(
            (a, b) => (a.cpc as number) - (b.cpc as number),
          );
          const cheap = byCpc[0]!;
          const dear = byCpc[byCpc.length - 1]!;
          const cpcDelta = relativeDeltaPct(
            dear.cpc as number,
            cheap.cpc as number,
          );
          if (Math.abs(cpcDelta) >= MATERIAL_CHANGE_PCT) {
            findings.push({
              code: "CLICK_COST_DIFFERENCE",
              confidence,
              title: "Differenza di costo per clic",
              explanation: `«${cheap.name}» ha CPC inferiore a «${dear.name}» con delivery comparabile.`,
              evidence: [
                `CPC ${formatEuro(cheap.cpc)} vs ${formatEuro(dear.cpc)}`,
              ],
              limitations: ["Non è un giudizio sul contenuto creativo."],
            });
            facts.push(
              `CPC: «${cheap.name}» ${formatEuro(cheap.cpc)} vs «${dear.name}» ${formatEuro(dear.cpc)}.`,
            );
          }
        }
      } else {
        facts.push(
          "Le differenze di CTR non sono abbastanza marcate per una conclusione utile.",
        );
        primaryObservation = "NEUTRAL_DIFFERENCE";
      }
    }
  }

  // Awareness: delivery/CPM only — no CTR as primary creative judgement
  if (allowsAwarenessMetrics(input.performanceFamily)) {
    const withCpm = peers.filter((a) => a.cpm != null);
    if (withCpm.length >= 2) {
      const sorted = [...withCpm].sort(
        (a, b) => (a.cpm as number) - (b.cpm as number),
      );
      facts.push(
        `CPM: «${sorted[0]!.name}» ${formatEuro(sorted[0]!.cpm)} vs «${sorted[sorted.length - 1]!.name}» ${formatEuro(sorted[sorted.length - 1]!.cpm)}.`,
      );
    }
    unknowns.push(
      "Per Awareness non usiamo CTR come giudizio primario sulle creatività.",
    );
  }

  // Result-stage (only confident mapping + tracking ok)
  if (allowsResultStage(input)) {
    const withCost = peers.filter(
      (a) =>
        a.resultMappingConfidence === "CONFIDENT" &&
        a.costPerResult != null &&
        a.results != null &&
        a.results > 0,
    );
    if (withCost.length >= 2) {
      const sorted = [...withCost].sort(
        (a, b) =>
          (a.costPerResult as number) - (b.costPerResult as number),
      );
      const best = sorted[0]!;
      const worst = sorted[sorted.length - 1]!;
      const delta = relativeDeltaPct(
        worst.costPerResult as number,
        best.costPerResult as number,
      );
      const metricLabel =
        input.performanceFamily === "SALES" ? "costo/risultato" : "CPL";
      facts.push(
        `${metricLabel}: «${best.name}» ${formatEuro(best.costPerResult)} vs «${worst.name}» ${formatEuro(worst.costPerResult)}.`,
      );
      if (Math.abs(delta) >= MATERIAL_CHANGE_PCT) {
        findings.push({
          code: "RESULT_RESPONSE_DIFFERENCE",
          confidence: confidence === "ALTA" ? "MEDIA" : "BASSA",
          title: "Differenza allo stadio risultato",
          explanation: `I dati indicano una differenza di ${metricLabel} tra inserzioni comparabili.`,
          evidence: [
            `${formatEuro(best.costPerResult)} vs ${formatEuro(worst.costPerResult)} (Δ relativo ${delta}%)`,
          ],
          limitations: [
            "La causa rimane sconosciuta.",
            "Non equivale a dichiarare una creatività vincente o perdente.",
          ],
        });
        if (
          primaryObservation === "NEUTRAL_DIFFERENCE"
        ) {
          primaryObservation = "RESULT_STAGE_DIFFERENCE";
        }
        unknowns.push(
          `Non possiamo stabilire perché il ${metricLabel} differisca tra le inserzioni.`,
        );
      }
    }
  } else if (
    (input.performanceFamily === "LEADS" ||
      input.performanceFamily === "SALES") &&
    (input.campaignResultMapping === "AMBIGUOUS" ||
      input.campaignResultMapping === "UNKNOWN")
  ) {
    unknowns.push(
      "Confronto risultati conversioni bloccato: mapping del risultato non affidabile.",
    );
    facts.push(
      "Il confronto traffico (CTR/CPC) resta disponibile indipendentemente dall'ambiguità del risultato.",
    );
  }

  // Fatigue across single peer with self-trend (optional enrichment)
  for (const ad of peers) {
    if (ad.insightRows.length < 14) continue;
    const trend = computeMetaTrend(ad.insightRows);
    const ctrT = findDiagnostic(trend.diagnostics, "ctr");
    if (!isMaterialWorsening(ctrT)) continue;
    const delivery = ad.insightRows
      .filter((r) => r.spend != null && r.spend > 0)
      .sort((a, b) => a.dateStart.localeCompare(b.dateStart));
    if (delivery.length < 14) continue;
    const freqCur = avgDailyFrequency(delivery.slice(-7));
    const freqPrev = avgDailyFrequency(delivery.slice(-14, -7));
    if (
      freqCur != null &&
      freqPrev != null &&
      freqCur - freqPrev >= FATIGUE_FREQ_RISE_ABS
    ) {
      if (!findings.some((f) => f.code === "POSSIBLE_FATIGUE_PATTERN")) {
        findings.push({
          code: "POSSIBLE_FATIGUE_PATTERN",
          confidence: "BASSA",
          title: "Pattern compatibile con perdita di risposta",
          explanation: `Su «${ad.name}»: frequenza in aumento e CTR in calo — compatibile con saturazione, non confermato.`,
          evidence: [
            `Frequenza media: ${freqPrev.toFixed(2)} → ${freqCur.toFixed(2)}`,
          ],
          limitations: ["Ipotesi, non root cause."],
        });
        hypotheses.push(
          `Su «${ad.name}» il pattern è compatibile con perdita di risposta / possibile saturazione (non provato).`,
        );
      }
      break;
    }
  }

  if (primaryObservation === "NEUTRAL_DIFFERENCE") {
    facts.push(
      "Le differenze non sono abbastanza marcate per una conclusione utile, oppure mancano metriche confrontabili.",
    );
  }

  if (input.isHistorical) {
    facts.push("Campagna storica/in pausa: nessuna urgenza da questa lettura creativa.");
  }

  const beginnerSummary =
    primaryObservation === "ONE_AD_HAS_HIGHER_CLICK_EFFICIENCY"
      ? `La differenza di risposta è concentrata sull'inserzione con CTR più alto tra pari comparabili.`
      : primaryObservation === "RESULT_STAGE_DIFFERENCE"
        ? "I dati indicano una differenza allo stadio risultato tra inserzioni comparabili; la causa non è determinabile."
        : primaryObservation === "NEUTRAL_DIFFERENCE"
          ? "Le differenze non sono abbastanza marcate per una conclusione utile."
          : "Confronto creativo basato su evidenze di delivery disponibili.";

  const nextTest =
    primaryObservation === "ONE_AD_HAS_HIGHER_CLICK_EFFICIENCY"
      ? "Confronta una nuova variante nello stesso gruppo di inserzioni, mantenendo il più possibile invariati pubblico e impostazioni di distribuzione."
      : allowsResultStage(input)
        ? "Mantieni pubblico e distribuzione il più possibile invariati e varia un solo elemento creativo alla volta."
        : input.performanceFamily === "AWARENESS"
          ? "Confronta reach/frequenza/CPM con delivery più equilibrata prima di trarre conclusioni."
          : input.campaignResultMapping !== "CONFIDENT" &&
              (input.performanceFamily === "LEADS" ||
                input.performanceFamily === "SALES")
            ? "Prima di giudicare il risultato creativo, chiarisci il mapping del risultato."
            : "Lascia accumulare più delivery prima di confrontare.";

  return finish(
    {
      evaluability,
      comparisonMode: "CROSS_AD",
      confidence,
      beginnerLabel:
        primaryObservation === "NEUTRAL_DIFFERENCE"
          ? "Differenze non conclusive"
          : "Differenza di risposta tra inserzioni",
      beginnerSummary,
      primaryObservation,
      ads: buildSnapshots(ads, totalSpend, peerIds.size ? peerIds : comparableIds),
      findings,
      facts,
      hypotheses,
      unknowns,
      nextTest,
      comparisonWindowLabel: null,
    },
    ads,
  );
}

export function etichettaCreativeEvaluability(
  e: CreativeIntelligence["evaluability"],
): string {
  switch (e) {
    case "FULL":
      return "Confrontabile";
    case "LIMITED":
      return "Confronto limitato";
    case "NOT_COMPARABLE":
      return "Non confrontabile";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    default:
      return e;
  }
}
