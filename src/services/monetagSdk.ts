/**
 * Official Rewarded Ad SDK Service
 * Handles ad opening via Telegram WebApp / Monetag In-App SDK / Browser tabs.
 * Clean, single-execution to prevent mobile Chrome "Pop-up blocked" warnings.
 */

declare global {
  interface Window {
    show_88?: (zoneId?: string) => Promise<void>;
    show_tag?: (zoneId?: string) => Promise<void>;
    show_12044377?: (zoneId?: string) => Promise<void>;
    Telegram?: any;
  }
}

export const DEFAULT_ZONE_ID = '12044377';
export const DEFAULT_APP_ID = '3534792';
export const DEFAULT_DIRECT_LINK = 'https://alwingulla.com/88/12044377';

/**
 * Ensures Monetag's official Telegram Mini App tag script is mounted.
 */
export function ensureMonetagSdkLoaded(zoneId: string = DEFAULT_ZONE_ID): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    const cleanZone = String(zoneId || DEFAULT_ZONE_ID).trim();
    const dynamicFn = (window as any)[`show_${cleanZone}`] || (window as any).show_12044377 || window.show_88 || window.show_tag;
    if (typeof dynamicFn === 'function') {
      return resolve(true);
    }

    const existingScript = document.querySelector(`script[src*="alwingulla.com"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(true), 1200);
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = 'https://alwingulla.com/88/tag.min.js';
      script.setAttribute('data-zone', cleanZone);
      script.setAttribute('data-cfasync', 'false');
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        resolve(false);
      };
      document.head.appendChild(script);
      setTimeout(() => resolve(true), 2000);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Returns the effective ad URL for the given zone or direct link
 */
export function getAdTargetUrl(directLink?: string, zoneId: string = DEFAULT_ZONE_ID): string {
  if (directLink && directLink.trim().length > 0) return directLink.trim();
  const clean = String(zoneId || DEFAULT_ZONE_ID).trim();
  return `https://alwingulla.com/88/${clean}`;
}

/**
 * Opens the ad directly via Telegram WebApp or browser.
 */
export function openAdDirectly(directLink?: string, zoneId: string = DEFAULT_ZONE_ID): boolean {
  const cleanId = String(zoneId || DEFAULT_ZONE_ID).trim();
  const targetUrl = getAdTargetUrl(directLink, cleanId);

  // If Monetag In-App SDK function is available, trigger native in-app rewarded ad
  if (typeof window !== 'undefined') {
    const showFn =
      (window as any)[`show_${cleanId}`] ||
      (window as any).show_12044377 ||
      (window as any).show_88 ||
      (window as any).show_tag;

    if (typeof showFn === 'function') {
      try {
        showFn(cleanId);
        return true;
      } catch (e) {
        console.warn('[Monetag In-App error]:', e);
      }
    }

    // If Telegram WebApp is available, open link
    if ((window as any).Telegram?.WebApp?.openLink && targetUrl) {
      try {
        (window as any).Telegram.WebApp.openLink(targetUrl);
        return true;
      } catch (e) {
        console.warn('[Telegram openLink error]:', e);
      }
    }
  }

  return true;
}
