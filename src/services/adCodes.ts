// =========================================================================
// E4F FINAL AD CODES - 5 WATERFALL SLOTS (RichAds, Monetag, OnClickA)
// 5-Slot Waterfall Architecture: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag
// =========================================================================

export interface AdUnitConfig {
  richads_1: string;
  monetag_1: string;
  onclicka: string;
  richads_2: string;
  monetag_2: string;
}

export const SPIN_ADS: Record<string, AdUnitConfig> = {
  spin_01: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717", richads_2: "410203", monetag_2: "12044377" },
  spin_02: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717", richads_2: "410203", monetag_2: "12044377" },
  spin_03: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717", richads_2: "410203", monetag_2: "12044377" },
  spin_04: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717", richads_2: "410203", monetag_2: "12044377" },
  spin_05: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717", richads_2: "410203", monetag_2: "12044377" }
};

export const BOX_ADS: Record<string, AdUnitConfig> = {
  box_01: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772", richads_2: "410202", monetag_2: "12044377" },
  box_02: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772", richads_2: "410202", monetag_2: "12044377" },
  box_03: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772", richads_2: "410202", monetag_2: "12044377" },
  box_04: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772", richads_2: "410202", monetag_2: "12044377" },
  box_05: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772", richads_2: "410202", monetag_2: "12044377" }
};

export const MINING_ADS: Record<string, AdUnitConfig> = {
  mining: { richads_1: "410204", monetag_1: "12044377", onclicka: "6153774", richads_2: "410204", monetag_2: "12044377" }
};

// Backward-compatible AD_CODES mapping
export const AD_CODES: Record<string, {
  monetag_zone: string;
  onclicka_zone: string;
  richads_zone: string;
}> = {
  mining: {
    monetag_zone: MINING_ADS.mining.monetag_1,
    onclicka_zone: MINING_ADS.mining.onclicka,
    richads_zone: MINING_ADS.mining.richads_1,
  },
  spin_01: { monetag_zone: SPIN_ADS.spin_01.monetag_1, onclicka_zone: SPIN_ADS.spin_01.onclicka, richads_zone: SPIN_ADS.spin_01.richads_1 },
  spin_02: { monetag_zone: SPIN_ADS.spin_02.monetag_1, onclicka_zone: SPIN_ADS.spin_02.onclicka, richads_zone: SPIN_ADS.spin_02.richads_1 },
  spin_03: { monetag_zone: SPIN_ADS.spin_03.monetag_1, onclicka_zone: SPIN_ADS.spin_03.onclicka, richads_zone: SPIN_ADS.spin_03.richads_1 },
  spin_04: { monetag_zone: SPIN_ADS.spin_04.monetag_1, onclicka_zone: SPIN_ADS.spin_04.onclicka, richads_zone: SPIN_ADS.spin_04.richads_1 },
  spin_05: { monetag_zone: SPIN_ADS.spin_05.monetag_1, onclicka_zone: SPIN_ADS.spin_05.onclicka, richads_zone: SPIN_ADS.spin_05.richads_1 },
  box_01: { monetag_zone: BOX_ADS.box_01.monetag_1, onclicka_zone: BOX_ADS.box_01.onclicka, richads_zone: BOX_ADS.box_01.richads_1 },
  box_02: { monetag_zone: BOX_ADS.box_02.monetag_1, onclicka_zone: BOX_ADS.box_02.onclicka, richads_zone: BOX_ADS.box_02.richads_1 },
  box_03: { monetag_zone: BOX_ADS.box_03.monetag_1, onclicka_zone: BOX_ADS.box_03.onclicka, richads_zone: BOX_ADS.box_03.richads_1 },
  box_04: { monetag_zone: BOX_ADS.box_04.monetag_1, onclicka_zone: BOX_ADS.box_04.onclicka, richads_zone: BOX_ADS.box_04.richads_1 },
  box_05: { monetag_zone: BOX_ADS.box_05.monetag_1, onclicka_zone: BOX_ADS.box_05.onclicka, richads_zone: BOX_ADS.box_05.richads_1 }
};

export function sanitizeAdZoneId(rawId: any, fallbackId: string): string {
  if (!rawId || typeof rawId !== 'string') return fallbackId;
  const trimmed = rawId.trim();
  if (/^(spin|box|mining)_[0-9a-z_]+$/i.test(trimmed)) {
    return fallbackId;
  }
  return trimmed || fallbackId;
}

export interface AdPlacementConfig {
  monetag_zone: string;
  onclicka_zone: string;
  richads_zone: string;
}

