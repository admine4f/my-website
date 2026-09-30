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

export const DEFAULT_ZONE_ID = '11442658';
export const DEFAULT_DIRECT_LINK = 'https://omg10.com/4/11442658';

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
  return directLink || `https://omg10.com/4/${zoneId}`;
}

/**
 * Opens the ad directly via Telegram WebApp or browser without triggering pop-up blocker.
 * Must only be called ONCE per user gesture.
 */
export function openAdDirectly(directLink?: string, zoneId: string = DEFAULT_ZONE_ID): boolean {
  const targetUrl = getAdTargetUrl(directLink, zoneId);

  // 1. If running inside Telegram Mini App, use Telegram WebApp API
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openLink) {
    try {
      window.Telegram.WebApp.openLink(targetUrl);
      return true;
    } catch (err) {
      console.warn('[Ad SDK] Telegram WebApp openLink failed:', err);
    }
  }

  // 2. In browser environment, open single new tab
  if (typeof window !== 'undefined') {
    try {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (win) return true;
    } catch (err) {
      console.warn('[Ad SDK] window.open error:', err);
    }
  }

  return false;
}
