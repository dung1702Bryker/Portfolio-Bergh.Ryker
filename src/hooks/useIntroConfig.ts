import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, cleanFirestoreData } from "../firebase";
import { IntroConfig, DEFAULT_INTRO_CONFIG } from "../types/introConfig";
import { recordAutoBackup, getSystemBackupVault } from "../services/backupService";

const LOCAL_STORAGE_KEY = "bergh_ryker_intro_config";

export function useIntroConfig() {
  const [config, setConfig] = useState<IntroConfig>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          return {
            ...DEFAULT_INTRO_CONFIG,
            ...parsed,
            cards: Array.isArray(parsed.cards) && parsed.cards.length > 0 ? parsed.cards : DEFAULT_INTRO_CONFIG.cards,
          };
        }
      }
    } catch (_) {}
    return DEFAULT_INTRO_CONFIG;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "configs", "introConfig"),
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<IntroConfig>;
          const merged: IntroConfig = {
            ...DEFAULT_INTRO_CONFIG,
            ...data,
            cards: Array.isArray(data.cards) && data.cards.length > 0 ? data.cards : DEFAULT_INTRO_CONFIG.cards,
          };
          setConfig(merged);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          } catch (_) {}
        } else {
          // Document không tồn tại trong configs: Thử kiểm tra systemBackupVault
          try {
            const vault = await getSystemBackupVault();
            if (vault && vault.introConfig && vault.introConfig.cards) {
              const merged: IntroConfig = {
                ...DEFAULT_INTRO_CONFIG,
                ...vault.introConfig,
                cards: Array.isArray(vault.introConfig.cards) && vault.introConfig.cards.length > 0 ? vault.introConfig.cards : DEFAULT_INTRO_CONFIG.cards,
              };
              setConfig(merged);
            }
          } catch (_) {}
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Could not listen to introConfig from Firestore:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const saveIntroConfig = useCallback(async (newConfig: IntroConfig): Promise<boolean> => {
    try {
      const clean = cleanFirestoreData(newConfig);
      await setDoc(doc(db, "configs", "introConfig"), clean, { merge: true });
      await setDoc(doc(db, "appStore", "introConfig"), clean, { merge: true });
      setConfig(newConfig);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
      } catch (_) {}
      // Sao lưu kép tức thì vào Vault
      recordAutoBackup("update_intro_config", { introConfig: newConfig });
      return true;
    } catch (err) {
      console.error("Failed to save introConfig:", err);
      return false;
    }
  }, []);

  return {
    config,
    loading,
    saveIntroConfig,
  };
}