export function getAdCodesForPlacement(
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX',
  targetId?: number
): AdPlacementConfig {
  const num = Math.max(1, Math.min(5, Number(targetId) || 1));
  const padIndex = String(num).padStart(2, '0');

  if (actionType === 'MINING') {
    return AD_CODES.mining;
  } else if (actionType === 'SPIN') {
    return AD_CODES[`spin_${padIndex}`] || AD_CODES.spin_01;
  } else if (actionType === 'GIFT_BOX') {
    return AD_CODES[`box_${padIndex}`] || AD_CODES.box_01;
  }
  return AD_CODES.mining;
}

// =========================================================================
// 🛡️ DAILY NETWORK FREQUENCY CAPPING
// =========================================================================

export const MAX_DAILY_ADS_PER_NETWORK = 3;

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getNetworkViewCountToday(userId: string, network: string): number {
  if (typeof window === 'undefined' || !userId) return 0;
  try {
    const today = getTodayKey();
    const raw = localStorage.getItem(`e4f_ad_cap_${userId}_${today}`);
    if (!raw) return 0;
    const counts = JSON.parse(raw);
    return Number(counts[network] || 0);
  } catch {
    return 0;
  }
}

export function incrementNetworkViewCountToday(userId: string, network: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const today = getTodayKey();
    const key = `e4f_ad_cap_${userId}_${today}`;
    const raw = localStorage.getItem(key);
    const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
    counts[network] = (Number(counts[network]) || 0) + 1;
    localStorage.setItem(key, JSON.stringify(counts));
  } catch {}
}

export function isNetworkCappedToday(_userId: string, _network: string): boolean {
  // Infinite looping to ensure ads always load
  return false;
}

// =========================================================================
// 🚀 INTRA-FALLBACK WATERFALL BUILDER (5 Tiers: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag)
// =========================================================================

export interface IntraWaterfallTier {
  index: number;
  provider: 'RichAds' | 'Monetag' | 'OnClickA';
  id: string;
  placementKey: string;
  label: string;
}

/**
 * 5 Active Waterfall Tiers per Slot:
 * Slot 1: RichAds (Primary)
 * Slot 2: Monetag (Tier 2)
 * Slot 3: OnClickA (Tier 3)
 * Slot 4: RichAds (Tier 4)
 * Slot 5: Monetag (Tier 5)
 */
export function buildIntraWaterfallTiers(
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX' | 'WITHDRAW' | 'SELL',
  targetId: number | undefined,
  _userId: string,
  _isTelegram: boolean = true
): IntraWaterfallTier[] {
  const padIndex = String(Math.max(1, Math.min(5, Number(targetId) || 1))).padStart(2, '0');
  const prefix = actionType === 'SPIN' ? 'spin' : actionType === 'GIFT_BOX' ? 'box' : 'mining';
  const placementKey = `${prefix}_${padIndex}`;

  if (actionType === 'MINING' || actionType === 'WITHDRAW' || actionType === 'SELL') {
    return [
      { index: 1, provider: 'RichAds', id: MINING_ADS.mining.richads_1, placementKey: 'mining_01', label: 'RichAds (Primary)' },
      { index: 2, provider: 'Monetag', id: MINING_ADS.mining.monetag_1, placementKey: 'mining_02', label: 'Monetag (Tier 2)' },
      { index: 3, provider: 'OnClickA', id: MINING_ADS.mining.onclicka, placementKey: 'mining_03', label: 'OnClickA (Tier 3)' },
      { index: 4, provider: 'RichAds', id: MINING_ADS.mining.richads_2, placementKey: 'mining_04', label: 'RichAds (Tier 4)' },
      { index: 5, provider: 'Monetag', id: MINING_ADS.mining.monetag_2, placementKey: 'mining_05', label: 'Monetag (Tier 5)' },
    ];
  }

  const adsMap = actionType === 'SPIN' ? SPIN_ADS : BOX_ADS;
  const conf = adsMap[placementKey] || adsMap[`${prefix}_01`];

  return [
    { index: 1, provider: 'RichAds', id: conf.richads_1, placementKey, label: `RichAds (${actionType === 'SPIN' ? 'Spin' : 'Box'} #1)` },
    { index: 2, provider: 'Monetag', id: conf.monetag_1, placementKey, label: `Monetag (${actionType === 'SPIN' ? 'Spin' : 'Box'} #2)` },
    { index: 3, provider: 'OnClickA', id: conf.onclicka, placementKey, label: `OnClickA (${actionType === 'SPIN' ? 'Spin' : 'Box'} #3)` },
    { index: 4, provider: 'RichAds', id: conf.richads_2, placementKey, label: `RichAds (${actionType === 'SPIN' ? 'Spin' : 'Box'} #4)` },
    { index: 5, provider: 'Monetag', id: conf.monetag_2, placementKey, label: `Monetag (${actionType === 'SPIN' ? 'Spin' : 'Box'} #5)` },
  ];
}
