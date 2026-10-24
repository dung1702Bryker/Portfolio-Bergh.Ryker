import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getAccessToken, googleSignIn } from "../firebase";
import firebaseConfig from "../../firebase-applet-config.json";

// Types for Google Picker responses
export interface GooglePickerItem {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  iconUrl?: string;
  description?: string;
  parentId?: string;
}

export interface GooglePickerButtonProps {
  onSelect: (url: string, item?: GooglePickerItem) => void;
  onSelectMultiple?: (urls: string[], items?: GooglePickerItem[]) => void;
  mode?: "folders" | "folder" | "images" | "all";
  multiselect?: boolean;
  buttonText?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "liquid-gold" | "subtle-glass" | "pill";
  disabled?: boolean;
  title?: string;
}

// Global script loading state
let isGapiLoaded = false;
let isGsiLoaded = false;
let scriptLoadingPromise: Promise<void> | null = null;

/**
 * Robust script loader for Google API (gapi) and Google Identity Services (GSI)
 */
export function loadGooglePickerScripts(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (isGapiLoaded && (window as any).google?.picker) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve) => {
    let resolvedGapi = false;
    let resolvedGsi = false;

    const checkDone = () => {
      if (resolvedGapi && resolvedGsi) {
        resolve();
      }
    };

    // 1. Load GAPI (https://apis.google.com/js/api.js)
    const loadGapi = () => {
      if ((window as any).gapi) {
        (window as any).gapi.load("picker", {
          callback: () => {
            isGapiLoaded = true;
            resolvedGapi = true;
            checkDone();
          },
          onerror: () => {
            console.warn("Failed to load Google Picker module via gapi.load");
            resolvedGapi = true;
            checkDone();
          },
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if ((window as any).gapi) {
          (window as any).gapi.load("picker", {
            callback: () => {
              isGapiLoaded = true;
              resolvedGapi = true;
              checkDone();
            },
            onerror: () => {
              resolvedGapi = true;
              checkDone();
            },
          });
        } else {
          resolvedGapi = true;
          checkDone();
        }
      };
      script.onerror = () => {
        console.warn("Could not load Google API script (https://apis.google.com/js/api.js)");
        resolvedGapi = true;
        checkDone();
      };
      document.head.appendChild(script);
    };

    // 2. Load GSI (https://accounts.google.com/gsi/client)
    const loadGsi = () => {
      if ((window as any).google?.accounts) {
        isGsiLoaded = true;
        resolvedGsi = true;
        checkDone();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        isGsiLoaded = true;
        resolvedGsi = true;
        checkDone();
      };
      script.onerror = () => {
        console.warn("Could not load Google GSI script (https://accounts.google.com/gsi/client)");
        resolvedGsi = true;
        checkDone();
      };
      document.head.appendChild(script);
    };

    try {
      loadGapi();
      loadGsi();
    } catch (err) {
      console.warn("Error initiating Google script loading:", err);
      resolve(); // Graceful degradation
    }
  });

  return scriptLoadingPromise;
}

