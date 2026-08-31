import { supabase } from "@/lib/supabase";
import {
  logCampagnaApprovata,
  logCampagnaCreata,
} from "@/lib/campaign-logs";
import type {
  BookingChannel,
  BookingConfirmationPolicy,
  Campagna,
  CampagnaObjective,
  EcommerceShippingMarket,
  Giudizio,
  TargetAgeBand,
  TargetType,
} from "@/types/campagne";
import {
  normalizzaObjective,
  normalizzaShippingMarket,
  normalizzaTargetAgeBand,
  normalizzaTargetType,
} from "@/types/campagne";
import {
  fondiCampagnaConAssetLocali,
  salvaAssetCampagnaLocale,
  type CampagnaAssets,
} from "@/data/campagne-assets-store";
import type { CreativitaMeta, CreativitaAsset } from "@/lib/creativita";
import {
  normalizzaApprovalToken,
  urlApprovazioneDaToken,
} from "@/lib/approval-token";
import {
  caricaCreativitaSuStorage,
  eliminaCreativitaDaStorage,
  metaDaCreativitaJson,
  pathsCreativitaRimossi,
} from "@/lib/creativita-storage";
import {
  normalizzaConversionRateSource,
  type ConversionRateSource,
} from "@/lib/conversion-rate";

export { urlApprovazioneDaToken } from "@/lib/approval-token";

export type ClientRow = {
  id: string;
  created_at: string;
  name: string;
  elevator_pitch: string | null;
  average_ticket_value: number | null;
  closing_rate: number | null;
  website?: string | null;
  user_id?: string | null;
};

/** Sessione Auth obbligatoria per write/list app (P3 ownership). */
async function requireAuthUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const uid = data.user?.id;
  if (!uid) {
    throw new Error("Devi accedere per salvare o leggere le campagne.");
  }
  return uid;
}

type ClientJoin = Pick<
  ClientRow,
  | "id"
  | "name"
  | "elevator_pitch"
  | "average_ticket_value"
  | "closing_rate"
  | "website"
>;

export type CampaignRow = {
  id: string;
  created_at: string;
  client_id: string | null;
  name: string;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  max_sustainable_cpa: number | null;
  variante_a?: string | null;
  variante_b?: string | null;
  variante_c?: string | null;
  page_id?: string | null;
  form_id?: string | null;
  settore?: string | null;
  citta?: string | null;
  raggio_km?: number | null;
  eta_min?: number | null;
  eta_max?: number | null;
  titolo_annuncio?: string | null;
  target_margin?: number | null;
  booking_service_value?: number | null;
  show_up_rate?: number | null;
  booking_channel?: string | null;
  booking_confirmation_policy?: string | null;
  average_order_value?: number | null;
  product_margin?: number | null;
  average_receipt?: number | null;
  store_margin?: number | null;
  recovery_value?: number | null;
  recovery_margin?: number | null;
  recovery_discount?: number | null;
  launch_budget?: number | null;
  awareness_radius_km?: number | null;
  estimated_cpm?: number | null;
  approved_at?: string | null;
  revision_notes?: string | null;
  approval_token?: string | null;
  front_end_offer?: string | null;
  target_type?: string | null;
  target_age?: string | null;
  shipping_market?: string | null;
  hero_product?: string | null;
  creativita?: unknown;
  conversion_rate_source?: string | null;
  clients?: ClientJoin | ClientJoin[] | null;
};

export type DatiSalvataggioCampagna = {
  nomeCliente: string;
  elevatorPitch?: string;
  website?: string;
  nomeCampagna: string;
  dailyBudget: number;
  maxSustainableCpa?: number;
  averageTicketValue?: number;
  closingRate?: number;
  /** LEADS | BOOKINGS | ECOMMERCE | IN_STORE | RETARGETING | AWARENESS */
  objective?: CampagnaObjective;
  bookingServiceValue?: number;
  showUpRate?: number;
  bookingChannel?: BookingChannel;
  bookingConfirmationPolicy?: BookingConfirmationPolicy;
  averageOrderValue?: number;
  productMargin?: number;
  averageReceipt?: number;
  storeMargin?: number;
  recoveryValue?: number;
  recoveryMargin?: number;
  recoveryDiscount?: number;
  launchBudget?: number;
  awarenessRadiusKm?: number;
  estimatedCpm?: number;
  varianteA?: string;
  varianteB?: string;
  varianteC?: string;
  pageId?: string;
  formId?: string;
  settore?: string;
  citta?: string;
  raggioKm?: number;
  etaMin?: number;
  etaMax?: number;
  titoloAnnuncio?: string;
  targetMargin?: number;
  frontEndOffer?: string;
  targetType?: TargetType;
  targetAge?: TargetAgeBand;
  shippingMarket?: EcommerceShippingMarket;
  heroProduct?: string;
  /** Metadata creatività (fino a 3) per export Meta A/B visivo. */
  creativitaMeta?: CreativitaMeta[];
  /** LEADS: provenienza tasso di conversione (REAL | ESTIMATED | UNKNOWN). */
  conversionRateSource?: ConversionRateSource;
  /** Asset locali (blob) da caricare su Storage al salvataggio. */
  creativitaAssets?: CreativitaAsset[];
  /**
   * Se presente: UPDATE della stessa campagna (o INSERT idempotente con questo id).
   * Se assente in create: viene generato un UUID client-side.
   */
  campaignId?: string;
  /** Su update: riusa questo client senza trovaOCrea per nome. */
  clientId?: string;
};

function normalizzaBookingChannel(
  raw: string | null | undefined,
): BookingChannel | undefined {
  const s = (raw ?? "").toUpperCase();
  if (s === "WHATSAPP") return "WHATSAPP";
  if (s === "LEAD_FORM") return "LEAD_FORM";
  if (s === "BOOKING_LINK") return "BOOKING_LINK";
  if (s === "PHONE_CALL") return "PHONE_CALL";
  if (s === "INSTAGRAM_DM") return "INSTAGRAM_DM";
  return undefined;
}

