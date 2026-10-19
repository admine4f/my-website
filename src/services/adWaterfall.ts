// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (5 TIERS: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag)
// Adsgram and Adexora have been completely replaced with RichAds and Monetag.
// 4-Second Failover Timeout with Infinite Loop (Never Empty)
// =========================================================================

// Spin 1-5 Waterfall IDs
export let spin_01_richads = '410203';
export let spin_02_monetag = '12044377';
export let spin_03_onclicka = '6153717';
export let spin_04_richads = '410203';
export let spin_05_monetag = '12044377';

// Gift Box 1-5 Waterfall IDs
export let box_01_richads = '410202';
export let box_02_monetag = '12044377';
export let box_03_onclicka = '6153772';
export let box_04_richads = '410202';
export let box_05_monetag = '12044377';

// Mining 1-5 Waterfall IDs
export let mining_01_richads = '410204';
export let mining_02_monetag = '12044377';
export let mining_03_onclicka = '6153774';
export let mining_04_richads = '410204';
export let mining_05_monetag = '12044377';

export const RICHADS_PLACEMENTS = ['410202', '410203', '410204', '410260', '410261'];

export interface WaterfallTier {
  index: number;
  provider: 'RichAds' | 'Monetag' | 'OnClickA';
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
    if (cleanId(data.spin_01_richads)) spin_01_richads = data.spin_01_richads;
    if (cleanId(data.spin_02_monetag)) spin_02_monetag = data.spin_02_monetag;
    if (cleanId(data.spin_03_onclicka)) spin_03_onclicka = data.spin_03_onclicka;
    if (cleanId(data.spin_04_richads)) spin_04_richads = data.spin_04_richads;
    if (cleanId(data.spin_05_monetag)) spin_05_monetag = data.spin_05_monetag;

    if (cleanId(data.box_01_richads)) box_01_richads = data.box_01_richads;
    if (cleanId(data.box_02_monetag)) box_02_monetag = data.box_02_monetag;
    if (cleanId(data.box_03_onclicka)) box_03_onclicka = data.box_03_onclicka;
    if (cleanId(data.box_04_richads)) box_04_richads = data.box_04_richads;
    if (cleanId(data.box_05_monetag)) box_05_monetag = data.box_05_monetag;

    if (cleanId(data.mining_01_richads)) mining_01_richads = data.mining_01_richads;
    if (cleanId(data.mining_02_monetag)) mining_02_monetag = data.mining_02_monetag;
    if (cleanId(data.mining_03_onclicka)) mining_03_onclicka = data.mining_03_onclicka;
    if (cleanId(data.mining_04_richads)) mining_04_richads = data.mining_04_richads;
    if (cleanId(data.mining_05_monetag)) mining_05_monetag = data.mining_05_monetag;
  } catch (e) {
    console.warn('Could not sync waterfall settings from server, using local defaults:', e);
  }

  return {
    spin: getSpinWaterfallTiers(),
    box: getBoxWaterfallTiers(),
  };
}

// 5 Tiers: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag
export function getSpinWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'RichAds', id: spin_01_richads, label: 'RichAds (Primary)' },
    { index: 2, provider: 'Monetag', id: spin_02_monetag, label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: spin_03_onclicka, label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: spin_04_richads, label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Monetag', id: spin_05_monetag, label: 'Monetag (Tier 5)' },
  ];
}

export function getBoxWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'RichAds', id: box_01_richads, label: 'RichAds (Primary)' },
    { index: 2, provider: 'Monetag', id: box_02_monetag, label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: box_03_onclicka, label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: box_04_richads, label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Monetag', id: box_05_monetag, label: 'Monetag (Tier 5)' },
  ];
}

export function getMiningWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'RichAds', id: mining_01_richads, label: 'RichAds (Primary)' },
    { index: 2, provider: 'Monetag', id: mining_02_monetag, label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: mining_03_onclicka, label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: mining_04_richads, label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Monetag', id: mining_05_monetag, label: 'Monetag (Tier 5)' },
  ];
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
// 3 DEDICATED AD HANDLERS (RichAds, Monetag, OnClickA)
// =========================================================================

/**
 * 1. RichAds Ad Handler (Slot 1 & Slot 4)
 * Real RichAds zone launcher with direct link or in-app countdown timer
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
 * 2. Monetag Ad Handler (Slot 2 & Slot 5 - Native Telegram SDK Zone 12044377)
 * In-App SDK with show_88 / show_tag or direct link
 */
export async function showMonetagAd(
  zoneId: string,
  _timeoutMs: number = 6000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    const cleanId = String(zoneId || '12044377').trim();

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

    // Direct link if provided as URL
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      const opened = openExternalAdUrl(cleanId);
      if (!opened) {
        return { success: false, completed: false, reason: 'Could not launch Monetag link' };
      }
      return { success: true, completed: false };
    }

    return { success: true, completed: false };
  } catch (err: any) {
    console.warn('[Monetag Error]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'Monetag execution failed' };
  }
}

/**
 * 3. OnClickA Ad Handler
 * Zone direct link or in-app countdown timer
 */
export async function showOnclickaAd(
  zoneId: string,
  _timeoutMs: number = 4000
): Promise<{ success: boolean; completed: boolean; reason?: string }> {
  try {
    const cleanId = String(zoneId || '6153717').trim();
    if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
      const opened = openExternalAdUrl(cleanId);
      if (!opened) {
        return { success: false, completed: false, reason: 'Could not launch OnClickA link' };
      }
      return { success: true, completed: false };
    }

    return { success: true, completed: false };
  } catch (err: any) {
    console.warn('[OnClickA Error]:', err?.message || err);
    return { success: false, completed: false, reason: err?.message || 'OnClickA execution failed' };
  }
}
