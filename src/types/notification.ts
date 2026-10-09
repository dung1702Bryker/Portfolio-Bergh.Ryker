export type NotificationType = "new_booking" | "traffic_spike" | "stranger_visitor";

export interface AdminPushNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  metadata?: {
    bookingId?: string;
    customerName?: string;
    schoolName?: string;
    phone?: string;
    date?: string;
    conceptType?: string;
    visitorCount?: number;
    popularPage?: string;
    device?: string;
    browser?: string;
    location?: string;
  };
}

export interface NotificationSettings {
  soundEnabled: boolean;
  browserPushEnabled: boolean;
  spikeThreshold: number; // e.g. 1, 2, 3, 5, 8, 10
  strangerAlertEnabled: boolean; // Alert when non-admin / stranger device visits
  backgroundPushActive: boolean; // Indicates if service worker push subscription is configured
}
