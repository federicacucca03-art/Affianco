/**
 * Italian copy for M7B.1 notification candidates — operational, no enums.
 */

import type {
  NotificationSeverity,
  NotificationType,
} from "@/lib/campaign-notifications/types";

export function notificationTitle(type: NotificationType): string {
  switch (type) {
    case "PERFORMANCE_DROPPED":
      return "Costo fuori soglia";
    case "CRITICAL_STATE":
      return "Campagna critica";
    case "RECOVERED":
      return "Campagna tornata stabile";
    case "CONFIGURATION_REQUIRED":
      return "Configurazione incompleta";
    case "DATA_STALE":
      return "Dati da aggiornare";
    case "CLIENT_REVISION":
      return "Revisione cliente";
  }
}

export function notificationMessage(type: NotificationType): string {
  switch (type) {
    case "PERFORMANCE_DROPPED":
      return "La campagna richiede attenzione: il costo per risultato ha superato la soglia.";
    case "CRITICAL_STATE":
      return "La campagna è entrata in uno stato critico e merita un controllo prioritario.";
    case "RECOVERED":
      return "Il costo per risultato è rientrato nella soglia.";
    case "CONFIGURATION_REQUIRED":
      return "Manca un target o una mappatura risultato: senza questo non si può valutare la performance.";
    case "DATA_STALE":
      return "I dati Meta di questa campagna attiva non risultano aggiornati da troppo tempo.";
    case "CLIENT_REVISION":
      return "Il cliente ha richiesto una revisione della campagna.";
  }
}

export function notificationCtaLabel(type: NotificationType): string {
  switch (type) {
    case "CLIENT_REVISION":
      return "Gestisci revisione";
    case "CONFIGURATION_REQUIRED":
      return "Controlla risultati";
    case "DATA_STALE":
      return "Controlla risultati";
    case "PERFORMANCE_DROPPED":
    case "CRITICAL_STATE":
    case "RECOVERED":
      return "Apri campagna";
  }
}

export function etichettaNotificationSeverity(
  severity: NotificationSeverity,
): string {
  switch (severity) {
    case "HIGH":
      return "Alta";
    case "MEDIUM":
      return "Media";
    case "LOW":
      return "Bassa";
  }
}
