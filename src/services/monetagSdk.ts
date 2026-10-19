/**
 * Official Rewarded Ad SDK Service
 * Handles ad opening via Telegram WebApp / Monetag In-App SDK / Browser tabs.
 * Clean, single-execution to prevent mobile Chrome "Pop-up blocked" warnings.
 */

declare global {
  interface Window {
    show_88?: (zoneId?: string) => Promise<void>;
    show_tag?: (zoneId?: string) => Promise<void>;
    Telegram?: any;
  }
}

export const DEFAULT_ZONE_ID = '12044377';
export const DEFAULT_APP_ID = '3534792';
export const DEFAULT_DIRECT_LINK = '';

/**
 * Ensures Monetag's official Telegram Mini App tag script is mounted.
 */
export function ensureMonetagSdkLoaded(zoneId: string = DEFAULT_ZONE_ID): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    if (typeof window.show_88 === 'function' || typeof window.show_tag === 'function') {
      return resolve(true);
    }

    const existingScript = document.querySelector(`script[src*="alwingulla.com"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(true), 1500);
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = 'https://alwingulla.com/88/tag.min.js';
      script.setAttribute('data-zone', zoneId);
      script.setAttribute('data-cfasync', 'false');
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        resolve(false);
      };
      document.head.appendChild(script);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Returns the effective ad URL for the given zone or direct link
 */
export function getAdTargetUrl(directLink?: string, zoneId: string = DEFAULT_ZONE_ID): string {
  return directLink || '';
}

/**
 * Opens the ad directly via Telegram WebApp or browser without triggering pop-up blocker.
 * Must only be called ONCE per user gesture.
 */
export function openAdDirectly(_directLink?: string, zoneId: string = DEFAULT_ZONE_ID): boolean {
  // If Monetag In-App SDK is available, trigger native in-app rewarded ad
  if (typeof window !== 'undefined') {
    const showFn = (window as any).show_88 || (window as any).show_tag;
    if (typeof showFn === 'function') {
      try {
        showFn(zoneId);
        return true;
      } catch (e) {
        console.warn('[Monetag In-App error]:', e);
      }
    }
  }
  // Keep 100% inside Telegram Mini App without redirecting away to external sites
  return true;
}
