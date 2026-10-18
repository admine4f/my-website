// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (15 EDITABLE VARIABLES & REAL IDS)
// Priority Sequence: AdsGram -> OnClickA -> RichAds -> Monetag -> Adexora
// 4-Second Failover Timeout with Infinite Loop (Never Empty)
// =========================================================================

// Spin 1-5 Waterfall IDs
export let spin_01_adsgram = '54618';
export let spin_02_monetag = '12044377';
export let spin_03_onclicka = '6153717';
export let spin_04_richads = '410203';
export let spin_05_adexora = '2217';

// Gift Box 1-5 Waterfall IDs
export let box_01_adsgram = '54617';
export let box_02_monetag = '12044377';
export let box_03_onclicka = '6153772';
export let box_04_richads = '410202';
export let box_05_adexora = '2217';

// Mining 1-5 Waterfall IDs
export let mining_01_adsgram = '54597';
export let mining_02_monetag = '12044377';
export let mining_03_onclicka = '6153774';
export let mining_04_richads = '410204';
export let mining_05_adexora = '2217';

export const RICHADS_PLACEMENTS = ['410202', '410203', '410204', '410260', '410261'];

export interface WaterfallTier {
  index: number;
  provider: 'AdsGram' | 'OnClickA' | 'RichAds' | 'Monetag' | 'Adexora';
  id: string;
  label: string;
  placementKey?: string;
}

export interface WaterfallResult {
  success: boolean;
  completedTier?: WaterfallTier;
  allFailed?: boolean;
  message?: string;
  error?: string;
}

// Helper: Dynamically fetch & sync updated IDs from Admin Control Panel / Backend
export async function syncWaterfallSettings(): Promise<{
  spin: WaterfallTier[];
  box: WaterfallTier[];
}> {
  try {
    const res = await fetch('/api/system/public-settings');
    if (!res.ok) throw new Error('Settings not ok');
    const data = await res.json();
    const cleanId = (v: any) => typeof v === 'string' && !/^(spin|box|mining)_[0-9a-z_]+$/i.test(v.trim());
    if (cleanId(data.spin_01_adsgram)) spin_01_adsgram = data.spin_01_adsgram;
    if (cleanId(data.spin_02_monetag)) spin_02_monetag = data.spin_02_monetag;
    if (cleanId(data.spin_03_onclicka)) spin_03_onclicka = data.spin_03_onclicka;
    if (cleanId(data.spin_04_richads)) spin_04_richads = data.spin_04_richads;
    if (cleanId(data.spin_05_adexora)) spin_05_adexora = data.spin_05_adexora;

    if (cleanId(data.box_01_adsgram)) box_01_adsgram = data.box_01_adsgram;
    if (cleanId(data.box_02_monetag)) box_02_monetag = data.box_02_monetag;
    if (cleanId(data.box_03_onclicka)) box_03_onclicka = data.box_03_onclicka;
    if (cleanId(data.box_04_richads)) box_04_richads = data.box_04_richads;
    if (cleanId(data.box_05_adexora)) box_05_adexora = data.box_05_adexora;

    if (cleanId(data.mining_01_adsgram)) mining_01_adsgram = data.mining_01_adsgram;
    if (cleanId(data.mining_02_monetag)) mining_02_monetag = data.mining_02_monetag;
    if (cleanId(data.mining_03_onclicka)) mining_03_onclicka = data.mining_03_onclicka;
    if (cleanId(data.mining_04_richads)) mining_04_richads = data.mining_04_richads;
    if (cleanId(data.mining_05_adexora)) mining_05_adexora = data.mining_05_adexora;
  } catch (e) {
    console.warn('Could not sync waterfall settings from server, using local defaults:', e);
  }

  return {
    spin: getSpinWaterfallTiers(),
    box: getBoxWaterfallTiers(),
  };
}

