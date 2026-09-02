import type { CreativitaMeta } from "@/lib/creativita";
import type {
  BookingChannel,
  CampagnaObjective,
  ConfigurazioneContatti,
  TargetType,
} from "@/types/campagne";

export type MetaExportProfile =
  | "LEADS_FORM"
  | "BOOKINGS_WHATSAPP"
  | "BOOKINGS_WEBSITE"
  | "BOOKINGS_PHONE"
  | "BOOKINGS_IG_DM"
  | "BOOKINGS_FORM"
  | "ECOMMERCE"
  | "INSTORE"
  | "RETARGETING"
  | "AWARENESS_REACH"
  | "AWARENESS_LINK";

export type MetaExportReadiness =
  | "READY"
  | "READY_WITH_MISSING_META_DETAILS"
  | "NOT_EXPORTABLE";

export type MetaExportValidation = {
  status: MetaExportReadiness;
  blockers: string[];
  warnings: string[];
  profile: MetaExportProfile;
};

/** Page/Form: required | missing-meta-detail | not_applicable — per profilo, non globale. */
export const META_EXPORT_PAGE_FORM: Record<
  MetaExportProfile,
  {
    page: "required" | "missing-meta-detail" | "not_applicable";
    form: "required" | "missing-meta-detail" | "not_applicable";
  }
> = {
  LEADS_FORM: { page: "missing-meta-detail", form: "required" },
  BOOKINGS_FORM: { page: "missing-meta-detail", form: "required" },
  BOOKINGS_WHATSAPP: { page: "missing-meta-detail", form: "not_applicable" },
  BOOKINGS_WEBSITE: { page: "missing-meta-detail", form: "not_applicable" },
  BOOKINGS_PHONE: { page: "missing-meta-detail", form: "not_applicable" },
  BOOKINGS_IG_DM: { page: "missing-meta-detail", form: "not_applicable" },
  ECOMMERCE: { page: "missing-meta-detail", form: "not_applicable" },
  INSTORE: { page: "missing-meta-detail", form: "not_applicable" },
  RETARGETING: { page: "missing-meta-detail", form: "not_applicable" },
  AWARENESS_REACH: { page: "missing-meta-detail", form: "not_applicable" },
  AWARENESS_LINK: { page: "missing-meta-detail", form: "not_applicable" },
};

export type MetaExportValutaInput = {
  config: ConfigurazioneContatti;
  pageId?: string;
  formId?: string;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  destinationUrl?: string;
  whatsappNumber?: string;
  targetType?: TargetType;
  creativitaMeta?: CreativitaMeta[];
};

const BLOCK_COPY = "Inserisci almeno un testo annuncio.";
const BLOCK_BUDGET = "Indica un budget giornaliero maggiore di zero.";
const BLOCK_URL = "Indica un URL di destinazione valido (http o https).";
const BLOCK_FORM = "Indica l'ID del modulo Lead di Meta.";
const BLOCK_WA = "Indica un numero WhatsApp Business utilizzabile.";
const BLOCK_RADIUS = "Indica un raggio di targeting maggiore di zero.";
const WARN_PAGE = "Pagina Facebook da completare in Ads Manager.";
const WARN_PIXEL = "Verifica pixel/dataset in Ads Manager.";
const WARN_AUDIENCE =
  "Seleziona l'audience di retargeting in Ads Manager.";
const WARN_CREATIVE = "Carica la creatività in Ads Manager";
const WARN_IG = "L'identità Instagram va completata in Ads Manager.";

export const LABEL_CTA_EXPORT_META = "Esporta per Meta Ads";

export const COPY_STATO_EXPORT: Record<MetaExportReadiness, string> = {
  READY: "Bozza pronta da esportare",
  READY_WITH_MISSING_META_DETAILS:
    "Bozza esportabile · completa alcuni dettagli in Meta",
  NOT_EXPORTABLE: "Completa i dati prima di esportare",
};

