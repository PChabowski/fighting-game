import { useCallback, useEffect, useState } from 'react';

export interface MobileEnvMetrics {
  coarsePointer: boolean;
  maxTouchPoints: number;
  width: number;
  height: number;
}

export function detectMobileEnvironment(metrics: MobileEnvMetrics): boolean {
  return Boolean(
    metrics.coarsePointer ||
      metrics.maxTouchPoints > 0 ||
      metrics.width < 960 ||
      metrics.height < 560
  );
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export async function enterLandscapeFullscreen(target?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const el = (target ?? document.documentElement) as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  let entered = Boolean(getFullscreenElement());
  if (!entered) {
    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        entered = true;
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        await el.webkitRequestFullscreen();
        entered = true;
      }
    } catch {
      entered = Boolean(getFullscreenElement());
    }
  }

  try {
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (mode: string) => Promise<void> })
      | undefined;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape').catch(() => {});
    }
  } catch {
    // Ignore unsupported orientation lock in desktop browsers or sandboxed frames
  }

  return entered;
}

export async function exitLandscapeFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    const orientation = screen.orientation as
      | (ScreenOrientation & { unlock?: () => void })
      | undefined;
    orientation?.unlock?.();
  } catch {
    // ignore
  }

  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // ignore
  }
}

export function useMobileFullscreen() {
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return detectMobileEnvironment({
      coarsePointer: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      width: window.innerWidth,
      height: window.innerHeight,
    });
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));

  useEffect(() => {
    const update = () => {
      setIsMobileDevice(
        detectMobileEnvironment({
          coarsePointer: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
          maxTouchPoints: navigator.maxTouchPoints ?? 0,
          width: window.innerWidth,
          height: window.innerHeight,
        })
      );
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, []);

  const toggleFullscreen = useCallback(async (target?: HTMLElement | null) => {
    if (getFullscreenElement()) {
      await exitLandscapeFullscreen();
      setIsFullscreen(Boolean(getFullscreenElement()));
    } else {
      const ok = await enterLandscapeFullscreen(target);
      setIsFullscreen(ok || Boolean(getFullscreenElement()));
    }
  }, []);

  return {
    isMobileDevice,
    isFullscreen,
    toggleFullscreen,
  };
}
