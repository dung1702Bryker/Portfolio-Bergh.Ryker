import React, { useEffect, useRef, useState, useMemo } from "react";
import { resolveImage } from "../utils/imageMapper";
import {
  getOptimizedImageUrl,
  markImageLoadedInCache,
  isImageLoadedInCache,
  globalLoadedImages,
} from "../utils/imageOptimizer";
import { SlideData } from "../types";

export interface GlobalImagePreloaderProps {
  slides?: SlideData[];
  /**
   * Distance ahead in pixels to begin preloading section assets (default: 800px)
   */
  preloadDistance?: number;
  /**
   * Maximum concurrent background image requests to avoid blocking critical network traffic (default: 2)
   */
  concurrency?: number;
  /**
   * High-resolution target width (default: 1600 on desktop, 1080 on mobile)
   */
  targetWidth?: number;
  /**
   * Quality percentage for background WebP optimization (default: 88)
   */
  quality?: number;
  /**
   * In development/debug mode, logs silent background preload events to console
   */
  debug?: boolean;
}

interface PreloadItem {
  id: string;
  rawSrc: string;
  resolvedSrc: string;
  sectionId?: string;
  priority: number; // lower number = higher priority
}

/**
 * GlobalImagePreloader
 * 
 * Silently fetches high-resolution gallery and portfolio images in the background
 * as the user scrolls down the page, before the user even enters those sections.
 * 
 * Features:
 * 1. IntersectionObserver / Scroll listener with look-ahead window (`rootMargin: "800px 0px"`).
 * 2. Idle-time processing via `window.requestIdleCallback` (with `setTimeout` fallback).
 * 3. Network-aware throttling: pauses or skips background loading if the client has Data Saver enabled
 *    or is on 2G/slow-2g connections to conserve bandwidth.
 * 4. Silent off-screen background execution with async decoding (`img.decode()`), warming up the
 *    browser's disk and memory cache and updating `globalLoadedImages`.
 * 5. Completely invisible (silent loading state) with 0 UI disruption or layout shifts.
 */