function normalizzaBookingConfirmationPolicy(
  raw: string | null | undefined,
): BookingConfirmationPolicy | undefined {
  const s = (raw ?? "").toUpperCase();
  if (s === "FREE_SMS_WHATSAPP") return "FREE_SMS_WHATSAPP";
  if (s === "DEPOSIT_ONLINE") return "DEPOSIT_ONLINE";
  if (s === "PAY_ON_SITE") return "PAY_ON_SITE";
  return undefined;
}

function inizialiDaNome(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "??";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return `${parti[0][0]}${parti[parti.length - 1][0]}`.toUpperCase();
}

function clienteDaJoin(clients: CampaignRow["clients"]): ClientJoin | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0] ?? null;
  return clients;
}

function statoDaCampagna(row: CampaignRow): string {
  const status = (row.status ?? "").toUpperCase();
  if (status === "APPROVED") return "Approvata dal cliente · pronta al lancio";
  if (status === "REVISION_REQUESTED") {
    return "Il cliente ha richiesto modifiche";
  }
  if (status === "DRAFT") return "In attesa di approvazione cliente";
  if (status === "ACTIVE" || status === "RUNNING") {
    return "Attiva · in attesa di review o già live";
  }
  return status ? `Stato: ${status}` : "In attesa di approvazione cliente";
}

function giudizioDaStato(_row: CampaignRow): Giudizio {
  return "Ancora presto";
}

