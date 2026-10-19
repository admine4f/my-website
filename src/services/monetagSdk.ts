/**
 * Official Rewarded Ad SDK Service
 * Handles Monetag dynamically created script and window.showMonetagAd()
 * Clean, single-execution to prevent mobile Chrome "Pop-up blocked" warnings.
 */

declare global {
  interface Window {
    show_88?: (zoneId?: string) => Promise<void>;
    show_tag?: (zoneId?: string) => Promise<void>;
    show_12044377?: (zoneId?: string) => Promise<void>;
    showMonetagAd?: (zoneId?: string) => Promise<boolean>;
    Telegram?: any;
  }
}

export const DEFAULT_ZONE_ID = '12044377';
export const DEFAULT_APP_ID = '3534792';
export const DEFAULT_DIRECT_LINK = 'https://alwingulla.com/88/12044377';

/**
 * Dynamically creates Monetag script element and appends to document body
 */
export function loadMonetagScript(zoneId: string = DEFAULT_ZONE_ID): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    const cleanZone = String(zoneId || DEFAULT_ZONE_ID).trim();

    // Check if official function already exists on window
    if (
      typeof (window as any)[`show_${cleanZone}`] === 'function' ||
      typeof window.show_12044377 === 'function' ||
      typeof window.show_88 === 'function'
    ) {
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
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
      setTimeout(() => resolve(true), 1500);
    } catch {
      resolve(false);
    }
  });
}

export const ensureMonetagSdkLoaded = loadMonetagScript;

/**
 * Official Monetag Rewarded Ad trigger:
 * Dynamically loads script, calls window.show_12044377(), and resolves on complete
 */
export async function showMonetagAd(zoneId: string = DEFAULT_ZONE_ID): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const cleanZone = String(zoneId || DEFAULT_ZONE_ID).trim();

  await loadMonetagScript(cleanZone);

  const showFn =
    (window as any)[`show_${cleanZone}`] ||
    window.show_12044377 ||
    window.show_88 ||
    window.show_tag;

  if (typeof showFn === 'function') {
    try {
      const res = showFn(cleanZone);
      if (res && typeof res.then === 'function') {
        await res;
      }
      return true;
    } catch (err) {
      console.warn('[Monetag SDK Error]:', err);
      return false;
    }
  }

  // Fallback: If in Telegram WebApp, open direct link
  const adUrl = getAdTargetUrl(undefined, cleanZone);
  if ((window as any).Telegram?.WebApp?.openLink) {
    try {
      (window as any).Telegram.WebApp.openLink(adUrl);
      return true;
    } catch (e) {
      console.warn('[TG openLink fallback]:', e);
    }
  }

  return false;
}

// Bind to window.showMonetagAd for global availability
if (typeof window !== 'undefined') {
  window.showMonetagAd = showMonetagAd;
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

  if (typeof window !== 'undefined') {
    if (typeof window.showMonetagAd === 'function') {
      window.showMonetagAd(cleanId).catch(() => {});
      return true;
    }

    if ((window as any).Telegram?.WebApp?.openLink && targetUrl) {
      try {
        (window as any).Telegram.WebApp.openLink(targetUrl);
        return true;
      } catch (e) {
        console.warn('[Telegram openLink error]:', e);
      }
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  return true;
}
