export type VisitorRole = "admin" | "visitor";

export interface ActiveVisitor {
  id: string;
  deviceId?: string;
  visitorName: string;
  role: VisitorRole;
  currentPage: string;
  currentViewDetail?: string;
  device: string;
  browser: string;
  joinedAt: string;
  lastActive: string;
  isOnline: boolean;
  avatarColor?: string;
  isAdminDevice?: boolean;
  location?: string;
  city?: string;
  region?: string;
  ip?: string;
  rawIp?: string;
  // Returning visitor metrics
  isReturning?: boolean;
  visitCount?: number;
  firstSeenAt?: string;
  screenResolution?: string;
  pageViews?: number;
  // Browser version and Network Connection metrics
  browserVersion?: string;
  connectionType?: string; // "Wi-Fi", "4G", "5G", "3G", "2G", "Offline"
  effectiveType?: string; // "4g", "3g", "2g", "slow-2g"
  downlink?: number; // Mb/s
  rtt?: number; // round-trip time in ms
  saveData?: boolean; // data saver mode
}

export interface LivePresenceContextValue {
  activeVisitors: ActiveVisitor[];
  activeCount: number;
  currentVisitorId: string;
  currentDeviceId?: string;
  currentVisitor?: ActiveVisitor;
  visitorLocation: string;
  isReturningVisitor?: boolean;
  visitCount?: number;
  refreshPreciseLocation?: () => Promise<string>;
  calibrateGpsLocation?: (promptUser?: boolean) => Promise<string>;
  setCustomLocation?: (newLocation: string) => Promise<void>;
  resetToAutoLocation?: () => Promise<string>;
  updateLocation: (page: string, detail?: string) => void;
  updateNickname: (newNickname: string) => void;
  updateAdminStatus?: (isAdmin: boolean, adminName?: string) => Promise<void>;
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
}
