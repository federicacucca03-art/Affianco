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

/** Snapshot strutturato per il diario (in parallelo alla firma sostanziale). */
export type SnapshotConfigurazioneInput = SnapshotSostanzialeInput & {
  pageId?: string | null;
  formId?: string | null;
  conversionRateSource?: string | null;
  nomeCampagna?: string | null;
};

export type SnapshotConfigurazione = {
  dailyBudget: number;
  launchBudget: number;
  citta: string;
  raggioKm: number;
  etaMin: number;
  etaMax: number;
  targetType: string;
  targetAge: string;
  ticket: number;
  conversionRate: number;
  margine: number;
  objective: string;
  destinationUrl: string;
  pageId: string;
  formId: string;
  conversionRateSource: string;
  nomeCampagna: string;
  frontEndOffer: string;
  elevatorPitch: string;
  varianteA: string;
  varianteB: string;
  varianteC: string;
  titoloAnnuncio: string;
  heroProduct: string;
  bookingChannel: string;
  creativita: Array<{ id: string; storagePath: string }>;
};

export type DiffConfigurazioneItem = {
  campo: string;
  kind: "changed" | "added" | "removed";
  descrizione: string;
};

function numeroValore(valore: number | null | undefined): number {
  const n = Number(valore);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function formatEuro(valore: number): string {
  const v = numeroValore(valore);
  const [int, dec] = v.toFixed(2).split(".");
  const conMigliaia = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${conMigliaia},${dec}€`;
}

function formatPercent(valore: number): string {
  const v = numeroValore(valore);
  if (Number.isInteger(v)) return `${v}%`;
  return `${String(v).replace(".", ",")}%`;
}

function formatEta(min: number, max: number): string {
  return `${numeroValore(min)}–${numeroValore(max)}`;
}

function metaCreativita(
  lista: SnapshotSostanzialeInput["creativita"],
): Array<{ id: string; storagePath: string }> {
  if (!lista || lista.length === 0) return [];
  return [...lista]
    .map((item) => ({
      id: (item.id ?? "").trim(),
      storagePath:
        "storagePath" in item ? (item.storagePath ?? "").trim() : "",
    }))
    .filter((item) => item.id || item.storagePath)
    .sort((a, b) => {
      const ka = `${a.id}:${a.storagePath}`;
      const kb = `${b.id}:${b.storagePath}`;
      return ka.localeCompare(kb);
    });
}

function firmaMetaCreativita(
  lista: Array<{ id: string; storagePath: string }>,
): string {
  return lista.map((item) => `${item.id}:${item.storagePath}`).join(",");
}

export function creaSnapshotConfigurazione(
  input: SnapshotConfigurazioneInput,
): SnapshotConfigurazione {
  return {
    dailyBudget: numeroValore(input.dailyBudget),
    launchBudget: numeroValore(input.launchBudget),
    citta: testo(input.citta),
    raggioKm: numeroValore(input.raggioKm),
    etaMin: numeroValore(input.etaMin),
    etaMax: numeroValore(input.etaMax),
    targetType: testo(input.targetType).toUpperCase(),
    targetAge: testo(input.targetAge),
    ticket: numeroValore(input.ticket),
    conversionRate: numeroValore(input.conversionRate),
    margine: numeroValore(input.margine),
    objective: testo(input.objective).toUpperCase(),
    destinationUrl: testo(input.destinationUrl),
    pageId: testo(input.pageId),
    formId: testo(input.formId),
    conversionRateSource: testo(input.conversionRateSource).toUpperCase(),
    nomeCampagna: testo(input.nomeCampagna),
    frontEndOffer: testo(input.frontEndOffer),
    elevatorPitch: testo(input.elevatorPitch),
    varianteA: testo(input.varianteA),
    varianteB: testo(input.varianteB),
    varianteC: testo(input.varianteC),
    titoloAnnuncio: testo(input.titoloAnnuncio),
    heroProduct: testo(input.heroProduct),
    bookingChannel: testo(input.bookingChannel).toUpperCase(),
    creativita: metaCreativita(input.creativita),
  };
}

function fraseLunga(
  etichettaModificata: string,
  etichettaAggiunta: string,
  etichettaRimossa: string,
  prima: string,
  dopo: string,
): DiffConfigurazioneItem | null {
  if (prima === dopo) return null;
  const campo = etichettaModificata.toLowerCase();
  if (!prima && dopo) {
    return { campo, kind: "added", descrizione: etichettaAggiunta };
  }
  if (prima && !dopo) {
    return { campo, kind: "removed", descrizione: etichettaRimossa };
  }
  return { campo, kind: "changed", descrizione: etichettaModificata };
}

function fraseCortaId(
  etichetta: string,
  prima: string,
  dopo: string,
): DiffConfigurazioneItem | null {
  if (prima === dopo) return null;
  if (!prima && dopo) {
    return {
      campo: etichetta,
      kind: "added",
      descrizione: `${etichetta} aggiunto`,
    };
  }
  if (prima && !dopo) {
    return {
      campo: etichetta,
      kind: "removed",
      descrizione: `${etichetta} rimosso`,
    };
  }
  return {
    campo: etichetta,
    kind: "changed",
    descrizione: `${etichetta}: ${prima} → ${dopo}`,
  };
}

function fraseCorta(
  campo: string,
  etichetta: string,
  prima: string,
  dopo: string,
): DiffConfigurazioneItem | null {
  if (prima === dopo) return null;
  if (!prima && dopo) {
    return {
      campo,
      kind: "added",
      descrizione: `${etichetta}: ${dopo}`,
    };
  }
  if (prima && !dopo) {
    return {
      campo,
      kind: "removed",
      descrizione: `${etichetta} rimosso`,
    };
  }
  return {
    campo,
    kind: "changed",
    descrizione: `${etichetta}: ${prima} → ${dopo}`,
  };
}

function diffCreativita(
  prima: SnapshotConfigurazione["creativita"],
  dopo: SnapshotConfigurazione["creativita"],
): DiffConfigurazioneItem | null {
  const a = firmaMetaCreativita(prima);
  const b = firmaMetaCreativita(dopo);
  if (a === b) return null;
  if (!a && b) {
    return {
      campo: "creativita",
      kind: "added",
      descrizione: "Creatività aggiunta",
    };
  }
  if (a && !b) {
    return {
      campo: "creativita",
      kind: "removed",
      descrizione: "Creatività rimossa",
    };
  }
  return {
    campo: "creativita",
    kind: "changed",
    descrizione: "Creatività sostituita",
  };
}

/**
 * Diff campo-per-campo (ordine fisso). Non usa JSON.stringify come confronto.
 */
export function diffConfigurazione(
  before: SnapshotConfigurazione,
  after: SnapshotConfigurazione,
): DiffConfigurazioneItem[] {
  const out: DiffConfigurazioneItem[] = [];
  const push = (item: DiffConfigurazioneItem | null) => {
    if (item) out.push(item);
  };

  if (before.dailyBudget !== after.dailyBudget) {
    push({
      campo: "dailyBudget",
      kind: "changed",
      descrizione: `Budget giornaliero: ${formatEuro(before.dailyBudget)} → ${formatEuro(after.dailyBudget)}`,
    });
  }
  if (before.launchBudget !== after.launchBudget) {
    push({
      campo: "launchBudget",
      kind: "changed",
      descrizione: `Budget di lancio: ${formatEuro(before.launchBudget)} → ${formatEuro(after.launchBudget)}`,
    });
  }
  push(fraseCorta("citta", "Città", before.citta, after.citta));
  if (before.raggioKm !== after.raggioKm) {
    push({
      campo: "raggioKm",
      kind: "changed",
      descrizione: `Raggio: ${numeroValore(before.raggioKm)} km → ${numeroValore(after.raggioKm)} km`,
    });
  }
  const etaPrima = formatEta(before.etaMin, before.etaMax);
  const etaDopo = formatEta(after.etaMin, after.etaMax);
  if (etaPrima !== etaDopo) {
    push({
      campo: "eta",
      kind: "changed",
      descrizione: `Età: ${etaPrima} → ${etaDopo}`,
    });
  }
  push(fraseCorta("targetType", "Target", before.targetType, after.targetType));
  push(
    fraseCorta("targetAge", "Fascia d'età", before.targetAge, after.targetAge),
  );
  if (before.ticket !== after.ticket) {
    push({
      campo: "ticket",
      kind: "changed",
      descrizione: `Ticket medio: ${formatEuro(before.ticket)} → ${formatEuro(after.ticket)}`,
    });
  }
  if (before.conversionRate !== after.conversionRate) {
    push({
      campo: "conversionRate",
      kind: "changed",
      descrizione: `Conversion rate: ${formatPercent(before.conversionRate)} → ${formatPercent(after.conversionRate)}`,
    });
  }
  if (before.margine !== after.margine) {
    push({
      campo: "margine",
      kind: "changed",
      descrizione: `Margine: ${formatPercent(before.margine)} → ${formatPercent(after.margine)}`,
    });
  }
  push(
    fraseCorta("objective", "Obiettivo", before.objective, after.objective),
  );
  push(
    fraseCorta(
      "destinationUrl",
      "URL destinazione",
      before.destinationUrl,
      after.destinationUrl,
    ),
  );
  push(fraseCortaId("Page ID", before.pageId, after.pageId));
  push(fraseCortaId("Form ID", before.formId, after.formId));
  push(
    fraseCorta(
      "conversionRateSource",
      "Fonte conversion rate",
      before.conversionRateSource,
      after.conversionRateSource,
    ),
  );
  push(
    fraseCorta(
      "nomeCampagna",
      "Nome campagna",
      before.nomeCampagna,
      after.nomeCampagna,
    ),
  );
  push(
    fraseLunga(
      "Offerta modificata",
      "Offerta aggiunta",
      "Offerta rimossa",
      before.frontEndOffer,
      after.frontEndOffer,
    ),
  );
  push(
    fraseLunga(
      "Brief modificato",
      "Brief aggiunto",
      "Brief rimosso",
      before.elevatorPitch,
      after.elevatorPitch,
    ),
  );
  push(
    fraseLunga(
      "Variante A modificata",
      "Variante A aggiunta",
      "Variante A rimossa",
      before.varianteA,
      after.varianteA,
    ),
  );
  push(
    fraseLunga(
      "Variante B modificata",
      "Variante B aggiunta",
      "Variante B rimossa",
      before.varianteB,
      after.varianteB,
    ),
  );
  push(
    fraseLunga(
      "Variante C modificata",
      "Variante C aggiunta",
      "Variante C rimossa",
      before.varianteC,
      after.varianteC,
    ),
  );
  push(
    fraseLunga(
      "Headline modificata",
      "Headline aggiunta",
      "Headline rimossa",
      before.titoloAnnuncio,
      after.titoloAnnuncio,
    ),
  );
  push(
    fraseLunga(
      "Hero product modificato",
      "Hero product aggiunto",
      "Hero product rimosso",
      before.heroProduct,
      after.heroProduct,
    ),
  );
  push(
    fraseCorta(
      "bookingChannel",
      "Canale prenotazione",
      before.bookingChannel,
      after.bookingChannel,
    ),
  );
  push(diffCreativita(before.creativita, after.creativita));
  return out;
}

export function testoLogAggiornamento(
  changeset: DiffConfigurazioneItem[],
  opts?: { richiestaNuovaApprovazione?: boolean },
): { title: string; description: string } {
  const n = changeset.length;
  const title =
    n === 1
      ? "Configurazione modificata"
      : `${n} modifiche alla configurazione`;
  const parti = changeset.map((c) => c.descrizione);
  if (opts?.richiestaNuovaApprovazione) {
    parti.push("Richiesta nuova approvazione");
  }
  return { title, description: parti.join(" · ") };
}
