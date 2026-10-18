// =========================================================================
// E4F FINAL AD CODES - DISTINCT ADS FOR 5 SPINS + 5 GIFT BOXES WITH INTRA-FALLBACK
// =========================================================================

export interface AdUnitConfig {
  adsgram: string;
  monetag: string;
  onclicka: string;
  richads: string;
  adexora: string;
}

export const SPIN_ADS: Record<string, AdUnitConfig> = {
  spin_01: { adsgram: "54618", monetag: "12044377", onclicka: "6153717", richads: "410203", adexora: "2217" },
  spin_02: { adsgram: "54618", monetag: "12044377", onclicka: "6153717", richads: "410203", adexora: "2217" },
  spin_03: { adsgram: "54618", monetag: "12044377", onclicka: "6153717", richads: "410203", adexora: "2217" },
  spin_04: { adsgram: "54618", monetag: "12044377", onclicka: "6153717", richads: "410203", adexora: "2217" },
  spin_05: { adsgram: "54618", monetag: "12044377", onclicka: "6153717", richads: "410203", adexora: "2217" }
};

export const BOX_ADS: Record<string, AdUnitConfig> = {
  box_01: { adsgram: "54617", monetag: "12044377", onclicka: "6153772", richads: "410202", adexora: "2217" },
  box_02: { adsgram: "54617", monetag: "12044377", onclicka: "6153772", richads: "410202", adexora: "2217" },
  box_03: { adsgram: "54617", monetag: "12044377", onclicka: "6153772", richads: "410202", adexora: "2217" },
  box_04: { adsgram: "54617", monetag: "12044377", onclicka: "6153772", richads: "410202", adexora: "2217" },
  box_05: { adsgram: "54617", monetag: "12044377", onclicka: "6153772", richads: "410202", adexora: "2217" }
};

export const MINING_ADS: Record<string, AdUnitConfig> = {
  mining: { adsgram: "54597", monetag: "12044377", onclicka: "6153774", richads: "410204", adexora: "2217" }
};

// Backward-compatible AD_CODES mapping
export const AD_CODES: Record<string, {
  adsgram: string;
  monetag_zone: string;
  onclicka_zone: string;
  richads_zone: string;
  adexora_zone: string;
}> = {
  mining: {
    adsgram: MINING_ADS.mining.adsgram,
    monetag_zone: MINING_ADS.mining.monetag,
    onclicka_zone: MINING_ADS.mining.onclicka,
    richads_zone: MINING_ADS.mining.richads,
    adexora_zone: MINING_ADS.mining.adexora,
  },
  spin_01: { adsgram: SPIN_ADS.spin_01.adsgram, monetag_zone: SPIN_ADS.spin_01.monetag, onclicka_zone: SPIN_ADS.spin_01.onclicka, richads_zone: SPIN_ADS.spin_01.richads, adexora_zone: SPIN_ADS.spin_01.adexora },
  spin_02: { adsgram: SPIN_ADS.spin_02.adsgram, monetag_zone: SPIN_ADS.spin_02.monetag, onclicka_zone: SPIN_ADS.spin_02.onclicka, richads_zone: SPIN_ADS.spin_02.richads, adexora_zone: SPIN_ADS.spin_02.adexora },
  spin_03: { adsgram: SPIN_ADS.spin_03.adsgram, monetag_zone: SPIN_ADS.spin_03.monetag, onclicka_zone: SPIN_ADS.spin_03.onclicka, richads_zone: SPIN_ADS.spin_03.richads, adexora_zone: SPIN_ADS.spin_03.adexora },
  spin_04: { adsgram: SPIN_ADS.spin_04.adsgram, monetag_zone: SPIN_ADS.spin_04.monetag, onclicka_zone: SPIN_ADS.spin_04.onclicka, richads_zone: SPIN_ADS.spin_04.richads, adexora_zone: SPIN_ADS.spin_04.adexora },
  spin_05: { adsgram: SPIN_ADS.spin_05.adsgram, monetag_zone: SPIN_ADS.spin_05.monetag, onclicka_zone: SPIN_ADS.spin_05.onclicka, richads_zone: SPIN_ADS.spin_05.richads, adexora_zone: SPIN_ADS.spin_05.adexora },
  box_01: { adsgram: BOX_ADS.box_01.adsgram, monetag_zone: BOX_ADS.box_01.monetag, onclicka_zone: BOX_ADS.box_01.onclicka, richads_zone: BOX_ADS.box_01.richads, adexora_zone: BOX_ADS.box_01.adexora },
  box_02: { adsgram: BOX_ADS.box_02.adsgram, monetag_zone: BOX_ADS.box_02.monetag, onclicka_zone: BOX_ADS.box_02.onclicka, richads_zone: BOX_ADS.box_02.richads, adexora_zone: BOX_ADS.box_02.adexora },
  box_03: { adsgram: BOX_ADS.box_03.adsgram, monetag_zone: BOX_ADS.box_03.monetag, onclicka_zone: BOX_ADS.box_03.onclicka, richads_zone: BOX_ADS.box_03.richads, adexora_zone: BOX_ADS.box_03.adexora },
  box_04: { adsgram: BOX_ADS.box_04.adsgram, monetag_zone: BOX_ADS.box_04.monetag, onclicka_zone: BOX_ADS.box_04.onclicka, richads_zone: BOX_ADS.box_04.richads, adexora_zone: BOX_ADS.box_04.adexora },
  box_05: { adsgram: BOX_ADS.box_05.adsgram, monetag_zone: BOX_ADS.box_05.monetag, onclicka_zone: BOX_ADS.box_05.onclicka, richads_zone: BOX_ADS.box_05.richads, adexora_zone: BOX_ADS.box_05.adexora }
};