export const COPY_SPIEGAZIONE_EXPORT =
  "Affianco prepara una bozza strutturata da completare in Ads Manager.";

export const COPY_PROMESSA_EXPORT =
  "Affianco prepara struttura, copy, budget e impostazioni base. Ads Manager resta il punto di pubblicazione.";

export const NOTE_PUBBLICO_EXPORT =
  "Le impostazioni avanzate del pubblico vanno verificate in Ads Manager.";

export const NOTE_CREATIVE_FILENAME =
  "Carica la creatività in Ads Manager";

const VOCI_UI: Record<string, string> = {
  [BLOCK_COPY]: "Inserisci almeno un testo annuncio",
  [BLOCK_BUDGET]: "Indica un budget giornaliero maggiore di zero",
  [BLOCK_URL]: "Indica un URL di destinazione valido",
  [BLOCK_FORM]: "Lead Form da collegare",
  [BLOCK_WA]: "Indica un numero WhatsApp utilizzabile",
  [BLOCK_RADIUS]: "Indica un raggio di targeting",
  [WARN_PAGE]: "Pagina Facebook da completare in Ads Manager",
  [WARN_PIXEL]: "Verifica pixel/dataset in Ads Manager.",
  [WARN_AUDIENCE]: "Seleziona l'audience di retargeting in Ads Manager.",
  [WARN_CREATIVE]: NOTE_CREATIVE_FILENAME,
  [WARN_IG]: "Identità Instagram da completare in Ads Manager",
};

export type VocePreExport = {
  tone: "blocker" | "warning" | "info";
  text: string;
};

const MAX_VOCI_PRE_EXPORT = 4;

/** Profili locali: il CSV scrive città + raggio. ECOMMERCE è nazionale. */
function profiloRichiedeRaggio(profile: MetaExportProfile): boolean {
  return profile !== "ECOMMERCE";
}

export function raggioExportKm(
  raw: number | null | undefined,
): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

const PLACEHOLDER_HOSTS = new Set(["google.com", "www.google.com"]);

export function profiloExportMeta(
  objective: CampagnaObjective | undefined,
  bookingChannel: BookingChannel | undefined,
  destinationUrl: string | undefined,
): MetaExportProfile {
  if (objective === "ECOMMERCE") return "ECOMMERCE";
  if (objective === "IN_STORE") return "INSTORE";
  if (objective === "RETARGETING") return "RETARGETING";
  if (objective === "AWARENESS") {
    return (destinationUrl ?? "").trim() ? "AWARENESS_LINK" : "AWARENESS_REACH";
  }
  if (objective === "BOOKINGS") {
    const ch = bookingChannel ?? "WHATSAPP";
    if (ch === "BOOKING_LINK") return "BOOKINGS_WEBSITE";
    if (ch === "PHONE_CALL") return "BOOKINGS_PHONE";
    if (ch === "INSTAGRAM_DM") return "BOOKINGS_IG_DM";
    if (ch === "LEAD_FORM") return "BOOKINGS_FORM";
    return "BOOKINGS_WHATSAPP";
  }
  return "LEADS_FORM";
}

export function urlDestinazioneExportValido(
  raw: string | null | undefined,
): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (PLACEHOLDER_HOSTS.has(host) && !parsed.pathname.includes("/maps")) {
    return false;
  }
  return host.includes(".");
}

export function numeroWhatsappExportUsabile(
  raw: string | null | undefined,
): boolean {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 8;
}

function haCopyEsportabile(config: ConfigurazioneContatti): boolean {
  return Boolean(
    (config.varianteA ?? "").trim() ||
      (config.varianteB ?? "").trim() ||
      (config.varianteC ?? "").trim(),
  );
}