function colonnaMancante(message: string): string | null {
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

/**
 * True SOLO se PostgREST/Postgres segnala colonna user_id assente.
 * NON true per RLS, permission, auth, network.
 */
function isUserIdColumnMissingError(message: string): boolean {
  const m = message.toLowerCase();
  if (
    /permission|denied|policy|row-level|rls|jwt|unauthorized|not authenticated|42501/.test(
      m,
    )
  ) {
    return false;
  }
  // SELECT/filter: "column clients.user_id does not exist" (42703)
  if (/column\s+[\w.]*(user_id)[\w.]*\s+does not exist/i.test(message)) {
    return true;
  }
  // INSERT/UPDATE payload: "Could not find the 'user_id' column ... schema cache" (PGRST204)
  if (/could not find the 'user_id' column/i.test(message)) {
    return true;
  }
  return false;
}

/** Inserisce/aggiorna rimuovendo colonne sconosciute finché PostgREST accetta. */
async function insertConFallbackColonne(
  table: "clients" | "campaigns",
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let corrente = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const { data, error } = await supabase
      .from(table)
      .insert(corrente)
      .select("*")
      .single();

    if (!error) return data as Record<string, unknown>;

    const missing = colonnaMancante(error.message);
    if (missing && missing in corrente) {
      const { [missing]: _removed, ...resto } = corrente;
      corrente = resto;
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error(`Impossibile inserire in ${table}: colonne non compatibili.`);
}

async function updateConFallbackColonne(
  table: "clients" | "campaigns",
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let corrente = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    if (Object.keys(corrente).length === 0) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data as Record<string, unknown>;
    }

    const { data, error } = await supabase
      .from(table)
      .update(corrente)
      .eq("id", id)
      .select("*")
      .single();

    if (!error) return data as Record<string, unknown>;

    const missing = colonnaMancante(error.message);
    if (missing && missing in corrente) {
      const { [missing]: _removed, ...resto } = corrente;
      corrente = resto;
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error(`Impossibile aggiornare ${table}: colonne non compatibili.`);
}

/** Mappa riga Supabase → modello UI `Campagna`. */
export function mappaCampagnaDaRow(row: CampaignRow): Campagna {
  const cliente = clienteDaJoin(row.clients);
  const nomeCliente = cliente?.name?.trim() || "Cliente";
  const base: Campagna = {
    id: row.id ?? "",
    nomeCliente,
    iniziali: inizialiDaNome(nomeCliente),
    stato: statoDaCampagna(row),
    giudizio: giudizioDaStato(row),
    objective: normalizzaObjective(row.objective),
    nomeCampagna: row.name,
    budgetGiornaliero: row.daily_budget ?? undefined,
    dataLancio: row.created_at,
    scontrinoMedio:
      row.recovery_value ??
      row.average_receipt ??
      row.average_order_value ??
      row.booking_service_value ??
      cliente?.average_ticket_value ??
      undefined,
    tassoConversionePercent:
      row.show_up_rate ?? cliente?.closing_rate ?? undefined,
    bookingServiceValue: row.booking_service_value ?? undefined,
    showUpRate: row.show_up_rate ?? undefined,
    bookingChannel: normalizzaBookingChannel(row.booking_channel),
    bookingConfirmationPolicy: normalizzaBookingConfirmationPolicy(
      row.booking_confirmation_policy,
    ),
    averageOrderValue: row.average_order_value ?? undefined,
    productMargin: row.product_margin ?? undefined,
    averageReceipt: row.average_receipt ?? undefined,
    storeMargin: row.store_margin ?? undefined,
    recoveryValue: row.recovery_value ?? undefined,
    recoveryMargin: row.recovery_margin ?? undefined,
    recoveryDiscount: row.recovery_discount ?? undefined,
    launchBudget: row.launch_budget ?? undefined,
    awarenessRadiusKm: row.awareness_radius_km ?? undefined,
    estimatedCpm: row.estimated_cpm ?? undefined,
    elevatorPitch: cliente?.elevator_pitch ?? undefined,
    website: cliente?.website ?? undefined,
    varianteA: row.variante_a ?? undefined,
    varianteB: row.variante_b ?? undefined,
    varianteC: row.variante_c ?? undefined,
    pageId: row.page_id ?? undefined,
    formId: row.form_id ?? undefined,
    settore: row.settore ?? undefined,
    citta: row.citta ?? undefined,
    raggioKm: row.raggio_km ?? row.awareness_radius_km ?? undefined,
    etaMin: row.eta_min ?? undefined,
    etaMax: row.eta_max ?? undefined,
    titoloAnnuncio: row.titolo_annuncio ?? undefined,
    status: row.status ?? undefined,
    targetMargin: row.target_margin ?? undefined,
    frontEndOffer: row.front_end_offer ?? undefined,
    targetType: normalizzaTargetType(row.target_type),
    targetAge: normalizzaTargetAgeBand(row.target_age),
    shippingMarket: normalizzaShippingMarket(row.shipping_market),
    heroProduct: row.hero_product ?? undefined,
    maxSustainableCpa:
      row.max_sustainable_cpa != null &&
      Number.isFinite(row.max_sustainable_cpa) &&
      row.max_sustainable_cpa > 0
        ? row.max_sustainable_cpa
        : undefined,
    conversionRateSource: normalizzaConversionRateSource(
      row.conversion_rate_source,
    ),
    approvedAt: row.approved_at ?? undefined,
    revisionNotes: (() => {
      const n = row.revision_notes?.trim();
      if (!n || n === "Nessuna nota aggiuntiva fornita.") return undefined;
      return n;
    })(),
    approvalToken: normalizzaApprovalToken(row.approval_token),
    creativitaMeta:
      metaDaCreativitaJson(row.creativita) ??
      (undefined as CreativitaMeta[] | undefined),
  };

  return fondiCampagnaConAssetLocali(base);
}

/**
 * Crea o recupera un cliente per nome.
 * POST-P3: scoped a user_id = sessione.
 * PRE-P3: se colonna user_id assente → legacy name-only (solo column-missing).
 * RLS/permission/auth NON attivano il path legacy.
 */
export async function trovaOCreaCliente(input: {
  name: string;
  elevatorPitch?: string;
  website?: string;
  averageTicketValue?: number;
  closingRate?: number;
}): Promise<ClientRow> {
  const userId = await requireAuthUserId();
  const name = input.name.trim() || "Nuovo cliente";
  const website = input.website?.trim() || null;

  let esistente: ClientRow | undefined;
  let ownershipSchemaReady = true;

  const scoped = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", name)
    .limit(1);

  if (scoped.error) {
    if (!isUserIdColumnMissingError(scoped.error.message)) {
      throw new Error(scoped.error.message);
    }
    ownershipSchemaReady = false;
    const legacy = await supabase
      .from("clients")
      .select("*")
      .ilike("name", name)
      .limit(1);
    if (legacy.error) throw new Error(legacy.error.message);
    esistente = legacy.data?.[0] as ClientRow | undefined;
  } else {
    esistente = scoped.data?.[0] as ClientRow | undefined;
  }

  if (esistente) {
    const patch: Record<string, unknown> = {};
    if (input.elevatorPitch?.trim()) {
      patch.elevator_pitch = input.elevatorPitch.trim();
    }
    if (
      input.averageTicketValue != null &&
      Number.isFinite(input.averageTicketValue)
    ) {
      patch.average_ticket_value = input.averageTicketValue;
    }
    if (input.closingRate != null && Number.isFinite(input.closingRate)) {
      patch.closing_rate = input.closingRate;
    }
    if (website) patch.website = website;

    if (Object.keys(patch).length === 0) return esistente;

    const aggiornato = await updateConFallbackColonne(
      "clients",
      esistente.id,
      patch,
    );
    return {
      ...(aggiornato as unknown as ClientRow),
      website: (aggiornato.website as string | null | undefined) ?? website,
    };
  }

  const payload: Record<string, unknown> = {
    name,
    elevator_pitch: input.elevatorPitch?.trim() || null,
    average_ticket_value:
      input.averageTicketValue != null &&
      Number.isFinite(input.averageTicketValue)
        ? input.averageTicketValue
        : null,
    closing_rate:
      input.closingRate != null && Number.isFinite(input.closingRate)
        ? input.closingRate
        : null,
    ...(website ? { website } : {}),
  };
  // POST-P3: include user_id. PRE-P3: insertConFallbackColonne lo strippa (PGRST204).
  if (ownershipSchemaReady) {
    payload.user_id = userId;
  }

  const creato = await insertConFallbackColonne("clients", payload);

  return {
    ...(creato as unknown as ClientRow),
    website: (creato.website as string | null | undefined) ?? website,
  };
}

function isDuplicateKeyError(message: string): boolean {
  return /23505|duplicate key|already exists/i.test(message);
}

function nuovoUuidCampagna(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type CampagnaWriteInput = {
  clientId: string;
  name: string;
  dailyBudget: number;
  maxSustainableCpa?: number;
  status?: string;
  objective?: CampagnaObjective;
  bookingServiceValue?: number;
  showUpRate?: number;
  bookingChannel?: BookingChannel;
  bookingConfirmationPolicy?: BookingConfirmationPolicy;
  averageOrderValue?: number;
  productMargin?: number;
  averageReceipt?: number;
  storeMargin?: number;
  recoveryValue?: number;
  recoveryMargin?: number;
  recoveryDiscount?: number;
  launchBudget?: number;
  awarenessRadiusKm?: number;
  estimatedCpm?: number;
  varianteA?: string;
  varianteB?: string;
  varianteC?: string;
  pageId?: string;
  formId?: string;
  settore?: string;
  citta?: string;
  raggioKm?: number;
  etaMin?: number;
  etaMax?: number;
  titoloAnnuncio?: string;
  targetMargin?: number;
  frontEndOffer?: string;
  targetType?: TargetType;
  targetAge?: TargetAgeBand;
  shippingMarket?: EcommerceShippingMarket;
  heroProduct?: string;
  creativitaMeta?: CreativitaMeta[];
  conversionRateSource?: ConversionRateSource;
};

function nomeCampagnaFallback(objective: CampagnaObjective): string {
  if (objective === "BOOKINGS") return "Prenotazioni";
  if (objective === "ECOMMERCE") return "Vendite Online";
  if (objective === "IN_STORE") return "Traffico Negozio";
  if (objective === "RETARGETING") return "Retargeting / Recupero";
  if (objective === "AWARENESS") return "Apertura / Lancio Locale";
  return "Richieste Contatto";
}

/**
 * Mapper condiviso wizard → colonne DB.
 * `includeStatus: false` su UPDATE wizard (preserva APPROVED / REVISION_REQUESTED).
 */
export function costruisciPayloadCampagna(
  input: CampagnaWriteInput,
  opts?: { includeStatus?: boolean; id?: string },
): Record<string, unknown> {
  const objective = input.objective ?? "LEADS";
  const includeStatus = opts?.includeStatus !== false;
  const payload: Record<string, unknown> = {
    client_id: input.clientId,
    name: input.name.trim() || nomeCampagnaFallback(objective),
    objective,
    daily_budget: input.dailyBudget,
  };
  if (input.maxSustainableCpa != null && input.maxSustainableCpa > 0) {
    payload.max_sustainable_cpa = input.maxSustainableCpa;
  }

  if (opts?.id) payload.id = opts.id;
  if (includeStatus) {
    payload.status = input.status ?? "DRAFT";
  }

  if (input.varianteA?.trim()) payload.variante_a = input.varianteA.trim();
  if (input.varianteB?.trim()) payload.variante_b = input.varianteB.trim();
  if (input.varianteC?.trim()) payload.variante_c = input.varianteC.trim();
  if (input.pageId?.trim()) payload.page_id = input.pageId.trim();
  if (input.formId?.trim()) payload.form_id = input.formId.trim();
  if (input.settore?.trim()) payload.settore = input.settore.trim();
  if (input.citta?.trim()) payload.citta = input.citta.trim();
  if (input.raggioKm != null) payload.raggio_km = input.raggioKm;
  if (input.etaMin != null) payload.eta_min = input.etaMin;
  if (input.etaMax != null) payload.eta_max = input.etaMax;
  if (input.titoloAnnuncio?.trim()) {
    payload.titolo_annuncio = input.titoloAnnuncio.trim();
  }
  if (input.targetMargin != null) payload.target_margin = input.targetMargin;
  if (input.bookingServiceValue != null) {
    payload.booking_service_value = input.bookingServiceValue;
  }
  if (input.showUpRate != null) payload.show_up_rate = input.showUpRate;
  if (input.bookingChannel) payload.booking_channel = input.bookingChannel;
  if (input.bookingConfirmationPolicy) {
    payload.booking_confirmation_policy = input.bookingConfirmationPolicy;
  }
  if (input.averageOrderValue != null) {
    payload.average_order_value = input.averageOrderValue;
  }
  if (input.productMargin != null) payload.product_margin = input.productMargin;
  if (input.averageReceipt != null) {
    payload.average_receipt = input.averageReceipt;
  }
  if (input.storeMargin != null) payload.store_margin = input.storeMargin;
  if (input.recoveryValue != null) payload.recovery_value = input.recoveryValue;
  if (input.recoveryMargin != null) {
    payload.recovery_margin = input.recoveryMargin;
  }
  if (input.recoveryDiscount != null) {
    payload.recovery_discount = input.recoveryDiscount;
  }
  if (input.launchBudget != null) payload.launch_budget = input.launchBudget;
  if (input.awarenessRadiusKm != null) {
    payload.awareness_radius_km = input.awarenessRadiusKm;
  }
  if (input.estimatedCpm != null) payload.estimated_cpm = input.estimatedCpm;
  if (input.frontEndOffer?.trim()) {
    payload.front_end_offer = input.frontEndOffer.trim();
  }
  if (input.targetType) payload.target_type = input.targetType;
  if (input.targetAge) payload.target_age = input.targetAge;
  if (input.shippingMarket) payload.shipping_market = input.shippingMarket;
  if (input.heroProduct?.trim()) {
    payload.hero_product = input.heroProduct.trim();
  }
  if (input.creativitaMeta !== undefined) {
    payload.creativita = input.creativitaMeta;
  }
  if (input.conversionRateSource) {
    payload.conversion_rate_source = input.conversionRateSource;
  }

  return payload;
}

function writeInputDaDati(
  dati: DatiSalvataggioCampagna,
  clientId: string,
): CampagnaWriteInput {
  return {
    clientId,
    name: dati.nomeCampagna,
    dailyBudget: dati.dailyBudget,
    maxSustainableCpa: dati.maxSustainableCpa,
    objective: dati.objective ?? "LEADS",
    bookingServiceValue: dati.bookingServiceValue,
    showUpRate: dati.showUpRate,
    bookingChannel: dati.bookingChannel,
    bookingConfirmationPolicy: dati.bookingConfirmationPolicy,
    averageOrderValue: dati.averageOrderValue,
    productMargin: dati.productMargin,
    averageReceipt: dati.averageReceipt,
    storeMargin: dati.storeMargin,
    recoveryValue: dati.recoveryValue,
    recoveryMargin: dati.recoveryMargin,
    recoveryDiscount: dati.recoveryDiscount,
    launchBudget: dati.launchBudget,
    awarenessRadiusKm: dati.awarenessRadiusKm,
    estimatedCpm: dati.estimatedCpm,
    varianteA: dati.varianteA,
    varianteB: dati.varianteB,
    varianteC: dati.varianteC,
    pageId: dati.pageId,
    formId: dati.formId,
    settore: dati.settore,
    citta: dati.citta,
    raggioKm: dati.raggioKm,
    etaMin: dati.etaMin,
    etaMax: dati.etaMax,
    titoloAnnuncio: dati.titoloAnnuncio,
    targetMargin: dati.targetMargin,
    frontEndOffer: dati.frontEndOffer,
    targetType: dati.targetType,
    targetAge: dati.targetAge,
    shippingMarket: dati.shippingMarket,
    heroProduct: dati.heroProduct,
    creativitaMeta: dati.creativitaMeta,
    conversionRateSource: dati.conversionRateSource,
  };
}

async function leggiMetaCampagna(
  id: string,
): Promise<{ client_id: string | null; status: string | null } | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("client_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as { client_id: string | null; status: string | null };
}

async function aggiornaClienteConosciuto(
  clientId: string,
  dati: DatiSalvataggioCampagna,
): Promise<ClientRow> {
  const patch: Record<string, unknown> = {};
  if (dati.nomeCliente.trim()) patch.name = dati.nomeCliente.trim();
  if (dati.elevatorPitch?.trim()) {
    patch.elevator_pitch = dati.elevatorPitch.trim();
  }
  const ticket =
    dati.recoveryValue ??
    dati.averageReceipt ??
    dati.averageOrderValue ??
    dati.bookingServiceValue ??
    dati.averageTicketValue;
  if (ticket != null && Number.isFinite(ticket)) {
    patch.average_ticket_value = ticket;
  }
  const closing = dati.showUpRate ?? dati.closingRate;
  if (closing != null && Number.isFinite(closing)) {
    patch.closing_rate = closing;
  }
  if (dati.website?.trim()) patch.website = dati.website.trim();

  if (Object.keys(patch).length === 0) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    if (error) throw new Error(error.message);
    return data as ClientRow;
  }

  const aggiornato = await updateConFallbackColonne("clients", clientId, patch);
  return aggiornato as unknown as ClientRow;
}

/** Inserisce una campagna (tutti gli obiettivi) collegata al cliente. */
export async function creaCampagnaLeadGen(
  input: CampagnaWriteInput & { id?: string },
): Promise<CampaignRow> {
  const userId = await requireAuthUserId();
  // POST-P3: user_id obbligatorio (RLS + trigger).
  // PRE-P3: insertConFallbackColonne rimuove user_id se colonna assente (PGRST204).
  // Non fare fallback su errori RLS/permission.
  const payload = {
    ...costruisciPayloadCampagna(input, {
      includeStatus: true,
      id: input.id,
    }),
    user_id: userId,
  };
  const data = await insertConFallbackColonne("campaigns", payload);
  return data as unknown as CampaignRow;
}

/** Aggiorna campagna esistente senza toccare status / approved_at / revision_notes. */
export async function aggiornaCampagnaLeadGen(
  id: string,
  input: CampagnaWriteInput,
): Promise<CampaignRow> {
  const payload = costruisciPayloadCampagna(input, { includeStatus: false });
  const data = await updateConFallbackColonne("campaigns", id, payload);
  return data as unknown as CampaignRow;
}

function assetsDaDati(dati: DatiSalvataggioCampagna): CampagnaAssets {
  return {
    elevatorPitch: dati.elevatorPitch?.trim() || undefined,
    website: dati.website?.trim() || undefined,
    varianteA: dati.varianteA?.trim() || undefined,
    varianteB: dati.varianteB?.trim() || undefined,
    varianteC: dati.varianteC?.trim() || undefined,
    pageId: dati.pageId?.trim() || undefined,
    formId: dati.formId?.trim() || undefined,
    settore: dati.settore?.trim() || undefined,
    citta: dati.citta?.trim() || undefined,
    raggioKm: dati.raggioKm,
    etaMin: dati.etaMin,
    etaMax: dati.etaMax,
    titoloAnnuncio: dati.titoloAnnuncio?.trim() || undefined,
    targetMargin: dati.targetMargin,
    objective: dati.objective,
    bookingServiceValue: dati.bookingServiceValue,
    showUpRate: dati.showUpRate,
    bookingChannel: dati.bookingChannel,
    bookingConfirmationPolicy: dati.bookingConfirmationPolicy,
    averageOrderValue: dati.averageOrderValue,
    productMargin: dati.productMargin,
    maxSustainableCpa:
      dati.maxSustainableCpa != null && dati.maxSustainableCpa > 0
        ? dati.maxSustainableCpa
        : undefined,
    averageReceipt: dati.averageReceipt,
    storeMargin: dati.storeMargin,
    recoveryValue: dati.recoveryValue,
    recoveryMargin: dati.recoveryMargin,
    recoveryDiscount: dati.recoveryDiscount,
    launchBudget: dati.launchBudget,
    awarenessRadiusKm: dati.awarenessRadiusKm,
    estimatedCpm: dati.estimatedCpm,
    shippingMarket: dati.shippingMarket,
    heroProduct: dati.heroProduct?.trim() || undefined,
    creativitaMeta:
      dati.creativitaMeta && dati.creativitaMeta.length > 0
        ? dati.creativitaMeta
        : undefined,
    conversionRateSource: dati.conversionRateSource,
  };
}

/** Cliente + campagna: CREATE (UUID client) o UPDATE idempotente sulla stessa riga. */
export async function salvaCampagnaCompleta(
  dati: DatiSalvataggioCampagna,
): Promise<Campagna> {
  const campaignId = (dati.campaignId ?? "").trim() || nuovoUuidCampagna();
  const metaEsistente = await leggiMetaCampagna(campaignId);
  const isUpdate = metaEsistente != null;

  let creativitaMeta = dati.creativitaMeta;
  if (dati.creativitaAssets !== undefined) {
    let metaPrecedente = creativitaMeta;
    if (isUpdate) {
      try {
        const campagnaEsistente = await leggiCampagnaDaSupabase(campaignId);
        if (campagnaEsistente?.creativitaMeta?.length) {
          metaPrecedente = campagnaEsistente.creativitaMeta;
        }
      } catch {
        // Non bloccante.
      }
    }

    if (dati.creativitaAssets.length === 0) {
      const daEliminare = pathsCreativitaRimossi(metaPrecedente ?? [], []);
      if (daEliminare.length > 0) {
        try {
          await eliminaCreativitaDaStorage(daEliminare);
        } catch {
          // Cleanup best-effort.
        }
      }
      creativitaMeta = [];
    } else {
      creativitaMeta = await caricaCreativitaSuStorage(
        dati.creativitaAssets,
        metaPrecedente ?? [],
      );
      const daEliminare = pathsCreativitaRimossi(
        metaPrecedente ?? [],
        creativitaMeta,
      );
      if (daEliminare.length > 0) {
        try {
          await eliminaCreativitaDaStorage(daEliminare);
        } catch {
          // Cleanup best-effort.
        }
      }
    }
  }
  const datiSalvataggio: DatiSalvataggioCampagna = {
    ...dati,
    campaignId,
    creativitaMeta,
  };

  let cliente: ClientRow;
  if (metaEsistente?.client_id) {
    cliente = await aggiornaClienteConosciuto(metaEsistente.client_id, datiSalvataggio);
  } else if (datiSalvataggio.clientId?.trim()) {
    cliente = await aggiornaClienteConosciuto(datiSalvataggio.clientId.trim(), datiSalvataggio);
  } else {
    cliente = await trovaOCreaCliente({
      name: datiSalvataggio.nomeCliente,
      elevatorPitch: datiSalvataggio.elevatorPitch,
      website: datiSalvataggio.website,
      averageTicketValue:
        datiSalvataggio.recoveryValue ??
        datiSalvataggio.averageReceipt ??
        datiSalvataggio.averageOrderValue ??
        datiSalvataggio.bookingServiceValue ??
        datiSalvataggio.averageTicketValue,
      closingRate: datiSalvataggio.showUpRate ?? datiSalvataggio.closingRate,
    });
  }

  const writeInput = writeInputDaDati(datiSalvataggio, cliente.id);
  let campagna: CampaignRow;
  let appenaCreata = false;

  if (isUpdate) {
    campagna = await aggiornaCampagnaLeadGen(campaignId, writeInput);
  } else {
    try {
      campagna = await creaCampagnaLeadGen({
        ...writeInput,
        id: campaignId,
        status: "DRAFT",
      });
      appenaCreata = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // INSERT riuscito ma risposta persa / race: stesso UUID → UPDATE.
      if (isDuplicateKeyError(message)) {
        campagna = await aggiornaCampagnaLeadGen(campaignId, writeInput);
      } else {
        throw e;
      }
    }
  }

  const assets = assetsDaDati(datiSalvataggio);
  salvaAssetCampagnaLocale(campagna.id, assets);

  if (appenaCreata) {
    try {
      await logCampagnaCreata(campagna.id);
    } catch {
      // Diario non bloccante.
    }
  }

  return mappaCampagnaDaRow({
    ...campagna,
    variante_a: campagna.variante_a ?? datiSalvataggio.varianteA,
    variante_b: campagna.variante_b ?? datiSalvataggio.varianteB,
    variante_c: campagna.variante_c ?? datiSalvataggio.varianteC,
    page_id: campagna.page_id ?? datiSalvataggio.pageId,
    form_id: campagna.form_id ?? datiSalvataggio.formId,
    settore: campagna.settore ?? datiSalvataggio.settore,
    citta: campagna.citta ?? datiSalvataggio.citta,
    raggio_km: campagna.raggio_km ?? datiSalvataggio.raggioKm,
    eta_min: campagna.eta_min ?? datiSalvataggio.etaMin,
    eta_max: campagna.eta_max ?? datiSalvataggio.etaMax,
    titolo_annuncio: campagna.titolo_annuncio ?? datiSalvataggio.titoloAnnuncio,
    target_margin: campagna.target_margin ?? datiSalvataggio.targetMargin,
    booking_service_value:
      campagna.booking_service_value ?? datiSalvataggio.bookingServiceValue,
    show_up_rate: campagna.show_up_rate ?? datiSalvataggio.showUpRate,
    booking_channel: campagna.booking_channel ?? datiSalvataggio.bookingChannel,
    booking_confirmation_policy:
      campagna.booking_confirmation_policy ??
      datiSalvataggio.bookingConfirmationPolicy,
    average_order_value:
      campagna.average_order_value ?? datiSalvataggio.averageOrderValue,
    product_margin: campagna.product_margin ?? datiSalvataggio.productMargin,
    average_receipt: campagna.average_receipt ?? datiSalvataggio.averageReceipt,
    store_margin: campagna.store_margin ?? datiSalvataggio.storeMargin,
    recovery_value: campagna.recovery_value ?? datiSalvataggio.recoveryValue,
    recovery_margin: campagna.recovery_margin ?? datiSalvataggio.recoveryMargin,
    recovery_discount:
      campagna.recovery_discount ?? datiSalvataggio.recoveryDiscount,
    launch_budget: campagna.launch_budget ?? datiSalvataggio.launchBudget,
    awareness_radius_km:
      campagna.awareness_radius_km ?? datiSalvataggio.awarenessRadiusKm,
    estimated_cpm: campagna.estimated_cpm ?? datiSalvataggio.estimatedCpm,
    front_end_offer: campagna.front_end_offer ?? datiSalvataggio.frontEndOffer,
    target_type: campagna.target_type ?? datiSalvataggio.targetType,
    target_age: campagna.target_age ?? datiSalvataggio.targetAge,
    shipping_market: campagna.shipping_market ?? datiSalvataggio.shippingMarket,
    hero_product: campagna.hero_product ?? datiSalvataggio.heroProduct,
    creativita: creativitaMeta ?? campagna.creativita,
    clients: {
      id: cliente.id,
      name: cliente.name,
      elevator_pitch:
        cliente.elevator_pitch ?? datiSalvataggio.elevatorPitch ?? null,
      average_ticket_value: cliente.average_ticket_value,
      closing_rate: cliente.closing_rate,
      website: cliente.website ?? datiSalvataggio.website ?? null,
    },
  });
}

const SELECT_LISTA =
  "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, booking_service_value, show_up_rate, booking_channel, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin, recovery_discount, launch_budget, awareness_radius_km, estimated_cpm, approved_at, revision_notes, approval_token, clients(id, name, elevator_pitch, average_ticket_value, closing_rate)";

const SELECT_DETTAGLIO_SENZA_CRS =
  "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, variante_a, variante_b, variante_c, page_id, form_id, settore, citta, raggio_km, eta_min, eta_max, titolo_annuncio, target_margin, booking_service_value, show_up_rate, booking_channel, booking_confirmation_policy, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin, recovery_discount, launch_budget, awareness_radius_km, estimated_cpm, front_end_offer, target_type, target_age, shipping_market, hero_product, creativita, approved_at, revision_notes, approval_token, clients(id, name, elevator_pitch, average_ticket_value, closing_rate, website)";

const SELECT_DETTAGLIO =
  "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, variante_a, variante_b, variante_c, page_id, form_id, settore, citta, raggio_km, eta_min, eta_max, titolo_annuncio, target_margin, booking_service_value, show_up_rate, booking_channel, booking_confirmation_policy, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin, recovery_discount, launch_budget, awareness_radius_km, estimated_cpm, front_end_offer, target_type, target_age, shipping_market, hero_product, creativita, conversion_rate_source, approved_at, revision_notes, approval_token, clients(id, name, elevator_pitch, average_ticket_value, closing_rate, website)";

/** Elenco campagne con join sul cliente, dalla più recente. */
export async function leggiCampagneDaSupabase(): Promise<Campagna[]> {
  const tentativo = await supabase
    .from("campaigns")
    .select(SELECT_LISTA)
    .order("created_at", { ascending: false });

  if (!tentativo.error && tentativo.data) {
    return (tentativo.data as CampaignRow[]).map(mappaCampagnaDaRow);
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, clients(id, name, elevator_pitch, average_ticket_value, closing_rate)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as CampaignRow[]).map(mappaCampagnaDaRow);
}

export async function leggiCampagnaDaSupabase(
  id: string,
): Promise<Campagna | null> {
  const tentativoDettaglio = await supabase
    .from("campaigns")
    .select(SELECT_DETTAGLIO)
    .eq("id", id)
    .maybeSingle();

  if (!tentativoDettaglio.error && tentativoDettaglio.data) {
    return mappaCampagnaDaRow(tentativoDettaglio.data as CampaignRow);
  }

  const erroreDettaglio = tentativoDettaglio.error;
  const colonnaCrsMancante =
    Boolean(erroreDettaglio) &&
    /conversion_rate_source/i.test(erroreDettaglio?.message ?? "");
  if (colonnaCrsMancante) {
    const senzaCrs = await supabase
      .from("campaigns")
      .select(SELECT_DETTAGLIO_SENZA_CRS)
      .eq("id", id)
      .maybeSingle();
    if (!senzaCrs.error && senzaCrs.data) {
      return mappaCampagnaDaRow(senzaCrs.data as CampaignRow);
    }
  }

  // Schema senza colonne asset / website: fallback select base.
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, clients(id, name, elevator_pitch, average_ticket_value, closing_rate)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mappaCampagnaDaRow(data as CampaignRow);
}

/** Imposta status = APPROVED + approved_at. */
export async function approvaCampagnaSuSupabase(id: string): Promise<string> {
  const approvedAt = new Date().toISOString();
  const payload = {
    status: "APPROVED",
    approved_at: approvedAt,
  };

  const { error } = await supabase
    .from("campaigns")
    .update(payload)
    .eq("id", id);

  if (error) {
    // Fallback se approved_at non esiste ancora nello schema.
    if (/approved_at/i.test(error.message)) {
      const { error: errStatus } = await supabase
        .from("campaigns")
        .update({ status: "APPROVED" })
        .eq("id", id);
      if (errStatus) throw new Error(errStatus.message);
      try {
        await logCampagnaApprovata(id);
      } catch {
        // Diario non bloccante.
      }
      return approvedAt;
    }
    throw new Error(error.message);
  }

  try {
    await logCampagnaApprovata(id);
  } catch {
    // Diario non bloccante.
  }

  return approvedAt;
}

/** Imposta status = REVISION_REQUESTED + note cliente. */
export async function richiediRevisioneCampagnaSuSupabase(
  id: string,
  note: string,
): Promise<string> {
  const revisionNotes = note.trim();
  if (!revisionNotes) {
    throw new Error("La nota di modifica è obbligatoria.");
  }

  // Backup locale: garantisce la lettura anche se la colonna DB manca ancora.
  salvaAssetCampagnaLocale(id, {
    revisionNotes,
    reviewStatus: "REVISION_REQUESTED",
  });

  try {
    await updateConFallbackColonne("campaigns", id, {
      status: "REVISION_REQUESTED",
      revision_notes: revisionNotes,
    });
  } catch (e) {
    // Se fallisce solo per schema, lo status potrebbe comunque essere aggiornato.
    const message = e instanceof Error ? e.message : String(e);
    const { error: errStatus } = await supabase
      .from("campaigns")
      .update({ status: "REVISION_REQUESTED" })
      .eq("id", id);
    if (errStatus && !/revision_notes/i.test(message)) {
      throw new Error(errStatus.message || message);
    }
  }

  return revisionNotes;
}

/** Chiude la revisione: status DRAFT e pulisce le note. */
export async function completaRevisioneCampagnaSuSupabase(
  id: string,
): Promise<void> {
  salvaAssetCampagnaLocale(id, {
    revisionNotes: "",
    reviewStatus: "DRAFT",
  });

  try {
    await updateConFallbackColonne("campaigns", id, {
      status: "DRAFT",
      revision_notes: null,
    });
  } catch {
    const { error: errStatus } = await supabase
      .from("campaigns")
      .update({ status: "DRAFT" })
      .eq("id", id);
    if (errStatus) throw new Error(errStatus.message);
  }
}

function isApprovalTokenColumnMissingError(message: string): boolean {
  const m = message.toLowerCase();
  if (
    /permission|denied|policy|row-level|rls|jwt|unauthorized|not authenticated|42501/.test(
      m,
    )
  ) {
    return false;
  }
  if (/column\s+[\w.]*(approval_token)[\w.]*\s+does not exist/i.test(message)) {
    return true;
  }
  if (/could not find the 'approval_token' column/i.test(message)) {
    return true;
  }
  return false;
}

function approvedAtDaRpc(data: unknown): string {
  if (
    data &&
    typeof data === "object" &&
    "approved_at" in data &&
    typeof (data as { approved_at?: unknown }).approved_at === "string"
  ) {
    return (data as { approved_at: string }).approved_at;
  }
  return new Date().toISOString();
}

function campaignIdDaRpc(data: unknown): string | undefined {
  if (
    data &&
    typeof data === "object" &&
    "id" in data &&
    typeof (data as { id?: unknown }).id === "string"
  ) {
    return (data as { id: string }).id;
  }
  return undefined;
}

/**
 * Assicura un approval_token per link pubblico (owner).
 * Source of truth: colonna DB `campaigns.approval_token` (mai state/localStorage).
 * Se assente → RPC regenerate (crea).
 */
export async function assicuratiTokenApprovazione(
  campaignId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("approval_token")
    .eq("id", campaignId)
    .maybeSingle();

  if (!error) {
    const fromDb = normalizzaApprovalToken(
      (data as { approval_token?: string | null } | null)?.approval_token,
    );
    if (fromDb) return fromDb;
  } else if (isApprovalTokenColumnMissingError(error.message)) {
    throw new Error(
      "Token di approvazione non disponibile. Aggiorna lo schema o riprova.",
    );
  } else if (error) {
    throw new Error(error.message);
  }

  const { data: nuovo, error: regenErr } = await supabase.rpc(
    "regenerate_campaign_approval_token",
    { p_campaign_id: campaignId },
  );

  if (!regenErr && typeof nuovo === "string") {
    const generated = normalizzaApprovalToken(nuovo);
    if (generated) return generated;
  }

  if (regenErr) {
    throw new Error(regenErr.message);
  }

  throw new Error(
    "Impossibile generare il link di approvazione. Riprova tra poco.",
  );
}

/**
 * Owner: rigenera token (invalida subito il vecchio link).
 * Non grant ad anon (RPC authenticated-only).
 */
export async function rigeneraTokenApprovazione(
  campaignId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "regenerate_campaign_approval_token",
    { p_campaign_id: campaignId },
  );
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data.trim()) {
    throw new Error("Token di approvazione non generato.");
  }
  return data.trim();
}

