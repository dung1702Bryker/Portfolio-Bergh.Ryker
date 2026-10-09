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
  // Returning visitor metrics
  isReturning?: boolean;
  visitCount?: number;
  firstSeenAt?: string;
  screenResolution?: string;
  pageViews?: number;
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
  updateLocation: (page: string, detail?: string) => void;
  updateNickname: (newNickname: string) => void;
  updateAdminStatus?: (isAdmin: boolean, adminName?: string) => Promise<void>;
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
}