export function valutaExportMeta(
  input: MetaExportValutaInput,
): MetaExportValidation {
  const objective = input.objective ?? "LEADS";
  const dest = (input.destinationUrl ?? "").trim();
  const profile = profiloExportMeta(objective, input.bookingChannel, dest);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!haCopyEsportabile(input.config)) {
    blockers.push(BLOCK_COPY);
  }
  const budget = input.config.budgetGiornaliero;
  if (budget == null || !Number.isFinite(budget) || budget <= 0) {
    blockers.push(BLOCK_BUDGET);
  }

  const pageOk = Boolean((input.pageId ?? "").trim());
  const formOk = Boolean((input.formId ?? "").trim());
  const urlOk = urlDestinazioneExportValido(dest);

  const needsUrl =
    profile === "BOOKINGS_WEBSITE" ||
    profile === "ECOMMERCE" ||
    profile === "INSTORE" ||
    profile === "RETARGETING" ||
    profile === "AWARENESS_LINK";
  if (needsUrl && !urlOk) {
    blockers.push(BLOCK_URL);
  }

  const needsForm = META_EXPORT_PAGE_FORM[profile].form === "required";
  if (needsForm && !formOk) {
    blockers.push(BLOCK_FORM);
  }

  if (profile === "BOOKINGS_WHATSAPP") {
    if (!numeroWhatsappExportUsabile(input.whatsappNumber)) {
      blockers.push(BLOCK_WA);
    }
  }

  if (
    profiloRichiedeRaggio(profile) &&
    raggioExportKm(input.config.raggioKm) == null
  ) {
    blockers.push(BLOCK_RADIUS);
  }

  const pageRule = META_EXPORT_PAGE_FORM[profile].page;
  if (pageRule === "required" && !pageOk) {
    blockers.push(WARN_PAGE);
  } else if (pageRule === "missing-meta-detail" && !pageOk) {
    warnings.push(WARN_PAGE);
  }
  if (profile === "ECOMMERCE") {
    warnings.push(WARN_PIXEL);
  }
  if (profile === "RETARGETING") {
    warnings.push(WARN_AUDIENCE);
  }
  if (profile === "BOOKINGS_IG_DM") {
    warnings.push(WARN_IG);
  }
  if (!(input.creativitaMeta?.length ?? 0)) {
    warnings.push(WARN_CREATIVE);
  }

  let status: MetaExportReadiness;
  if (blockers.length > 0) {
    status = "NOT_EXPORTABLE";
  } else if (warnings.length > 0) {
    status = "READY_WITH_MISSING_META_DETAILS";
  } else {
    status = "READY";
  }

  return { status, blockers, warnings, profile };
}

export function testoStatoExport(status: MetaExportReadiness): string {
  return COPY_STATO_EXPORT[status];
}

export function ctaExportAbilitata(status: MetaExportReadiness): boolean {
  return status !== "NOT_EXPORTABLE";
}

export function vociPreExport(
  validation: MetaExportValidation,
  extra?: { haNomeFileCreativita?: boolean; destinationUrl?: string },
): VocePreExport[] {
  const voci: VocePreExport[] = [];
  const visto = new Set<string>();

  function push(tone: VocePreExport["tone"], raw: string) {
    const text = VOCI_UI[raw] ?? raw;
    if (visto.has(text)) return;
    visto.add(text);
    voci.push({ tone, text });
  }

  for (const b of validation.blockers) push("blocker", b);
  for (const w of validation.warnings) push("warning", w);

  if (
    extra?.haNomeFileCreativita &&
    !visto.has(NOTE_CREATIVE_FILENAME)
  ) {
    voci.push({ tone: "info", text: NOTE_CREATIVE_FILENAME });
    visto.add(NOTE_CREATIVE_FILENAME);
  }

  if (
    validation.profile === "AWARENESS_LINK" &&
    urlDestinazioneExportValido(extra?.destinationUrl)
  ) {
    const url = (extra?.destinationUrl ?? "").trim();
    if (url && !visto.has(url)) {
      voci.push({ tone: "info", text: `Destinazione: ${url}` });
    }
  }

  return voci.slice(0, MAX_VOCI_PRE_EXPORT);
}
