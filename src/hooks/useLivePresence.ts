import { useEffect } from "react";
import { useLivePresenceContext } from "../context/LivePresenceContext";
import { ActiveVisitor } from "../types/presence";

export function useLivePresence(initialPage?: string, initialDetail?: string): {
  activeVisitors: ActiveVisitor[];
  activeCount: number;
  currentVisitorId: string;
  currentVisitor?: ActiveVisitor;
  updateLocation: (page: string, detail?: string) => void;
  updateNickname: (newNickname: string) => void;
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
} {
  const context = useLivePresenceContext();

  useEffect(() => {
    if (initialPage) {
      context.updateLocation(initialPage, initialDetail || "Khám phá");
    }
  }, [initialPage, initialDetail, context]);

  return context;
}
