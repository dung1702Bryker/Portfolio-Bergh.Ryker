import { useState, useEffect, useRef, useCallback } from "react";

export interface DeviceTiltState {
  rotateX: number; // Front/back tilt (-12 to 12 deg)
  rotateY: number; // Left/right tilt (-12 to 12 deg)
  glareX: number; // 0 to 100%
  glareY: number; // 0 to 100%
  glareOpacity: number; // 0 to 0.35
  isSupported: boolean;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
}

/**
 * High-performance gyroscope & accelerometer tilt hook for mobile devices.
 * Accurately tracks phone tilting/shaking in hand and transforms it into
 * buttery-smooth 3D parallax tilt & dynamic specular glare reflections.
 */
export function useDeviceTilt(maxTiltDeg = 8.5): DeviceTiltState {
  const [tilt, setTilt] = useState<{
    rotateX: number;
    rotateY: number;
    glareX: number;
    glareY: number;
    glareOpacity: number;
  }>({
    rotateX: 0,
    rotateY: 0,
    glareX: 50,
    glareY: 50,
    glareOpacity: 0,
  });

  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Target values to smoothly interpolate towards
  const targetRef = useRef({ rx: 0, ry: 0, gx: 50, gy: 50, active: false });
  const currentRef = useRef({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const animFrameRef = useRef<number | null>(null);

  // Natural holding angle calibration (typically 45-50 degrees pitch)
  const baseBetaRef = useRef<number | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    // iOS 13+ permission flow
    const DeviceOrientation = (window as any).DeviceOrientationEvent;
    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === "function") {
      try {
        const response = await DeviceOrientation.requestPermission();
        if (response === "granted") {
          setPermissionGranted(true);
          return true;
        }
        return false;
      } catch (e) {
        console.warn("[useDeviceTilt] Permission request error:", e);
        return false;
      }
    }

    // Android & standard browsers don't require explicit permission
    setPermissionGranted(true);
    return true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if device has coarse pointer (phone / tablet)
    const isTouchDevice =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window;

    if (!isTouchDevice || !("DeviceOrientationEvent" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;

      // First reading: calibrate natural resting pitch
      if (baseBetaRef.current === null) {
        baseBetaRef.current = Math.min(Math.max(e.beta, 25), 65);
      }

      const gamma = e.gamma; // Roll: Left (-90) to Right (+90)
      const beta = e.beta; // Pitch: Flat (0) to Vertical (90)

      // Calculate tilt relative to resting position
      const deltaGamma = Math.min(Math.max(gamma, -40), 40);
      const deltaBeta = Math.min(Math.max(beta - (baseBetaRef.current || 45), -35), 35);

      // Map to 3D rotation angles
      const rotY = (deltaGamma / 40) * maxTiltDeg;
      const rotX = (deltaBeta / 35) * -maxTiltDeg;

      // Map to specular glare position
      const gx = 50 + (rotY / maxTiltDeg) * 40;
      const gy = 50 - (rotX / maxTiltDeg) * 40;

      targetRef.current = {
        rx: rotX,
        ry: rotY,
        gx: Math.min(Math.max(gx, 5), 95),
        gy: Math.min(Math.max(gy, 5), 95),
        active: true,
      };
    };

    // Smooth animation loop using 60fps/120fps lerp
    const updateMotion = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;

      if (tgt.active) {
        // Smooth lerp (0.12 factor prevents jerky movements while staying responsive)
        cur.rx += (tgt.rx - cur.rx) * 0.12;
        cur.ry += (tgt.ry - cur.ry) * 0.12;
        cur.gx += (tgt.gx - cur.gx) * 0.12;
        cur.gy += (tgt.gy - cur.gy) * 0.12;

        setTilt({
          rotateX: Math.round(cur.rx * 100) / 100,
          rotateY: Math.round(cur.ry * 100) / 100,
          glareX: Math.round(cur.gx * 10) / 10,
          glareY: Math.round(cur.gy * 10) / 10,
          glareOpacity: 0.28,
        });
      }

      animFrameRef.current = requestAnimationFrame(updateMotion);
    };

    // Auto-listen if permission is already available
    const DeviceOrientation = (window as any).DeviceOrientationEvent;
    const needsExplicitPermission =
      DeviceOrientation && typeof DeviceOrientation.requestPermission === "function";

    if (!needsExplicitPermission) {
      setPermissionGranted(true);
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
      animFrameRef.current = requestAnimationFrame(updateMotion);
    } else if (permissionGranted) {
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
      animFrameRef.current = requestAnimationFrame(updateMotion);
    }

    // Touch fallback: also listen for first touch to trigger permission request on iOS
    const handleFirstTouch = () => {
      if (needsExplicitPermission && !permissionGranted) {
        requestPermission().then((granted) => {
          if (granted) {
            window.addEventListener("deviceorientation", handleOrientation, { passive: true });
            if (!animFrameRef.current) {
              animFrameRef.current = requestAnimationFrame(updateMotion);
            }
          }
        });
      }
      window.removeEventListener("touchstart", handleFirstTouch);
    };
    window.addEventListener("touchstart", handleFirstTouch, { passive: true, once: true });

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("touchstart", handleFirstTouch);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [maxTiltDeg, permissionGranted, requestPermission]);

  return {
    ...tilt,
    isSupported,
    permissionGranted,
    requestPermission,
  };
}
