"use client";

import type { ConfigurazioneContatti, CampagnaObjective } from "@/types/campagne";
import { stimaBenchmark } from "@/data/benchmarks";
import {
  calculateBreakEvenPerBooking,
  calculateBreakEvenPerLead,
  calculateImpressionsAwareness,
  calculateLtvEconomics,
  calculateMaxSustainableBookingCpa,
  calculateMaxSustainableCpl,
  calculateMaxSustainableInStoreCpa,
  calculateMaxSustainableRecoveryCpa,
  calculatePersoneUnicheAwareness,
  calculateUtilePerScontrino,
  calculateValoreNettoRecupero,
  FREQUENZA_AWARENESS_DEFAULT,
  type TargetMarginPercent,
} from "@/lib/benchmarks";
import { isCategoriaAmpia } from "@/lib/validate-elevator-pitch";
import { BarraBreakEven } from "@/components/nuova-contatti/BarraBreakEven";
import { alertFattibilitaNicchia } from "@/lib/fattibilita-nicchia";
import type { TargetType } from "@/types/campagne";
import { riferimentoAstaMeta, type SettoreIntel } from "@/lib/sector-intel";
import {
  type ConversionRateSource,
  tassoConversioneLeadsValido,
} from "@/lib/conversion-rate";

type Props = {
  config: ConfigurazioneContatti;
  settore?: string;
  citta?: string;
  scontrinoMedio: number | string;
  tassoConversione: number | string;
  targetMargin: TargetMarginPercent;
  objective?: CampagnaObjective;
  productMargin?: number | string;
  fulfillmentCost?: number | string;
  ecommerceLtvAttivo?: boolean;
  recoveryDiscount?: number | string;
  ltvAttivo?: boolean;
  frequenzaAnnuale?: number | string;
  anniPermanenza?: number | string;
  loyaltyPercent?: number | string;
  margineLordoLtv?: number | string;
  targetType?: TargetType;
  /** AWARENESS: budget totale di lancio. */
  launchBudget?: number | string;
  /** AWARENESS: CPM stimato locale. */
  estimatedCpm?: number | string;
  settoreIntel?: SettoreIntel | null;
  /** UX moderna RETARGETING (Step 1–2). */
  percorsoRetargeting?: boolean;
  /** UX moderna AWARENESS / apertura (Step 1–2). */
  percorsoAwareness?: boolean;
  percorsoLeads?: boolean;
  conversionRateSource?: ConversionRateSource;
};

