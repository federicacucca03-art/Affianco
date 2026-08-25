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
import type { CreativitaMeta } from "@/lib/creativita";

export type ClientRow = {
  id: string;
  created_at: string;
  name: string;
  elevator_pitch: string | null;
  average_ticket_value: number | null;
  closing_rate: number | null;
  website?: string | null;
};

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
  front_end_offer?: string | null;
  target_type?: string | null;
  target_age?: string | null;
  shipping_market?: string | null;
  hero_product?: string | null;
  clients?: ClientJoin | ClientJoin[] | null;
};

export type DatiSalvataggioCampagna = {
  nomeCliente: string;
  elevatorPitch?: string;
  website?: string;
  nomeCampagna: string;
  dailyBudget: number;
  maxSustainableCpa: number;
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
    id: row.id,
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
    approvedAt: row.approved_at ?? undefined,
    revisionNotes: (() => {
      const n = row.revision_notes?.trim();
      if (!n || n === "Nessuna nota aggiuntiva fornita.") return undefined;
      return n;
    })(),
  };

  return fondiCampagnaConAssetLocali(base);
}

/**
 * Crea o recupera un cliente per nome (match case-insensitive).
 */
export async function trovaOCreaCliente(input: {
  name: string;
  elevatorPitch?: string;
  website?: string;
  averageTicketValue?: number;
  closingRate?: number;
}): Promise<ClientRow> {
  const name = input.name.trim() || "Nuovo cliente";
  const website = input.website?.trim() || null;

  const { data: esistenti, error: errFind } = await supabase
    .from("clients")
    .select("*")
    .ilike("name", name)
    .limit(1);

  if (errFind) throw new Error(errFind.message);

  const esistente = esistenti?.[0] as ClientRow | undefined;
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

  const creato = await insertConFallbackColonne("clients", {
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
  });

  return {
    ...(creato as unknown as ClientRow),
    website: (creato.website as string | null | undefined) ?? website,
  };
}

/** Inserisce una campagna (tutti gli obiettivi) collegata al cliente. */
export async function creaCampagnaLeadGen(input: {
  clientId: string;
  name: string;
  dailyBudget: number;
  maxSustainableCpa: number;
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
}): Promise<CampaignRow> {
  const objective = input.objective ?? "LEADS";
  const nomeFallback =
    objective === "BOOKINGS"
      ? "Prenotazioni"
      : objective === "ECOMMERCE"
        ? "Vendite Online"
        : objective === "IN_STORE"
          ? "Traffico Negozio"
          : objective === "RETARGETING"
            ? "Retargeting / Recupero"
            : objective === "AWARENESS"
              ? "Apertura / Lancio Locale"
              : "Richieste Contatto";
  const payload: Record<string, unknown> = {
    client_id: input.clientId,
    name: input.name.trim() || nomeFallback,
    objective,
    status: input.status ?? "DRAFT",
    daily_budget: input.dailyBudget,
    max_sustainable_cpa: input.maxSustainableCpa,
  };

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

  const data = await insertConFallbackColonne("campaigns", payload);
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
      dati.maxSustainableCpa > 0 ? dati.maxSustainableCpa : undefined,
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
  };
}

/** Cliente + campagna in un’unica operazione (con asset). */
export async function salvaCampagnaCompleta(
  dati: DatiSalvataggioCampagna,
): Promise<Campagna> {
  const cliente = await trovaOCreaCliente({
    name: dati.nomeCliente,
    elevatorPitch: dati.elevatorPitch,
    website: dati.website,
    averageTicketValue:
      dati.recoveryValue ??
      dati.averageReceipt ??
      dati.averageOrderValue ??
      dati.bookingServiceValue ??
      dati.averageTicketValue,
    closingRate: dati.showUpRate ?? dati.closingRate,
  });

  const campagna = await creaCampagnaLeadGen({
    clientId: cliente.id,
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
  });

  const assets = assetsDaDati(dati);
  salvaAssetCampagnaLocale(campagna.id, assets);

  try {
    await logCampagnaCreata(campagna.id);
  } catch {
    // Diario non bloccante.
  }

  return mappaCampagnaDaRow({
    ...campagna,
    variante_a: campagna.variante_a ?? dati.varianteA,
    variante_b: campagna.variante_b ?? dati.varianteB,
    variante_c: campagna.variante_c ?? dati.varianteC,
    page_id: campagna.page_id ?? dati.pageId,
    form_id: campagna.form_id ?? dati.formId,
    settore: campagna.settore ?? dati.settore,
    citta: campagna.citta ?? dati.citta,
    raggio_km: campagna.raggio_km ?? dati.raggioKm,
    eta_min: campagna.eta_min ?? dati.etaMin,
    eta_max: campagna.eta_max ?? dati.etaMax,
    titolo_annuncio: campagna.titolo_annuncio ?? dati.titoloAnnuncio,
    target_margin: campagna.target_margin ?? dati.targetMargin,
    booking_service_value:
      campagna.booking_service_value ?? dati.bookingServiceValue,
    show_up_rate: campagna.show_up_rate ?? dati.showUpRate,
    booking_channel: campagna.booking_channel ?? dati.bookingChannel,
    booking_confirmation_policy:
      campagna.booking_confirmation_policy ?? dati.bookingConfirmationPolicy,
    average_order_value:
      campagna.average_order_value ?? dati.averageOrderValue,
    product_margin: campagna.product_margin ?? dati.productMargin,
    average_receipt: campagna.average_receipt ?? dati.averageReceipt,
    store_margin: campagna.store_margin ?? dati.storeMargin,
    recovery_value: campagna.recovery_value ?? dati.recoveryValue,
    recovery_margin: campagna.recovery_margin ?? dati.recoveryMargin,
    recovery_discount: campagna.recovery_discount ?? dati.recoveryDiscount,
    launch_budget: campagna.launch_budget ?? dati.launchBudget,
    awareness_radius_km:
      campagna.awareness_radius_km ?? dati.awarenessRadiusKm,
    estimated_cpm: campagna.estimated_cpm ?? dati.estimatedCpm,
    front_end_offer: campagna.front_end_offer ?? dati.frontEndOffer,
    target_type: campagna.target_type ?? dati.targetType,
    target_age: campagna.target_age ?? dati.targetAge,
    shipping_market: campagna.shipping_market ?? dati.shippingMarket,
    hero_product: campagna.hero_product ?? dati.heroProduct,
    clients: {
      id: cliente.id,
      name: cliente.name,
      elevator_pitch: cliente.elevator_pitch ?? dati.elevatorPitch ?? null,
      average_ticket_value: cliente.average_ticket_value,
      closing_rate: cliente.closing_rate,
      website: cliente.website ?? dati.website ?? null,
    },
  });
}

const SELECT_LISTA =
  "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, booking_service_value, show_up_rate, booking_channel, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin, recovery_discount, launch_budget, awareness_radius_km, estimated_cpm, approved_at, revision_notes, clients(id, name, elevator_pitch, average_ticket_value, closing_rate)";

const SELECT_DETTAGLIO =
  "id, created_at, client_id, name, objective, status, daily_budget, max_sustainable_cpa, variante_a, variante_b, variante_c, page_id, form_id, settore, citta, raggio_km, eta_min, eta_max, titolo_annuncio, target_margin, booking_service_value, show_up_rate, booking_channel, booking_confirmation_policy, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin, recovery_discount, launch_budget, awareness_radius_km, estimated_cpm, front_end_offer, target_type, target_age, shipping_market, hero_product, approved_at, revision_notes, clients(id, name, elevator_pitch, average_ticket_value, closing_rate, website)";

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
