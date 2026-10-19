// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (5 TIERS: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag)
// Adsgram and Adexora have been completely replaced with RichAds and Monetag.
// 4-Second Failover Timeout with Infinite Loop (Never Empty)
// =========================================================================

// Spin 1-5 Waterfall IDs
export let spin_01_richads = '410203';
export let spin_02_monetag = '12044377';
export let spin_03_onclicka = '6153717E4F';
export let spin_04_richads = '410203';
export let spin_05_monetag = '12044377';

// Gift Box 1-5 Waterfall IDs
export let box_01_richads = '410202';
export let box_02_monetag = '12044377';
export let box_03_onclicka = '6153772E4F';
export let box_04_richads = '410202';
export let box_05_monetag = '12044377';

// Mining 1-5 Waterfall IDs
export let mining_01_richads = '410204';
export let mining_02_monetag = '12044377';
export let mining_03_onclicka = '6153774E4F';
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
export function getSpinWaterfallTiers(targetSpinNumber?: number): WaterfallTier[] {
  const baseTiers: WaterfallTier[] = [
    { index: 1, provider: 'RichAds', id: spin_01_richads, label: 'RichAds (Slot 1)' },
    { index: 2, provider: 'Monetag', id: spin_02_monetag, label: 'Monetag (Slot 2)' },
    { index: 3, provider: 'OnClickA', id: spin_03_onclicka, label: 'OnClickA (Slot 3)' },
    { index: 4, provider: 'RichAds', id: spin_04_richads, label: 'RichAds (Slot 4)' },
    { index: 5, provider: 'Monetag', id: spin_05_monetag, label: 'Monetag (Slot 5)' },
  ];
  if (!targetSpinNumber || targetSpinNumber < 1) return baseTiers;
  const startIndex = Math.max(0, Math.min(4, targetSpinNumber - 1));
  return [
    ...baseTiers.slice(startIndex),
    ...baseTiers.slice(0, startIndex),
  ].map((t, i) => ({
    ...t,
    index: i + 1,
    label: i === 0 ? `${t.provider} (Primary)` : `${t.provider} (Tier ${i + 1})`,
  }));
}

export function getBoxWaterfallTiers(targetBoxNumber?: number): WaterfallTier[] {
  const baseTiers: WaterfallTier[] = [
    { index: 1, provider: 'RichAds', id: box_01_richads, label: 'RichAds (Slot 1)' },
    { index: 2, provider: 'Monetag', id: box_02_monetag, label: 'Monetag (Slot 2)' },
    { index: 3, provider: 'OnClickA', id: box_03_onclicka, label: 'OnClickA (Slot 3)' },
    { index: 4, provider: 'RichAds', id: box_04_richads, label: 'RichAds (Slot 4)' },
    { index: 5, provider: 'Monetag', id: box_05_monetag, label: 'Monetag (Slot 5)' },
  ];
  if (!targetBoxNumber || targetBoxNumber < 1) return baseTiers;
  const startIndex = Math.max(0, Math.min(4, targetBoxNumber - 1));
  return [
    ...baseTiers.slice(startIndex),
    ...baseTiers.slice(0, startIndex),
  ].map((t, i) => ({
    ...t,
    index: i + 1,
    label: i === 0 ? `${t.provider} (Primary)` : `${t.provider} (Tier ${i + 1})`,
  }));
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

import { ensureMonetagSdkLoaded, showMonetagAd as sdkShowMonetagAd } from './monetagSdk';

export function getRichadsAdUrl(zoneId: string): string {
  const clean = String(zoneId || '410202').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://richinfo.co/delivery/site/${clean}`;
}

export function getMonetagAdUrl(zoneId: string): string {
  const clean = String(zoneId || '12044377').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://alwingulla.com/88/${clean}`;
}

export function getOnclickaAdUrl(zoneId: string): string {
  const clean = String(zoneId || '6153772').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://onclicka.com/delivery/site/${clean}`;
}

export function getProviderAdUrl(provider: 'RichAds' | 'Monetag' | 'OnClickA', zoneId: string): string {
  if (provider === 'RichAds') return getRichadsAdUrl(zoneId);
  if (provider === 'Monetag') return getMonetagAdUrl(zoneId);
  if (provider === 'OnClickA') return getOnclickaAdUrl(zoneId);
  return getMonetagAdUrl(zoneId);
}

/**
 * Opens sponsor ad externally via Telegram WebApp or browser window.
 * Eliminates iframe AccessDenied, ERR_BLOCKED_BY_RESPONSE, and raw code errors.
 */
export function openExternalSponsorAd(url: string) {
  if (!url || typeof window === 'undefined') return;
  try {
    if ((window as any).Telegram?.WebApp?.openLink) {
      (window as any).Telegram.WebApp.openLink(url);
      return;
    }
  } catch (err) {
    console.warn('[Telegram openLink warn]:', err);
  }
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('[window.open warn]:', err);
  }
}

