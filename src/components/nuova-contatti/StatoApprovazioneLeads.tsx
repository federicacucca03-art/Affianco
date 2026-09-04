/** Stati UI approvazione cliente (solo percorso LEADS step 6). */
export type StatoApprovazioneLeads =
  | "non_inviata"
  | "in_attesa"
  | "approvata"
  | "modifiche_richieste";

export function mappaStatoApprovazioneLeads(
  campagnaId: string | null,
  statusGrezzo: string | null | undefined,
): StatoApprovazioneLeads {
  if (!campagnaId) return "non_inviata";
  const s = (statusGrezzo ?? "DRAFT").toUpperCase();
  if (s === "APPROVED") return "approvata";
  if (s === "REVISION_REQUESTED") return "modifiche_richieste";
  return "in_attesa";
}

export function etichettaStatoApprovazioneLeads(
  stato: StatoApprovazioneLeads,
): string {
  switch (stato) {
    case "non_inviata":
      return "In attesa di invio al cliente";
    case "in_attesa":
      return "In attesa";
    case "approvata":
      return "Approvata";
    case "modifiche_richieste":
      return "Modifiche richieste";
  }
}

export function stileBadgeStatoApprovazione(stato: StatoApprovazioneLeads): string {
  switch (stato) {
    case "approvata":
      return "aff-badge aff-badge--success aff-badge--pill";
    case "modifiche_richieste":
      return "aff-badge aff-badge--danger aff-badge--pill";
    case "in_attesa":
      return "aff-badge aff-badge--warning aff-badge--pill";
    default:
      return "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--ink-muted)]";
  }
}