/**
 * Lettura pubblica approval tramite token RPC.
 */
export async function leggiCampagnaPerApprovazionePubblica(
  capability: string,
): Promise<Campagna | null> {
  const token = capability?.trim();
  if (!token) return null;

  const { data, error } = await supabase.rpc(
    "get_campaign_for_public_approval_token",
    { p_token: token },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data == null) return null;
  return mappaCampagnaDaRow(data as CampaignRow);
}

/**
 * APPROVED via RPC pubblica token.
 */
export async function approvaCampagnaPubblica(
  capability: string,
): Promise<string> {
  const token = capability.trim();
  if (!token) throw new Error("Token di approvazione mancante.");

  const { data, error } = await supabase.rpc("approve_campaign_public_token", {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  const campaignId = campaignIdDaRpc(data) ?? token;
  salvaAssetCampagnaLocale(campaignId, { reviewStatus: "APPROVED" });
  return approvedAtDaRpc(data);
}

/**
 * REVISION_REQUESTED via RPC pubblica token.
 */
export async function richiediRevisioneCampagnaPubblica(
  capability: string,
  note: string,
): Promise<string> {
  const revisionNotes = note.trim();
  if (!revisionNotes) {
    throw new Error("La nota di modifica è obbligatoria.");
  }
  if (revisionNotes === "Nessuna nota aggiuntiva fornita.") {
    throw new Error("Scrivi una nota di modifica concreta.");
  }

  const token = capability.trim();
  if (!token) throw new Error("Token di approvazione mancante.");

  const { data, error } = await supabase.rpc(
    "request_campaign_revision_public_token",
    { p_token: token, p_notes: revisionNotes },
  );

  if (error) {
    throw new Error(error.message);
  }

  const campaignId = campaignIdDaRpc(data) ?? token;
  salvaAssetCampagnaLocale(campaignId, {
    revisionNotes,
    reviewStatus: "REVISION_REQUESTED",
  });

  if (
    data &&
    typeof data === "object" &&
    "revision_notes" in data &&
    typeof (data as { revision_notes?: unknown }).revision_notes === "string"
  ) {
    return (data as { revision_notes: string }).revision_notes;
  }
  return revisionNotes;
}
