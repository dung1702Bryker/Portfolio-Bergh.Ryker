import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { LivePresenceProvider } from "./context/LivePresenceContext";
import { AdminNotificationProvider } from "./context/AdminNotificationContext";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker safely
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.log("BERGH.RYKER PWA is ready for offline and push notifications.");
      },
    });
  } catch (err) {
    console.debug("PWA service worker registration skipped:", err);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <LivePresenceProvider>
        <AdminNotificationProvider>
          <App />
        </AdminNotificationProvider>
      </LivePresenceProvider>
    </HelmetProvider>
  </StrictMode>,
);
