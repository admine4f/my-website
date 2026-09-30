// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (10 EDITABLE VARIABLES)
// You can set or change your 10 Ad Block / Zone / App IDs right here:
// =========================================================================
export let spin_01_adsgram = 'spin_01_adsgram';
export let spin_02_monetag = 'spin_02_monetag';
export let spin_03_onclicka = 'spin_03_onclicka';
export let spin_04_richads = 'spin_04_richads';
export let spin_05_adexora = 'spin_05_adexora';

export let box_01_adsgram = 'box_01_adsgram';
export let box_02_monetag = 'box_02_monetag';
export let box_03_onclicka = 'box_03_onclicka';
export let box_04_richads = 'box_04_richads';
export let box_05_adexora = 'box_05_adexora';

export interface WaterfallTier {
  index: number;
  provider: 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora';
  id: string;
  label: string;
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
    if (data.success) {
      if (data.spin_01_adsgram) spin_01_adsgram = data.spin_01_adsgram;
      if (data.spin_02_monetag) spin_02_monetag = data.spin_02_monetag;
      if (data.spin_03_onclicka) spin_03_onclicka = data.spin_03_onclicka;
      if (data.spin_04_richads) spin_04_richads = data.spin_04_richads;
      if (data.spin_05_adexora) spin_05_adexora = data.spin_05_adexora;

      if (data.box_01_adsgram) box_01_adsgram = data.box_01_adsgram;
      if (data.box_02_monetag) box_02_monetag = data.box_02_monetag;
      if (data.box_03_onclicka) box_03_onclicka = data.box_03_onclicka;
      if (data.box_04_richads) box_04_richads = data.box_04_richads;
      if (data.box_05_adexora) box_05_adexora = data.box_05_adexora;
    }
  } catch (e) {
    console.warn('Could not sync waterfall settings from server, using local defaults:', e);
  }

  return {
    spin: getSpinWaterfallTiers(),
    box: getBoxWaterfallTiers(),
  };
}

export function getSpinWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'AdsGram', id: spin_01_adsgram, label: 'AdsGram (Primary)' },
    { index: 2, provider: 'Monetag', id: spin_02_monetag, label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: spin_03_onclicka, label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: spin_04_richads, label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Adexora', id: spin_05_adexora, label: 'Adexora (Tier 5)' },
  ];
}

export function getBoxWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'AdsGram', id: box_01_adsgram, label: 'AdsGram (Primary)' },
    { index: 2, provider: 'Monetag', id: box_02_monetag, label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: box_03_onclicka, label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: box_04_richads, label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Adexora', id: box_05_adexora, label: 'Adexora (Tier 5)' },
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