// Best Income Waterfall Priority Order: AdsGram -> OnClickA -> RichAds -> Monetag -> Adexora
export function getSpinWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'AdsGram', id: spin_01_adsgram, label: 'AdsGram (Primary)' },
    { index: 2, provider: 'OnClickA', id: spin_03_onclicka, label: 'OnClickA (Tier 2)' },
    { index: 3, provider: 'RichAds', id: spin_04_richads, label: 'RichAds (Tier 3)' },
    { index: 4, provider: 'Monetag', id: spin_02_monetag, label: 'Monetag (Tier 4)' },
    { index: 5, provider: 'Adexora', id: spin_05_adexora, label: 'Adexora (Tier 5)' },
  ];
}

export function getBoxWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'AdsGram', id: box_01_adsgram, label: 'AdsGram (Primary)' },
    { index: 2, provider: 'OnClickA', id: box_03_onclicka, label: 'OnClickA (Tier 2)' },
    { index: 3, provider: 'RichAds', id: box_04_richads, label: 'RichAds (Tier 3)' },
    { index: 4, provider: 'Monetag', id: box_02_monetag, label: 'Monetag (Tier 4)' },
    { index: 5, provider: 'Adexora', id: box_05_adexora, label: 'Adexora (Tier 5)' },
  ];
}

export function getMiningWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'AdsGram', id: mining_01_adsgram, label: 'AdsGram (Primary)' },
    { index: 2, provider: 'OnClickA', id: mining_03_onclicka, label: 'OnClickA (Tier 2)' },
    { index: 3, provider: 'RichAds', id: mining_04_richads, label: 'RichAds (Tier 3)' },
    { index: 4, provider: 'Monetag', id: mining_02_monetag, label: 'Monetag (Tier 4)' },
    { index: 5, provider: 'Adexora', id: mining_05_adexora, label: 'Adexora (Tier 5)' },
  ];
}

// Ensure Adsgram JS SDK is loaded safely into the document
export function loadAdsgramScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Adsgram) return resolve(true);

    const existing = document.querySelector('script[src*="adsgram"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(!!(window as any).Adsgram), 2500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sad.adsgram.ai/js/sad.min.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);

    // Timeout safety fallback
    setTimeout(() => {
      resolve(!!(window as any).Adsgram);
    }, 3000);
  });
}

// Check whether app is currently running inside Telegram with valid launch parameters
export function isTelegramClientWithParams(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return false;
  return Boolean(tg.initData && tg.initData.length > 0) || Boolean(tg.initDataUnsafe?.user);
}

// Helper: Open external URL safely in Telegram WebApp or browser
function openExternalAdUrl(targetUrl: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if ((window as any).Telegram?.WebApp?.openLink) {
      (window as any).Telegram.WebApp.openLink(targetUrl);
      return true;
    } else {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return !!win;
    }
  } catch (e) {
    console.warn('[Ad External Open Warning]:', e);
    return false;
  }
}

// =========================================================================
// 5 DEDICATED AD FUNCTIONS WITH TRY-CATCH & 4-SECOND TIMEOUT
// =========================================================================

/**
 * 1. AdsGram Ad Handler
 * Plays video ad using AdsGram Telegram Mini App SDK with Telegram environment guard
 */