export function PannelloPerche({
  config,
  settore,
  citta,
  scontrinoMedio,
  tassoConversione,
  targetMargin,
  objective = "LEADS",
  productMargin = 40,
  recoveryDiscount = 0,
  ltvAttivo = false,
  frequenzaAnnuale = 1,
  anniPermanenza = 1,
  loyaltyPercent = 0,
  margineLordoLtv = 50,
  targetType = "B2C",
  launchBudget = 300,
  estimatedCpm = 7,
  settoreIntel = null,
  percorsoRetargeting = false,
  percorsoAwareness = false,
  percorsoLeads = false,
  conversionRateSource = "ESTIMATED",
}: Props) {
  const isBookings = objective === "BOOKINGS";
  const isInStore = objective === "IN_STORE";
  const isRetargeting = objective === "RETARGETING";
  const isEcommerce = objective === "ECOMMERCE";
  const isAwareness = objective === "AWARENESS";
  const isPercorsoRetargeting = percorsoRetargeting && isRetargeting;
  const isPercorsoAwareness = percorsoAwareness && isAwareness;
  const isLeads =
    !isBookings &&
    !isInStore &&
    !isRetargeting &&
    !isEcommerce &&
    !isAwareness;
  const riferimentoMercato = riferimentoAstaMeta(
    settoreIntel,
    isBookings || isInStore || isRetargeting || isEcommerce,
  );
  const budgetGiornaliero = config.budgetGiornaliero;
  const budgetMensile = budgetGiornaliero * 30;
  const benchmark = stimaBenchmark(budgetGiornaliero, settore);
  const raggio = config.raggioKm;
  const eta = `${config.etaMin}–${config.etaMax}`;
  const cittaPulita = (citta ?? "").trim();
  const budgetLancio = Math.abs(Number(launchBudget) || 0);
  const cpmLocale = Math.abs(Number(estimatedCpm) || 7);
  const impressionsAwareness = isAwareness
    ? calculateImpressionsAwareness(budgetLancio, cpmLocale)
    : 0;
  const personeUnicheAwareness = isAwareness
    ? calculatePersoneUnicheAwareness(budgetLancio, cpmLocale)
    : 0;
  const numericScontrino = Number(scontrinoMedio) || 0;
  const tassoLeads = percorsoLeads
    ? tassoConversioneLeadsValido(conversionRateSource, tassoConversione)
    : null;
  const numericTasso = percorsoLeads
    ? (tassoLeads ?? 0)
    : Number(tassoConversione) || (isBookings ? 75 : 10);
  const margineNegozio =
    Number(productMargin) ||
    (isEcommerce ? 60 : isRetargeting ? 50 : 40);
  const sconto = Number(recoveryDiscount) || 0;
  const breakEven = isRetargeting
    ? calculateValoreNettoRecupero(numericScontrino, sconto)
    : isInStore
      ? calculateUtilePerScontrino(numericScontrino, margineNegozio)
      : isBookings
        ? calculateBreakEvenPerBooking(numericScontrino, numericTasso)
        : calculateBreakEvenPerLead(numericScontrino, numericTasso);
  const maxCpl = isRetargeting
    ? calculateMaxSustainableRecoveryCpa(
        numericScontrino,
        margineNegozio,
        sconto,
      )
    : isInStore
      ? calculateMaxSustainableInStoreCpa(
          numericScontrino,
          margineNegozio,
          targetMargin,
        )
      : isBookings
        ? calculateMaxSustainableBookingCpa(
            numericScontrino,
            numericTasso,
            targetMargin,
          )
        : calculateMaxSustainableCpl(
            numericScontrino,
            numericTasso,
            targetMargin,
          );
  const spendShare = 100 - targetMargin;
  const cittaNota = citta?.trim() || "la zona del cliente";
  const scontrinoLabel = numericScontrino > 0 ? numericScontrino : "—";
  const categoriaAmpia = isCategoriaAmpia(settore);
  const ltvSupportato =
    ltvAttivo &&
    !isEcommerce &&
    !isInStore &&
    !isRetargeting &&
    !isAwareness &&
    numericScontrino > 0;
  const ltvEconomics = ltvSupportato
    ? calculateLtvEconomics({
        scontrinoMedio: numericScontrino,
        frequenzaAnnuale: Number(frequenzaAnnuale) || 1,
        anniPermanenza: Number(anniPermanenza) || 1,
        loyaltyPercent: Number(loyaltyPercent) || 0,
        margineLordoPercent: Number(margineLordoLtv) || 50,
        tassoConversionePercent: numericTasso,
        targetMarginPercent: targetMargin,
      })
    : null;

  const mostraBarraEconomica =
    !isRetargeting &&
    !isInStore &&
    !isEcommerce &&
    !isAwareness &&
    numericScontrino > 0 &&
    !(percorsoLeads && conversionRateSource === "UNKNOWN") &&
    (ltvEconomics
      ? ltvEconomics.breakEvenCpl > 0 && ltvEconomics.cplSostenibileLtv > 0
      : breakEven > 0 && maxCpl > 0);
  const alertFattibilita = mostraBarraEconomica
    ? alertFattibilitaNicchia({
        cplSostenibile: ltvEconomics
          ? ltvEconomics.cplSostenibileLtv
          : maxCpl,
        settore,
        targetType,
      })
    : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius)] bg-[#e8f0fe] p-5">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Perché questa configurazione
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          {isPercorsoRetargeting ? (
            <>
              💡 Affianco prepara struttura, messaggio ed economia del recupero.
              Il pubblico di retargeting (Custom Audience, finestra ed
              esclusioni) va collegato in Meta Ads Manager prima della
              pubblicazione.
            </>
          ) : isPercorsoAwareness ? (
            <>
              💡 Per un lancio locale usi budget e CPM di riferimento per
              stimare l&apos;esposizione nel raggio di {raggio} km
              {cittaPulita ? ` intorno a ${cittaPulita}` : ""}. Con una
              destinazione la campagna lavora sui click verso il link; senza
              destinazione lavora sulla copertura. Non misura visite fisiche né
              partecipanti.
            </>
          ) : isRetargeting ? (
            <>
              💡 Perché questa configurazione? Il retargeting non usa filtri di
              età o raggio chilometrico: l&apos;algoritmo mostra
              l&apos;inserzione ESCLUSIVAMENTE a chi ha già interagito con il
              brand negli ultimi 14-60 giorni per massimizzare la
              riconversione al minor costo.
            </>
          ) : isAwareness ? (
            <>
              💡 Per un lancio locale puntiamo su un raggio stretto di {raggio}{" "}
              km
              {cittaPulita ? ` intorno a ${cittaPulita}` : ""} con alta
              frequenza visiva, così saturiamo il bacino di residenti prima
              dell&apos;inaugurazione.
            </>
          ) : isInStore ? (
            <>
              💡 Per le attività locali, il raggio di {raggio} km attorno a{" "}
              {cittaPulita || "la zona del negozio"} garantisce che
              l&apos;annuncio venga mostrato a persone che possono fisicamente
              raggiungere il locale in 10-15 minuti.
            </>
          ) : isEcommerce ? (
            <>
              💡 Perché questa configurazione? Usiamo un pubblico Broad (senza
              filtri di interesse), età {eta}, così l&apos;algoritmo trova da
              solo chi ha più probabilità di acquistare. Il budget Advantage+ a{" "}
              {budgetGiornaliero}€ al giorno lascia a Meta la distribuzione,
              senza ottimizzazioni manuali premature.
            </>
          ) : (
            <>
              💡 Per {(settore ?? "").trim() || "un'attività locale"} a{" "}
              {cittaPulita || "la tua zona"}, un raggio di {raggio} km su
              pubblico Broad è ideale per consentire a Meta di trovare contatti
              qualificati al miglior CPL.
            </>
          )}
        </p>
      </section>

      {isPercorsoRetargeting ? (
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Da configurare in Meta
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            <li>Custom Audience</li>
            <li>Finestra del pubblico</li>
            <li>Eventuali esclusioni</li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
            Questi passaggi restano manuali in Ads Manager dopo
            l&apos;export.
          </p>
        </section>
      ) : null}

      <section className="rounded-[var(--radius)] bg-[#fff6e5] p-5">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Fase di apprendimento e tempistiche
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          Nota operativa: Nei primi 3-4 giorni l&apos;algoritmo distribuisce il
          budget per stabilizzare l&apos;asta. È consigliabile non apportare
          modifiche strutturali prima di aver raccolto i dati del quarto giorno.
          Se dopo una settimana non arriva nessun contatto, torniamo qui e
          rivediamo insieme.
        </p>
      </section>

      {!isEcommerce && !isLeads && !isBookings && (
        <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-medium text-[var(--ink)]">
            Proiezione costi e sostenibilità
          </h2>

          {isAwareness ? (
            <div className="mt-4 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              {isPercorsoAwareness ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                    STIMA · Copertura del lancio
                  </p>
                  {impressionsAwareness > 0 ? (
                    <>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                        STIMA · Impression: ~
                        {impressionsAwareness.toLocaleString("it-IT")}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
                        STIMA · Copertura indicativa: ≈{" "}
                        {personeUnicheAwareness.toLocaleString("it-IT")}{" "}
                        persone · stima indicativa
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                        Calcolo interno: budget e CPM di riferimento; frequenza
                        media di riferimento del modello 2,5. Non utilizza dati
                        live Meta.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                      Inserisci budget di lancio e CPM al Passo 2 per le stime
                      di esposizione.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                    Copertura Residenti Stimata
                  </p>
                  {personeUnicheAwareness > 0 ? (
                    <>
                      <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                        ~{personeUnicheAwareness.toLocaleString("it-IT")} Persone
                        Uniche
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                        Stima in base a budget di lancio {budgetLancio}€ e CPM{" "}
                        {cpmLocale}€.
                      </p>
                      <p className="mt-3 border-t border-[#c6e7c8] pt-3 text-sm leading-relaxed text-[var(--ink)]">
                        Frequenza Target: ~
                        {FREQUENZA_AWARENESS_DEFAULT}x per ogni residente nel
                        raggio di {raggio} km
                        {cittaPulita ? ` intorno a ${cittaPulita}` : ""}.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                      Inserisci budget di lancio e CPM al Passo 2 per stimare la
                      copertura.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : categoriaAmpia ? (
            <div className="mt-4 rounded-xl border border-[#f5c9b8] bg-[#fff4f0] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#C26A0A]">
                Livello 3 · Categoria ampia
              </p>
              <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                N/D (categoria ampia)
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                Per settori generici non mostriamo forchette numeriche di CPL:
                rischierebbero di essere fuorvianti. Usa il brief specifico
                (prodotto/servizio concreto) e valuta la sostenibilità sul
                scontrino medio del cliente, non su medie di nicchia.
              </p>
              <p className="mt-3 border-t border-[#f5c9b8] pt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
                Guida qualitativa: parti con budget contenuto, messaggio chiaro
                sul servizio offerto e raggio locale. Affina i numeri solo dopo
                i primi contatti reali.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {ltvEconomics
                  ? isBookings
                    ? "CPA sostenibile su LTV"
                    : "CPL sostenibile su LTV"
                  : isRetargeting
                    ? isPercorsoRetargeting
                      ? "CPA Max sostenibile"
                      : "CPA Massima Sostenibile di Recupero"
                    : isInStore
                      ? "CPA Max sostenibile"
                      : isBookings
                        ? "Costo per Prenotazione Sostenibile"
                        : "CPL target di riferimento"}
              </p>
              {ltvEconomics ? (
                <>
                  <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                    {ltvEconomics.cplSostenibileLtv}€
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                    Limite su LTV a {ltvEconomics.anniPermanenza}{" "}
                    {ltvEconomics.anniPermanenza === 1 ? "anno" : "anni"}{" "}
                    (primo acquisto: {ltvEconomics.cplPrimoAcquisto}€).
                  </p>
                  <p className="mt-3 border-t border-[#c6e7c8] pt-3 text-sm leading-relaxed text-[var(--ink)]">
                    Un acquisito al {isBookings ? "CPA" : "CPL"} limite di{" "}
                    <span className="font-medium">
                      {ltvEconomics.cplSostenibileLtv}€
                    </span>{" "}
                    genera un valore complessivo di{" "}
                    <span className="font-medium">{ltvEconomics.ltv}€</span>{" "}
                    nel ciclo di vita del cliente.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                    {numericScontrino > 0 && maxCpl > 0
                      ? `${maxCpl}€`
                      : isRetargeting
                        ? "Inserisci valore e margine di recupero"
                        : isInStore
                          ? "Inserisci scontrino e margine negozio"
                          : isBookings
                            ? "Inserisci il valore della visita"
                            : "Inserisci lo scontrino medio"}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                    {isPercorsoRetargeting
                      ? "È una soglia economica di riferimento per il recupero, non una previsione del CPA che Meta genererà."
                      : isRetargeting
                      ? "Finché il costo per cliente ripescato rimane sotto questa cifra, il recupero resta sostenibile (soglia × 0,6 sul pubblico caldo)."
                      : isInStore
                        ? "È la soglia economica massima che puoi permetterti per un nuovo cliente in negozio mantenendo il margine desiderato. Non è una previsione del costo che Meta genererà."
                        : isBookings
                          ? `Finché il costo per prenotazione su Meta rimane sotto questa cifra, il cliente preserva il margine di profitto desiderato (${targetMargin}%).`
                          : `Finché il costo per contatto su Meta rimane sotto questa cifra, il cliente preserva il margine di profitto target (${targetMargin}%).`}
                  </p>
                  {isPercorsoRetargeting &&
                  numericScontrino > 0 &&
                  maxCpl > 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                      Il calcolo applica il buffer operativo previsto dal
                      modello Affianco (×0,6). Non è un benchmark Meta.
                    </p>
                  ) : null}
                  {numericScontrino > 0 && maxCpl > 0 ? (
                    <div className="mt-3 space-y-1.5 border-t border-[#c6e7c8] pt-3 text-xs leading-relaxed text-[var(--ink)]">
                      <p>
                        {isRetargeting
                          ? "Valore Netto"
                          : isInStore
                            ? "Utile per Scontrino"
                            : isBookings
                              ? "Break-even per Prenotazione"
                              : "Break-even per Lead"}
                        :{" "}
                        <span className="font-medium">
                          {isRetargeting
                            ? `${scontrinoLabel}€ × (1 - ${sconto}%) = ${breakEven}€`
                            : isInStore
                              ? `${scontrinoLabel}€ × ${margineNegozio}% = ${breakEven}€`
                              : `${scontrinoLabel}€ × ${numericTasso}% = ${breakEven}€`}
                        </span>
                      </p>
                      <p>
                        {isRetargeting
                          ? `CPA Sostenibile (valore netto × margine ${margineNegozio}% × 0,6)`
                          : isInStore
                            ? `CPA Sostenibile (${spendShare}% di spendibilità, margine ${targetMargin}%)`
                            : isBookings
                              ? `CPA Sostenibile (${spendShare}% di spendibilità, margine ${targetMargin}%)`
                              : `CPL target di riferimento (${spendShare}% di sicurezza, margine ${targetMargin}%)`}
                        : <span className="font-medium">{maxCpl}€</span>
                      </p>
                    </div>
                  ) : null}
                </>
              )}
              {mostraBarraEconomica ? (
                <BarraBreakEven
                  breakEven={
                    ltvEconomics ? ltvEconomics.breakEvenCpl : breakEven
                  }
                  targetProfitto={
                    ltvEconomics ? ltvEconomics.cplSostenibileLtv : maxCpl
                  }
                  etichettaCosto={
                    isBookings || isInStore ? "CPA" : "CPL"
                  }
                  alert={alertFattibilita}
                  riferimentoMercato={riferimentoMercato}
                />
              ) : null}
            </div>
          )}

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2.5">
              <dt className="text-[var(--ink-muted)]">
                {isAwareness
                  ? "Budget totale di lancio"
                  : "Budget mensile stimato"}
              </dt>
              <dd className="font-medium text-[var(--ink)]">
                {isAwareness ? budgetLancio : budgetMensile}€
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2.5">
              <dt className="text-[var(--ink-muted)]">
                {isPercorsoAwareness
                  ? "STIMA · Impression"
                  : isAwareness
                  ? "Visualizzazioni Totali Stimate"
                  : isRetargeting
                    ? "Vendite / Lead Recuperati al mese"
                    : isInStore
                      ? "STIMA · Range indicativo"
                      : "Contatti al mese"}
              </dt>
              <dd className="font-medium text-[var(--ink)]">
                {isAwareness
                  ? impressionsAwareness > 0
                    ? `~${impressionsAwareness.toLocaleString("it-IT")}`
                    : "—"
                  : categoriaAmpia
                    ? "N/D (Categoria ampia)"
                    : `${benchmark.contattiMin}-${benchmark.contattiMax}`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--ink-muted)]">
                {isAwareness
                  ? "CPM di riferimento"
                  : isInStore
                    ? "STIMA · Costo medio di riferimento"
                    : "Costo medio per contatto"}
              </dt>
              <dd className="font-medium text-[var(--ink)]">
                {isAwareness
                  ? `${cpmLocale}€`
                  : riferimentoMercato
                    ? `${riferimentoMercato.min}–${riferimentoMercato.max}€`
                    : categoriaAmpia
                      ? "N/D (Categoria ampia)"
                      : `${benchmark.costoMin}-${benchmark.costoMax}€`}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
            {isPercorsoAwareness
              ? `Con budget ${budgetLancio}€ e CPM di riferimento ${cpmLocale}€: STIMA · Impression ~${impressionsAwareness.toLocaleString("it-IT")}; STIMA · Copertura indicativa ≈ ${personeUnicheAwareness.toLocaleString("it-IT")} persone (frequenza media di riferimento del modello 2,5). Non utilizza dati live Meta.`
              : isAwareness
              ? `Con ${budgetLancio}€ di budget di lancio e CPM ${cpmLocale}€ stimiamo circa ${impressionsAwareness.toLocaleString("it-IT")} visualizzazioni e ${personeUnicheAwareness.toLocaleString("it-IT")} persone uniche nel raggio${cittaPulita ? ` di ${cittaPulita}` : ""}.`
              : isInStore
                ? "Basato su budget e benchmark interni. Non rappresenta una previsione delle visite reali in negozio."
              : categoriaAmpia
                ? "Per questa categoria non pubblichiamo stime numeriche di CPL: il rischio di errore è troppo alto senza un servizio specifico nel brief."
                : `Con ${budgetGiornaliero}€ al giorno (${budgetMensile}€ al mese) il riferimento per ${benchmark.etichettaCategoria} è questo intervallo (tipicamente intorno a ${benchmark.budgetRiferimento}€/mese). Non è una promessa: è un ordine di grandezza da tenere a mente.`}
          </p>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
            {isPercorsoAwareness
              ? "ℹ️ Reach vs Link Clicks: con destinazione → click verso il link; senza destinazione → copertura. Non misura visite fisiche."
              : isAwareness
              ? "ℹ️ Stima basata su un CPM medio di 7€ per campagne di Notorietà / Lancio Locale in Italia."
              : isRetargeting
                ? "ℹ️ Stima basata su benchmark per campagne di Retargeting / Recupero Carrelli su Meta Italia."
                : isInStore
                  ? "ℹ️ Stima indicativa basata su budget e benchmark interni (non dato Meta)."
                  : `ℹ️ Stima basata su benchmark di settore per campagne Lead Form Meta in Italia, adattata al raggio di ${cittaNota}.`}
          </p>
        </section>
      )}
    </div>
  );
}
