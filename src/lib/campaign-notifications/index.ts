export type {
  NotificationCampaignSnapshot,
  NotificationDecision,
  NotificationReasonCode,
  NotificationSeverity,
  NotificationType,
} from "@/lib/campaign-notifications/types";

export {
  resolveNotificationDecision,
  snapshotFromControlRoomFields,
} from "@/lib/campaign-notifications/resolve";

export {
  etichettaNotificationSeverity,
  notificationCtaLabel,
  notificationMessage,
  notificationTitle,
} from "@/lib/campaign-notifications/copy";

export {
  evaluateAndPersistCampaignNotification,
  createMemoryNotificationStore,
} from "@/lib/campaign-notifications/evaluate-persist";

export {
  snapshotFromAttentionItem,
  snapshotFromMonitoringRow,
  monitoringRowFromSnapshot,
  identityIds,
} from "@/lib/campaign-notifications/snapshot";