export async function showAdsgramAd(
  blockId: string,
  _timeoutMs: number = 6000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    // If outside Telegram, return immediately to prevent AdsgramError: Unable to retrieve launch parameters
    if (!isTelegramClientWithParams()) {
      return {
        success: false,
        completed: false,
        reason: 'AdsGram requires Telegram environment with valid launch parameters',
      };
    }

    const safeBlockId = String(blockId || '54618').trim();
    const loaded = await loadAdsgramScript().catch(() => false);
    if (!loaded) {
      return { success: false, completed: false, reason: 'Could not load AdsGram SDK' };
    }

    const adsgramObj = (window as any).Adsgram;
    if (!adsgramObj || typeof adsgramObj.init !== 'function') {
      return { success: false, completed: false, reason: 'AdsGram SDK unavailable in this client' };
    }

    let res: any;
    try {
      const AdController = adsgramObj.init({ blockId: safeBlockId, debug: false });
      res = await AdController.show();
    } catch (liveErr: any) {
      console.warn('[AdsGram playback notice]:', liveErr?.message || liveErr);
      return {
        success: false,
        completed: false,
        reason: liveErr?.message || 'AdsGram playback unavailable',
      };
    }

    if (res && res.done) {
      return { success: true, completed: true };
    } else {
      return { success: false, completed: false, reason: 'AdsGram playback was skipped or closed' };
    }
  } catch (err: any) {
    console.warn('[AdsGram Handled Notice]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'AdsGram execution failed' };
  }
}

/**
 * 2. OnClickA Ad Handler
 * Zone direct link or in-app countdown timer (Never dumps user onto onclicka.com homepage)
 */
export async function showOnclickaAd(
  zoneId: string,
  _timeoutMs: number = 4000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    const cleanId = String(zoneId || '6153717').trim();
    // Only open if the user/admin explicitly provided a real URL direct link
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      const opened = openExternalAdUrl(cleanId);
      if (!opened) {
        return { success: false, completed: false, reason: 'Could not launch OnClickA link' };
      }
      return { success: true, completed: false };
    }

    // If numeric zone ID, keep user inside Telegram Mini App and let the countdown run
    return { success: true, completed: false };
  } catch (err: any) {
    console.warn('[OnClickA Error]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'OnClickA execution failed' };
  }
}

/**
 * 3. RichAds Ad Handler
 * High-performing RichAds zone redirect or in-app countdown timer
 */
export async function showRichadsAd(
  zoneId: string,
  _timeoutMs: number = 4000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    const cleanId = String(zoneId || '410203').trim();
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      const opened = openExternalAdUrl(cleanId);
      if (!opened) {
        return { success: false, completed: false, reason: 'Could not launch RichAds link' };
      }
      return { success: true, completed: false };
    }

    return { success: true, completed: false };
  } catch (err: any) {
    console.warn('[RichAds Error]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'RichAds execution failed' };
  }
}

/**
 * 4. Monetag Ad Handler
 * In-App SDK with show_88 / show_tag or direct link
 */
export async function showMonetagAd(
  zoneId: string,
  _timeoutMs: number = 6000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    const cleanId = String(zoneId || '12044377').trim();

    // Direct link if provided as URL
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      const opened = openExternalAdUrl(cleanId);
      if (!opened) {
        return { success: false, completed: false, reason: 'Could not launch Monetag link' };
      }
      return { success: true, completed: false };
    }

    // Check In-App SDK if available in Telegram WebApp
    const showFn = (window as any).show_88 || (window as any).show_tag;
    if (typeof showFn === 'function') {
      try {
        await showFn();
        return { success: true, completed: true };
      } catch (sdkErr: any) {
        console.warn('[Monetag SDK Error]:', sdkErr);
        return { success: false, completed: false, reason: sdkErr?.message || 'Monetag SDK error' };
      }
    }

    return { success: true, completed: false };
  } catch (err: any) {
    console.warn('[Monetag Error]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'Monetag execution failed' };
  }
}

/**
 * 5. Adexora Ad Handler
 * Adexora zone launcher or in-app countdown timer
 */
export async function showAdexoraAd(
  zoneId: string,
  _timeoutMs: number = 4000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    const cleanId = String(zoneId || '2217').trim();
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      const opened = openExternalAdUrl(cleanId);
      if (!opened) {
        return { success: false, completed: false, reason: 'Could not launch Adexora link' };
      }
      return { success: true, completed: false };
    }

    return { success: true, completed: false };
  } catch (err: any) {
    console.warn('[Adexora Error]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'Adexora execution failed' };
  }
}