/**
 * Strict sanitizer that prevents passing placeholder strings (like 'spin_01_adsgram'
 * or 'box_01_adsgram') to Adsgram SDK. Adsgram strictly requires a numeric string
 * or 'int-' followed by numbers.
 */
export function sanitizeAdsgramBlockId(rawId: any, fallbackId: string = '54111'): string {
  const safeFallback = /^\d+$/.test(String(fallbackId).trim()) || /^int-\d+$/i.test(String(fallbackId).trim())
    ? String(fallbackId).trim()
    : '54111';

  if (!rawId || typeof rawId !== 'string') return safeFallback;
  const trimmed = rawId.trim();
  if (/^\d+$/.test(trimmed) || /^int-\d+$/i.test(trimmed)) {
    return trimmed;
  }
  return safeFallback;
}

export function sanitizeAdZoneId(rawId: any, fallbackId: string): string {
  if (!rawId || typeof rawId !== 'string') return fallbackId;
  const trimmed = rawId.trim();
  if (/^(spin|box|mining)_[0-9a-z_]+$/i.test(trimmed)) {
    return fallbackId;
  }
  return trimmed || fallbackId;
}

export interface AdPlacementConfig {
  adsgram: string;
  monetag_zone: string;
  onclicka_zone: string;
  richads_zone: string;
  adexora_zone: string;
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
// 🛡️ DAILY NETWORK FREQUENCY CAPPING (MAX 3 ADS PER NETWORK PER DAY)
// "Also keep 3-time daily cap per network per user (Spin+Box combined count)"
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

export function isNetworkCappedToday(userId: string, network: string): boolean {
  return getNetworkViewCountToday(userId, network) >= MAX_DAILY_ADS_PER_NETWORK;
}

// =========================================================================
// 🚀 INTRA-FALLBACK WATERFALL BUILDER
// Try box_01 to box_05 / spin_01 to spin_05 within same network before switching
// =========================================================================

export interface IntraWaterfallTier {
  index: number;
  provider: 'AdsGram' | 'OnClickA' | 'RichAds' | 'Monetag' | 'Adexora';
  id: string;
  placementKey: string;
  label: string;
}

/**
 * "যার ঘর, সে আগে" Ad Chain Slot Order
 * Slot 1: [1, 2, 3, 4, 5]
 * Slot 2: [2, 1, 3, 4, 5]
 * Slot 3: [3, 1, 2, 4, 5]
 * Slot 4: [4, 1, 2, 3, 5]
 * Slot 5: [5, 1, 2, 3, 4]
 */
export function getAdChain(clickedSlot: number): number[] {
  const slot = Math.max(1, Math.min(5, Number(clickedSlot) || 1));
  const remaining = [1, 2, 3, 4, 5].filter(s => s !== slot);
  return [slot, ...remaining];
}

export function buildIntraWaterfallTiers(
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX',
  targetId: number | undefined,
  userId: string,
  _isTelegram: boolean = true
): IntraWaterfallTier[] {
  type NetworkName = 'AdsGram' | 'OnClickA' | 'RichAds' | 'Monetag' | 'Adexora';

  // Best Income Priority Sequence: AdsGram -> OnClickA -> RichAds -> Monetag -> Adexora
  const defaultNetworks: NetworkName[] = ['AdsGram', 'OnClickA', 'RichAds', 'Monetag', 'Adexora'];

  // Put uncapped networks first to strictly enforce 3-ad daily cap per network
  const uncappedNetworks = defaultNetworks.filter(n => !isNetworkCappedToday(userId, n));
  const cappedNetworks = defaultNetworks.filter(n => isNetworkCappedToday(userId, n));
  const orderedNetworks = uncappedNetworks.length > 0 ? [...uncappedNetworks, ...cappedNetworks] : defaultNetworks;

  // "যার ঘর, সে আগে": clickedSlot is always primary, followed by remaining slots in order
  const clickedSlot = Math.max(1, Math.min(5, Number(targetId) || 1));
  const slotChain = getAdChain(clickedSlot);

  const tiers: IntraWaterfallTier[] = [];

  if (actionType === 'MINING') {
    // Mining uses the 5 networks
    orderedNetworks.forEach((net, idx) => {
      let id = '54597';
      if (net === 'AdsGram') id = MINING_ADS.mining.adsgram;
      else if (net === 'OnClickA') id = MINING_ADS.mining.onclicka;
      else if (net === 'RichAds') id = MINING_ADS.mining.richads;
      else if (net === 'Monetag') id = MINING_ADS.mining.monetag;
      else if (net === 'Adexora') id = MINING_ADS.mining.adexora;

      tiers.push({
        index: idx + 1,
        provider: net,
        id,
        placementKey: 'mining',
        label: `${net} ${idx === 0 ? '(Primary)' : `(Tier ${idx + 1})`}`,
      });
    });
    return tiers;
  }

  const adsMap = actionType === 'SPIN' ? SPIN_ADS : BOX_ADS;
  const prefix = actionType === 'SPIN' ? 'spin' : 'box';

  // Build INTRA-FALLBACK in priority order: AdsGram -> OnClickA -> RichAds -> Monetag -> Adexora
  orderedNetworks.forEach((net) => {
    slotChain.forEach((pNum, cycleIdx) => {
      const pad = String(pNum).padStart(2, '0');
      const key = `${prefix}_${pad}`;
      const conf = adsMap[key] || adsMap[`${prefix}_01`];

      let id = '';
      if (net === 'AdsGram') {
        id = sanitizeAdsgramBlockId(conf.adsgram, actionType === 'SPIN' ? '54618' : '54617');
      } else if (net === 'OnClickA') {
        id = conf.onclicka || (actionType === 'SPIN' ? '6153717' : '6153772');
      } else if (net === 'RichAds') {
        id = conf.richads || (actionType === 'SPIN' ? '410203' : '410202');
      } else if (net === 'Monetag') {
        id = conf.monetag || '12044377';
      } else if (net === 'Adexora') {
        id = conf.adexora || '2217';
      }

      tiers.push({
        index: tiers.length + 1,
        provider: net,
        id,
        placementKey: key,
        label: `${net} (${actionType === 'SPIN' ? 'Spin' : 'Box'} #${pNum}${cycleIdx === 0 ? '' : ' fallback'})`,
      });
    });
  });

  return tiers;
}
