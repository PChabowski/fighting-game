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

export function isMobile() {
  return isAndroid() || isIOS();
}

/**
 * Mobile controls rendering has been transitioned to React.
 * This util module now only serves hardware detection logic.
 */
