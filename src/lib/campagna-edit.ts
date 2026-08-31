import type { Campagna } from "@/types/campagne";
import type { CreativitaMeta } from "@/lib/creativita";

export type SnapshotSostanzialeInput = {
  frontEndOffer?: string | null;
  elevatorPitch?: string | null;
  varianteA?: string | null;
  varianteB?: string | null;
  varianteC?: string | null;
  titoloAnnuncio?: string | null;
  creativita?: Array<{ id?: string; storagePath?: string | null } | CreativitaMeta> | null;
  dailyBudget?: number | null;
  launchBudget?: number | null;
  citta?: string | null;
  raggioKm?: number | null;
  etaMin?: number | null;
  etaMax?: number | null;
  targetType?: string | null;
  targetAge?: string | null;
  ticket?: number | null;
  conversionRate?: number | null;
  margine?: number | null;
  objective?: string | null;
  destinationUrl?: string | null;
  heroProduct?: string | null;
  bookingChannel?: string | null;
};

function testo(valore: string | null | undefined): string {
  return (valore ?? "").trim().replace(/\s+/g, " ");
}

function numero(valore: number | null | undefined): string {
  const n = Number(valore);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function firmaCreativita(
  lista: SnapshotSostanzialeInput["creativita"],
): string {
  if (!lista || lista.length === 0) return "";
  return [...lista]
    .map((item) => {
      const id = (item.id ?? "").trim();
      const path =
        "storagePath" in item ? (item.storagePath ?? "").trim() : "";
      return `${id}:${path}`;
    })
    .sort()
    .join(",");
}

/**
 * Firma canonica (ordine chiavi fisso) dei campi che il cliente ha approvato.
 * Non include Page ID, Form ID, conversion_rate_source, nome campagna interno.
 */
export function firmaSostanziale(input: SnapshotSostanzialeInput): string {
  return [
    `offer=${testo(input.frontEndOffer)}`,
    `brief=${testo(input.elevatorPitch)}`,
    `a=${testo(input.varianteA)}`,
    `b=${testo(input.varianteB)}`,
    `c=${testo(input.varianteC)}`,
    `headline=${testo(input.titoloAnnuncio)}`,
    `creative=${firmaCreativita(input.creativita)}`,
    `budget=${numero(input.dailyBudget)}`,
    `launch=${numero(input.launchBudget)}`,
    `citta=${testo(input.citta)}`,
    `raggio=${numero(input.raggioKm)}`,
    `etaMin=${numero(input.etaMin)}`,
    `etaMax=${numero(input.etaMax)}`,
    `targetType=${testo(input.targetType).toUpperCase()}`,
    `targetAge=${testo(input.targetAge)}`,
    `ticket=${numero(input.ticket)}`,
    `conv=${numero(input.conversionRate)}`,
    `margine=${numero(input.margine)}`,
    `obj=${testo(input.objective).toUpperCase()}`,
    `dest=${testo(input.destinationUrl)}`,
    `hero=${testo(input.heroProduct)}`,
    `channel=${testo(input.bookingChannel).toUpperCase()}`,
  ].join("|");
}

export function ticketDaCampagna(c: Campagna): number | undefined {
  const objective = c.objective ?? "LEADS";
  if (objective === "RETARGETING") return c.recoveryValue ?? c.scontrinoMedio;
  if (objective === "IN_STORE") return c.averageReceipt ?? c.scontrinoMedio;
  if (objective === "ECOMMERCE") return c.averageOrderValue ?? c.scontrinoMedio;
  if (objective === "BOOKINGS") return c.bookingServiceValue ?? c.scontrinoMedio;
  return c.scontrinoMedio;
}

export function margineDaCampagna(c: Campagna): number | undefined {
  const objective = c.objective ?? "LEADS";
  if (objective === "ECOMMERCE" || objective === "IN_STORE") {
    return c.productMargin ?? c.storeMargin ?? c.targetMargin;
  }
  if (objective === "RETARGETING") {
    return c.recoveryMargin ?? c.targetMargin;
  }
  return c.targetMargin;
}

export function snapshotDaCampagna(c: Campagna): string {
  const objective = c.objective ?? "LEADS";
  return firmaSostanziale({
    frontEndOffer: c.frontEndOffer,
    elevatorPitch: c.elevatorPitch,
    varianteA: c.varianteA,
    varianteB: c.varianteB,
    varianteC: c.varianteC,
    titoloAnnuncio: c.titoloAnnuncio,
    creativita: c.creativitaMeta,
    dailyBudget: c.budgetGiornaliero,
    launchBudget: c.launchBudget,
    citta: c.citta,
    raggioKm: c.awarenessRadiusKm ?? c.raggioKm,
    etaMin: c.etaMin,
    etaMax: c.etaMax,
    targetType: c.targetType,
    targetAge: c.targetAge,
    ticket: ticketDaCampagna(c),
    conversionRate: c.showUpRate ?? c.tassoConversionePercent,
    margine: margineDaCampagna(c),
    objective,
    destinationUrl: c.website,
    heroProduct: c.heroProduct,
    bookingChannel: c.bookingChannel,
  });
}

export function haModificaSostanziale(
  iniziale: string,
  corrente: string,
): boolean {
  return iniziale !== corrente;
}

/**
 * A DRAFT → invariato
 * B REVISION_REQUESTED → invariato (solo "Rimanda in approvazione" va a DRAFT)
 * C APPROVED + sostanziale → invalida (DRAFT, approved_at null, token identico)
 * D APPROVED + non sostanziale → invariato
 */
export function deveInvalidareApprovazione(
  statusAttuale: string | null | undefined,
  sostanziale: boolean,
): boolean {
  const s = (statusAttuale ?? "").toUpperCase();
  return s === "APPROVED" && sostanziale;
}