export const GlobalImagePreloader: React.FC<GlobalImagePreloaderProps> = React.memo(({
  slides = [],
  preloadDistance = 800,
  concurrency = 2,
  targetWidth,
  quality = 88,
  debug = false,
}) => {
  // Track preloaded raw and final URLs in a component-level ref to prevent duplicate work
  const preloadedRef = useRef<Set<string>>(new Set());
  const activeDownloadsRef = useRef<number>(0);
  const queueRef = useRef<PreloadItem[]>([]);
  const isProcessingRef = useRef<boolean>(false);

  // Network condition check
  const isNetworkConstrained = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const conn = (navigator as any).connection;
    if (!conn) return false;
    return !!(
      conn.saveData ||
      conn.effectiveType === "slow-2g" ||
      conn.effectiveType === "2g"
    );
  }, []);

  // Compute responsive target width for high-resolution images
  const effectiveTargetW = useMemo(() => {
    if (targetWidth) return targetWidth;
    if (typeof window === "undefined") return 1600;
    return window.innerWidth <= 640 ? 1080 : 1600;
  }, [targetWidth]);

  /**
   * Collect candidate images from all slide data structures
   */
  const slideImageMap = useMemo(() => {
    const map = new Map<string, PreloadItem[]>();

    slides.forEach((slide, slideIdx) => {
      const sectionId = slide.id || `slide-${slideIdx}`;
      const items: PreloadItem[] = [];

      // Collect images array inside the slide
      if (Array.isArray(slide.images)) {
        slide.images.forEach((imgObj, imgIdx) => {
          if (!imgObj?.src) return;
          const resolved = resolveImage(imgObj.src);
          if (resolved) {
            items.push({
              id: `${sectionId}-${imgIdx}`,
              rawSrc: imgObj.src,
              resolvedSrc: resolved,
              sectionId,
              priority: slideIdx * 10 + imgIdx,
            });
          }
        });
      }

      map.set(sectionId, items);
    });

    return map;
  }, [slides]);

  /**
   * Executes a single image preload silently in the background
   */
  const preloadSingleImage = (item: PreloadItem): Promise<boolean> => {
    return new Promise((resolve) => {
      const { rawSrc, resolvedSrc } = item;

      // Check if already in cache
      if (
        isImageLoadedInCache(resolvedSrc) ||
        preloadedRef.current.has(resolvedSrc)
      ) {
        resolve(true);
        return;
      }

      // Generate optimized high-res URL
      const highResUrl = getOptimizedImageUrl(resolvedSrc, {
        width: effectiveTargetW,
        format: "webp",
        quality,
      }) || resolvedSrc;

      if (globalLoadedImages.has(highResUrl) || preloadedRef.current.has(highResUrl)) {
        preloadedRef.current.add(resolvedSrc);
        resolve(true);
        return;
      }

      preloadedRef.current.add(resolvedSrc);
      preloadedRef.current.add(highResUrl);

      // Create off-screen image element for background fetching
      const img = new Image();
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";

      const finalize = (success: boolean) => {
        if (success) {
          markImageLoadedInCache(rawSrc);
          markImageLoadedInCache(resolvedSrc);
          markImageLoadedInCache(highResUrl);
          if (debug) {
            console.debug(`[GlobalImagePreloader] Silently cached: ${resolvedSrc.slice(0, 60)}...`);
          }
        }
        resolve(success);
      };

      img.onload = () => {
        if (img.decode) {
          img.decode().catch(() => {}).finally(() => finalize(true));
        } else {
          finalize(true);
        }
      };

      img.onerror = () => {
        finalize(false);
      };

      img.src = highResUrl;

      // Handle immediate cache hit
      if (img.complete && img.naturalWidth > 0) {
        finalize(true);
      }
    });
  };

  /**
   * Process background queue respecting concurrency and idle cycles
   */
  const processQueue = () => {
    if (isNetworkConstrained) return;
    if (activeDownloadsRef.current >= concurrency || queueRef.current.length === 0) {
      return;
    }

    const item = queueRef.current.shift();
    if (!item) return;

    activeDownloadsRef.current += 1;

    // Use requestIdleCallback if supported so preloading never interrupts main UI frames
    const runWork = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 50));

    runWork(() => {
      preloadSingleImage(item).finally(() => {
        activeDownloadsRef.current = Math.max(0, activeDownloadsRef.current - 1);
        processQueue();
      });
    });

    // Launch another if concurrency capacity remains
    if (activeDownloadsRef.current < concurrency && queueRef.current.length > 0) {
      processQueue();
    }
  };

  /**
   * Enqueue items with priority ordering
   */
  const enqueueItems = (items: PreloadItem[]) => {
    if (isNetworkConstrained || !items || items.length === 0) return;

    const newItems = items.filter(
      (item) =>
        !preloadedRef.current.has(item.resolvedSrc) &&
        !isImageLoadedInCache(item.resolvedSrc) &&
        !queueRef.current.some((q) => q.resolvedSrc === item.resolvedSrc)
    );

    if (newItems.length === 0) return;

    queueRef.current.push(...newItems);
    // Sort so earlier sections or high-priority items preload first
    queueRef.current.sort((a, b) => a.priority - b.priority);

    processQueue();
  };

  /**
   * 1. Preload first visible slide (S1, S4) immediately upon page mount
   */
  useEffect(() => {
    if (isNetworkConstrained) return;

    // Give the page 200ms to finish initial render before initiating background loads
    const initialTimer = setTimeout(() => {
      const initialItems: PreloadItem[] = [];
      const s1 = slideImageMap.get("S1") || [];
      const s4 = slideImageMap.get("S4") || [];
      initialItems.push(...s1, ...s4);

      if (initialItems.length > 0) {
        enqueueItems(initialItems);
      }
    }, 250);

    return () => clearTimeout(initialTimer);
  }, [slideImageMap, isNetworkConstrained]);

  /**
   * 2. IntersectionObserver for dynamic scroll-based look-ahead preloading
   */
  useEffect(() => {
    if (typeof window === "undefined" || isNetworkConstrained) return;

    // Setup look-ahead margin (e.g., 800px ahead of the viewport)
    const rootMargin = `${preloadDistance}px 0px ${preloadDistance}px 0px`;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionEl = entry.target as HTMLElement;
            const sectionId = sectionEl.id;

            if (sectionId) {
              const items = slideImageMap.get(sectionId);
              if (items && items.length > 0) {
                enqueueItems(items);
              }

              // Also discover any data-preload-src or child img elements in this section
              const childImages = sectionEl.querySelectorAll<HTMLImageElement>(
                "img[src], img[data-src], [data-preload-src]"
              );

              const extraItems: PreloadItem[] = [];
              childImages.forEach((img, idx) => {
                const src = img.getAttribute("data-preload-src") ||
                            img.getAttribute("data-src") ||
                            img.src;
                if (src && !src.startsWith("data:") && !src.startsWith("blob:")) {
                  const resolved = resolveImage(src);
                  if (resolved) {
                    extraItems.push({
                      id: `dom-${sectionId}-${idx}`,
                      rawSrc: src,
                      resolvedSrc: resolved,
                      sectionId,
                      priority: 50 + idx,
                    });
                  }
                }
              });

              if (extraItems.length > 0) {
                enqueueItems(extraItems);
              }
            }
          }
        });
      },
      {
        root: null, // Viewport
        rootMargin,
        threshold: 0.01, // Trigger as soon as the look-ahead window touches the section
      }
    );

    // Observe all slide sections
    const sections = document.querySelectorAll<HTMLElement>("section[id], .slide-section");
    sections.forEach((sec) => observer.observe(sec));

    return () => {
      observer.disconnect();
    };
  }, [slideImageMap, preloadDistance, isNetworkConstrained]);

  /**
   * 3. Fallback smooth scroll position listener for continuous velocity-based discovery
   */
  useEffect(() => {
    if (typeof window === "undefined" || isNetworkConstrained) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset;
          const viewportBottom = scrollY + window.innerHeight + preloadDistance;

          // Find sections whose top position is within viewportBottom
          const sections = document.querySelectorAll<HTMLElement>("section[id]");
          sections.forEach((sec) => {
            const rect = sec.getBoundingClientRect();
            const topOffset = rect.top + scrollY;

            if (topOffset <= viewportBottom && topOffset + rect.height >= scrollY - 200) {
              const items = slideImageMap.get(sec.id);
              if (items && items.length > 0) {
                enqueueItems(items);
              }
            }
          });

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [slideImageMap, preloadDistance, isNetworkConstrained]);

  // Completely silent component: renders null into the React DOM tree
  return null;
});

GlobalImagePreloader.displayName = "GlobalImagePreloader";