// =========================================================================
// 3 DEDICATED REAL AD HANDLERS (RichAds, Monetag, OnClickA)
// =========================================================================

/**
 * 1. RichAds Real Ad Handler (Slot 1 & Slot 4)
 * Opens external ad via Telegram.WebApp.openLink() / window.open()
 */
export async function showRichadsAd(
  zoneId: string,
  _timeoutMs: number = 4000
): Promise<{ success: boolean; completed: boolean; adUrl: string; reason?: string }> {
  const cleanId = String(zoneId || '410202').trim();
  const adUrl = getRichadsAdUrl(cleanId);

  try {
    openExternalSponsorAd(adUrl);
    return { success: true, completed: false, adUrl };
  } catch (err: any) {
    console.warn('[RichAds Error]:', err);
    return { success: false, completed: false, adUrl, reason: err?.message || 'RichAds failed to open' };
  }
}

/**
 * 2. Monetag Real Ad Handler (Slot 2 & Slot 5 - Native Telegram SDK Zone 12044377)
 * Runs window.showMonetagAd() / show_12044377() official rewarded function
 */
export async function showMonetagAd(
  zoneId: string,
  _timeoutMs: number = 6000
): Promise<{ success: boolean; completed: boolean; adUrl: string; reason?: string }> {
  const cleanId = String(zoneId || '12044377').trim();
  const adUrl = getMonetagAdUrl(cleanId);

  try {
    if (typeof window !== 'undefined') {
      const triggerFn = window.showMonetagAd || sdkShowMonetagAd;
      if (typeof triggerFn === 'function') {
        const completed = await triggerFn(cleanId);
        if (completed) {
          return { success: true, completed: true, adUrl };
        }
      }
    }

    // Fallback: Open external direct link
    openExternalSponsorAd(adUrl);
    return { success: true, completed: false, adUrl };
  } catch (err: any) {
    console.warn('[Monetag Error]:', err?.message || err);
    return { success: false, completed: false, adUrl, reason: err?.message || 'Monetag failed' };
  }
}

import { showTmaAd } from '../components/TmaAdManager';

/**
 * 3. OnClickA Real Ad Handler (Slot 3)
 * Plays in-stream TMA rewarded ad INSIDE Telegram via window.initCdTma
 */
export async function showOnclickaAd(
  zoneId: string,
  _timeoutMs: number = 4000
): Promise<{ success: boolean; completed: boolean; adUrl: string; reason?: string }> {
  const cleanId = String(zoneId || '6153772').trim();
  const adUrl = getOnclickaAdUrl(cleanId);

  try {
    // type mapping: mining_03 -> MINING, box_03 -> GIFTBOX, spin_03 -> SPIN
    let tmaType: 'MINING' | 'GIFTBOX' | 'SPIN' = 'MINING';
    const lower = cleanId.toLowerCase();
    if (lower.includes('spin') || lower.includes('6153717')) {
      tmaType = 'SPIN';
    } else if (lower.includes('box') || lower.includes('gift') || lower.includes('6153772')) {
      tmaType = 'GIFTBOX';
    } else {
      tmaType = 'MINING';
    }

    await showTmaAd(tmaType);
    // Ad watched successfully INSIDE Telegram
    return { success: true, completed: true, adUrl };
  } catch (err: any) {
    console.warn('[OnClickA TMA Ad failed, falling back to next waterfall network]:', err);
    return { success: false, completed: false, adUrl, reason: err?.message || 'OnClickA failed' };
  }
}