export const GooglePickerButton: React.FC<GooglePickerButtonProps> = ({
  onSelect,
  onSelectMultiple,
  mode = "all",
  multiselect = false,
  buttonText,
  className = "",
  size = "md",
  variant = "liquid-gold",
  disabled = false,
  title = "Chọn từ Google Drive",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [, setApiReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadGooglePickerScripts()
      .then(() => {
        if (mounted) setApiReady(true);
      })
      .catch((err) => {
        console.warn("Google Picker scripts initialization fallback:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const openPicker = async () => {
    if (disabled || isLoading) return;
    setIsLoading(true);

    try {
      // 1. Ensure scripts are ready
      await loadGooglePickerScripts();

      const google = (window as any).google;
      if (!google || !google.picker) {
        throw new Error("Google Picker API chưa sẵn sàng trên trình duyệt.");
      }

      // 2. Obtain OAuth access token
      let token = await getAccessToken();

      // If token not present in memory, trigger Google Sign-In with Drive scopes
      if (!token) {
        const signResult = await googleSignIn();
        if (signResult && signResult.accessToken) {
          token = signResult.accessToken;
        }
      }

      if (!token) {
        throw new Error("Không thể xác thực tài khoản Google Drive.");
      }

      // 3. Client ID & App ID (Google Cloud Project Number) derivation
      // Google Cloud Project number is the numeric prefix before the first '-' in Google OAuth Client ID
      const rawClientId =
        (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
        (firebaseConfig as any)?.oAuthClientId ||
        "";

      let appId = "";
      if (rawClientId && typeof rawClientId === "string" && rawClientId.includes("-")) {
        appId = rawClientId.split("-")[0].trim();
      } else if ((firebaseConfig as any)?.messagingSenderId) {
        appId = String((firebaseConfig as any).messagingSenderId).trim();
      }

      // Safe Developer Key handling:
      // When authenticated via OAuth 2.0 (setOAuthToken), Google Picker works completely without a developer key.
      // Passing firebaseConfig.apiKey or an unconfigured key causes "The API developer key is invalid".
      // ONLY set developer key if VITE_GOOGLE_PICKER_API_KEY is explicitly configured for Picker API.
      const explicitPickerApiKey = (import.meta as any).env?.VITE_GOOGLE_PICKER_API_KEY;

      // Calculate iframe-safe origin
      const defaultOrigin = `${window.location.protocol}//${window.location.host}`;
      const pickerOrigin =
        window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : defaultOrigin;

      // 4. Configure Picker Views
      const pickerBuilder = new google.picker.PickerBuilder();
      const isFolderMode = mode === "folders" || mode === "folder";

      // Safe mode for GRID
      const gridMode =
        google.picker?.DocsViewMode?.GRID !== undefined
          ? google.picker.DocsViewMode.GRID
          : "grid";

      if (isFolderMode) {
        // Yêu cầu 1: Bắt đầu từ thư mục gốc 'Drive của tôi' (setParent('root'))
        // Chỉ hiển thị các thư mục cấp 1 ở ngoài cùng của 'Drive của tôi' (.setOwnedByMe(true)),
        // khi bấm đúp vào mới mở ra các thư mục con (BTEC, MEL, Edited File) bên trong giống hệt Google Drive.
        const myDriveView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setParent("root")
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setOwnedByMe(true)
          .setMode(gridMode)
          .setMimeTypes(
            "application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/heic,image/jpg,image/avif"
          )
          .setLabel("Drive của tôi");

        // Yêu cầu 2: Tab thứ 2 cho 'Được chia sẻ' (Shared with me)
        const sharedWithMeView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setOwnedByMe(false)
          .setMode(gridMode)
          .setMimeTypes(
            "application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/heic,image/jpg,image/avif"
          )
          .setLabel("Được chia sẻ");

        pickerBuilder.addView(myDriveView);
        pickerBuilder.addView(sharedWithMeView);
        pickerBuilder.setTitle("Chọn Thư Mục Album từ Google Drive");
      } else if (mode === "images") {
        // Chế độ chọn ảnh: Bắt đầu từ 'Drive của tôi' (cấp 1)
        const myDriveImagesView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setParent("root")
          .setIncludeFolders(true)
          .setOwnedByMe(true)
          .setMode(gridMode)
          .setMimeTypes(
            "application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/heic,image/jpg,image/avif,image/gif"
          )
          .setLabel("Drive của tôi");

        // Tab Được chia sẻ cho ảnh
        const sharedImagesView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setOwnedByMe(false)
          .setMode(gridMode)
          .setMimeTypes(
            "application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/heic,image/jpg,image/avif,image/gif"
          )
          .setLabel("Được chia sẻ");

        // Tab xem lưới toàn bộ ảnh
        const allImagesGrid = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
          .setMode(gridMode)
          .setLabel("Tất cả ảnh");

        pickerBuilder.addView(myDriveImagesView);
        pickerBuilder.addView(sharedImagesView);
        pickerBuilder.addView(allImagesGrid);
        pickerBuilder.setTitle(
          multiselect ? "Quét Chọn Nhiều Ảnh Từ Google Drive" : "Chọn Ảnh Bìa Từ Google Drive"
        );
      } else {
        // "all": Bắt đầu từ 'Drive của tôi' (cấp 1) & Được chia sẻ
        const myDriveAllView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setParent("root")
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setOwnedByMe(true)
          .setMode(gridMode)
          .setMimeTypes(
            "application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/heic,image/jpg,image/avif,image/gif"
          )
          .setLabel("Drive của tôi");

        const sharedAllView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setOwnedByMe(false)
          .setMode(gridMode)
          .setMimeTypes(
            "application/vnd.google-apps.folder,image/jpeg,image/png,image/webp,image/heic,image/jpg,image/avif,image/gif"
          )
          .setLabel("Được chia sẻ");

        pickerBuilder.addView(myDriveAllView);
        pickerBuilder.addView(sharedAllView);
        pickerBuilder.setTitle("Chọn Thư Mục Hoặc Tệp Từ Google Drive");
      }

      // Yêu cầu 3: MULTISELECT_ENABLED khi chọn nhiều ảnh
      if (multiselect && google.picker.Feature?.MULTISELECT_ENABLED) {
        pickerBuilder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      }

      // Pass numerical Project Number (App ID) so Picker identifies the GCP project
      if (appId) {
        pickerBuilder.setAppId(appId);
      }

      // Safe Developer Key: Only if explicitly provided for Google Picker API and not a placeholder
      if (
        explicitPickerApiKey &&
        typeof explicitPickerApiKey === "string" &&
        explicitPickerApiKey.trim().length > 0 &&
        !explicitPickerApiKey.includes("YOUR_")
      ) {
        pickerBuilder.setDeveloperKey(explicitPickerApiKey.trim());
      }

      // OAuth 2.0 Token and Origin authentication (Primary auth mechanism for Google Picker)
      pickerBuilder.setOAuthToken(token);
      pickerBuilder.setOrigin(pickerOrigin);

      // Yêu cầu 2: Smart Parent Folder Fallback Helper
      const resolveParentFolder = async (
        fileId: string,
        docItem?: any
      ): Promise<{ parentId: string; folderUrl: string; folderName?: string } | null> => {
        // 1. Kiểm tra trực tiếp thuộc tính parentId từ đối tượng Picker
        let parentId =
          docItem?.[google.picker.Document?.PARENT_ID] ||
          docItem?.parentId ||
          (Array.isArray(docItem?.parents) && docItem.parents[0]) ||
          null;

        // 2. Nếu Picker không đính kèm parentId, tra cứu Google Drive API v3
        if (!parentId && fileId && token) {
          try {
            const resp = await fetch(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,parents`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (resp.ok) {
              const driveData = await resp.json();
              if (driveData.parents && driveData.parents.length > 0) {
                parentId = driveData.parents[0];
              }
            }
          } catch (err) {
            console.warn("Could not query parent folder via Drive v3 API:", err);
          }
        }

        if (parentId) {
          let folderName: string | undefined;
          if (token) {
            try {
              const fResp = await fetch(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parentId)}?fields=id,name`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              if (fResp.ok) {
                const fData = await fResp.json();
                if (fData.name) folderName = fData.name;
              }
            } catch {
              // ignore
            }
          }
          return {
            parentId,
            folderUrl: `https://drive.google.com/drive/folders/${parentId}`,
            folderName,
          };
        }
        return null;
      };

      // Picker Selection Callback
      pickerBuilder.setCallback(async (data: any) => {
        try {
          const action = data[google.picker.Response.ACTION] || data.action;

          if (
            action === google.picker.Action.PICKED ||
            action === google.picker.Action.SUCCESS ||
            action === "picked"
          ) {
            const docs = data[google.picker.Response.DOCUMENTS] || data.docs || [];
            if (!docs || docs.length === 0) return;

            // Yêu cầu 2: Ở chế độ chọn Album (mode === "folder" | "folders")
            if (isFolderMode) {
              const docItem = docs[0];
              const fileId = docItem[google.picker.Document.ID] || docItem.id;
              const mimeType =
                docItem[google.picker.Document.MIME_TYPE] || docItem.mimeType || "";
              const docType = docItem.type || "";

              // Nếu người dùng chọn đúng thư mục
              if (
                mimeType === "application/vnd.google-apps.folder" ||
                docType === "folder"
              ) {
                const folderUrl = `https://drive.google.com/drive/folders/${fileId}`;
                onSelect(folderUrl, {
                  id: fileId,
                  name: docItem[google.picker.Document.NAME] || docItem.name || "",
                  mimeType: "application/vnd.google-apps.folder",
                  url: folderUrl,
                  iconUrl: docItem[google.picker.Document.ICON_URL] || docItem.iconUrl,
                });
                return;
              }

              // Nếu người dùng bấm đúp vào thư mục rồi chọn 1 bức ảnh bên trong:
              // Smart Parent Folder Fallback tự động lấy link thư mục cha
              const parentResult = await resolveParentFolder(fileId, docItem);
              if (parentResult) {
                onSelect(parentResult.folderUrl, {
                  id: parentResult.parentId,
                  name:
                    parentResult.folderName ||
                    docItem[google.picker.Document.NAME] ||
                    "Thư mục Album Drive",
                  mimeType: "application/vnd.google-apps.folder",
                  url: parentResult.folderUrl,
                  iconUrl: docItem[google.picker.Document.ICON_URL] || docItem.iconUrl,
                });
                return;
              }

              // Fallback link ảnh nếu không tìm thấy thư mục cha
              const fileUrl =
                docItem[google.picker.Document.URL] ||
                `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
              onSelect(fileUrl, {
                id: fileId,
                name: docItem[google.picker.Document.NAME] || docItem.name || "",
                mimeType,
                url: fileUrl,
              });
              return;
            }

            // Xử lý chọn ảnh (đơn hoặc đa chọn - multiselect)
            const selectedItems: GooglePickerItem[] = docs.map((docItem: any) => {
              const fileId = docItem[google.picker.Document.ID] || docItem.id;
              const mimeType =
                docItem[google.picker.Document.MIME_TYPE] || docItem.mimeType || "";
              let itemUrl = docItem[google.picker.Document.URL] || docItem.url || "";

              if (
                mimeType === "application/vnd.google-apps.folder" ||
                docItem.type === "folder"
              ) {
                if (!itemUrl || !itemUrl.includes("/folders/")) {
                  itemUrl = `https://drive.google.com/drive/folders/${fileId}`;
                }
              } else if (fileId && (!itemUrl || !itemUrl.includes("drive.google.com"))) {
                itemUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
              }

              return {
                id: fileId,
                name: docItem[google.picker.Document.NAME] || docItem.name || "",
                mimeType,
                url: itemUrl,
                iconUrl: docItem[google.picker.Document.ICON_URL] || docItem.iconUrl,
                description:
                  docItem[google.picker.Document.DESCRIPTION] || docItem.description,
                parentId:
                  docItem[google.picker.Document?.PARENT_ID] || docItem.parentId,
              };
            });

            const urls = selectedItems.map((item) => item.url);

            if (onSelectMultiple && selectedItems.length > 0) {
              onSelectMultiple(urls, selectedItems);
            }

            if (onSelect && selectedItems.length > 0) {
              if (selectedItems.length === 1) {
                onSelect(selectedItems[0].url, selectedItems[0]);
              } else if (!onSelectMultiple) {
                selectedItems.forEach((item) => {
                  onSelect(item.url, item);
                });
              }
            }
          }
        } catch (callbackErr) {
          console.error("Error processing Google Picker selection:", callbackErr);
        }
      });

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    } catch (err: any) {
      if (
        err?.code !== "auth/popup-closed-by-user" &&
        err?.code !== "auth/cancelled-popup-request"
      ) {
        console.error("Google Picker invocation error:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Default labels based on mode
  const resolvedButtonText =
    buttonText ||
    (mode === "folders"
      ? "Chọn thư mục Drive"
      : mode === "images"
      ? "Chọn ảnh từ Drive"
      : "Chọn từ Google Drive");

  // Liquid glass & champagne gold styling
  const sizeClasses = {
    sm: "px-3 py-1.5 text-[11px] gap-1.5 min-h-[34px]",
    md: "px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs gap-2 min-h-[42px]",
    lg: "px-5 py-3 text-sm gap-2.5 min-h-[48px]",
  }[size];

  const variantClasses = {
    "liquid-gold":
      "bg-gradient-to-r from-[#B5945B]/20 via-[#B5945B]/10 to-transparent hover:from-[#B5945B]/30 hover:via-[#B5945B]/20 active:scale-[0.98] text-[#E5C17C] hover:text-white border border-[#B5945B]/40 hover:border-[#B5945B] shadow-[0_0_15px_rgba(181,148,91,0.15)] backdrop-blur-xl",
    "subtle-glass":
      "bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] text-zinc-300 hover:text-white border border-white/12 hover:border-[#B5945B]/50 shadow-inner backdrop-blur-md",
    pill:
      "bg-zinc-900/80 hover:bg-[#B5945B]/20 active:scale-[0.98] text-[#E5C17C] border border-[#B5945B]/30 rounded-full",
  }[variant];

  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={disabled || isLoading}
      title={title}
      className={`inline-flex items-center justify-center font-bold tracking-tight rounded-xl transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${sizeClasses} ${variantClasses} ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B5945B]" />
      ) : (
        /* Official Google Drive triangle icon with Champagne Gold / Drive tones */
        <svg
          className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
          viewBox="0 0 87.3 78"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3H6.6c0 1.5.4 3 1.2 4.35z"
            fill="#0066da"
          />
          <path
            d="m43.65 25-12.3-21.3c-1.3.8-2.4 1.9-3.2 3.3L3.85 50.1c-.8 1.35-1.2 2.85-1.2 4.35h24.7z"
            fill="#00ac47"
          />
          <path
            d="m73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l1.6-2.75 7.6-13.15c.8-1.35 1.2-2.85 1.2-4.35H62.45l5.85 10.15z"
            fill="#ea4335"
          />
          <path
            d="m43.65 25 12.3-21.3c-1.3-.8-2.8-1.2-4.3-1.2H35.65c-1.5 0-3 .4-4.3 1.2z"
            fill="#00832d"
          />
          <path
            d="m59.8 55.5h-32.3l-12.3 21.3c1.3.8 2.8 1.2 4.3 1.2h48.3c1.5 0 3-.4 4.3-1.2z"
            fill="#2684fc"
          />
          <path
            d="m73.4 26.5-12.45-21.5c-1.3-.8-2.8-1.2-4.3-1.2l12.3 21.3 14.7 25.45c.8-1.35 1.2-2.85 1.2-4.35 0-1.5-.4-3-1.2-4.35z"
            fill="#ffba00"
          />
        </svg>
      )}
      <span className="truncate">{resolvedButtonText}</span>
    </button>
  );
};
