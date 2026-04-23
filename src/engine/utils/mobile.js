// Consolidated mobile detection module
export function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  // Account for iPhones, iPads, and iOS 13+ iPads pretending to be Macs but having touch points
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function hasCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function isLikelyMobileViewport() {
  if (typeof window === 'undefined') return false;
  return Math.min(window.innerWidth, window.innerHeight) <= 1024;
}

export function isMobile() {
  if (typeof navigator === 'undefined') return false;

  const uaDataMobile = typeof navigator.userAgentData !== 'undefined' && navigator.userAgentData?.mobile === true;
  if (uaDataMobile || isAndroid() || isIOS()) return true;

  const touchPoints = Number(navigator.maxTouchPoints || 0);
  return touchPoints > 0 && hasCoarsePointer() && isLikelyMobileViewport();
}

/**
 * Mobile controls rendering has been transitioned to React.
 * This util module now only serves hardware detection logic.
 */
