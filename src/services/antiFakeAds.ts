// =========================================================================
// E4F MINING - 100% IN-APP AD WATERFALL & ANTI-FAKE SECURITY ENGINE
// =========================================================================

import { supabaseClient } from './api';

// Admin Ad IDs
export const AD_CONFIG = {
  MINING: [
    { network: 'richads' as const, id: '410204' },
    { network: 'monetag' as const, id: '12044377' },
    { network: 'onclicka' as const, id: '6153774E4F' },
    { network: 'richads' as const, id: '410204' },
    { network: 'monetag' as const, id: '12044377' },
  ],
  SPIN: {
    '5/5': [
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    '4/5': [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
    ],
    '3/5': [
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    '2/5': [
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
    ],
    '1/5': [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
    ],
  },
  GIFT: {
    1: [
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    2: [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
    ],
    3: [
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    4: [
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
    ],
    5: [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
    ],
  },
};

// 1. Helper: Today UTC Date string (YYYY-MM-DD)
export const todayUTC = (): string => new Date().toISOString().split('T')[0];

// 2. Helper: Local & Server completion check
export function isDoneLocal(type: 'gift' | 'spin' | 'mining', key: string | number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const today = todayUTC();
    if (type === 'gift') {
      return localStorage.getItem(`E4F_gift_${key}`) === today;
    }
    if (type === 'spin') {
      return localStorage.getItem(`E4F_spin_${key}`) === today;
    }
    if (type === 'mining') {
      return localStorage.getItem(`E4F_mining_${today}`) === 'done';
    }
  } catch {}
  return false;
}

export async function isDone(type: 'gift' | 'spin' | 'mining', key: string | number, userId?: string): Promise<boolean> {
  // Check localStorage first
  if (isDoneLocal(type, key)) return true;
  if (!userId) return false;

  const today = todayUTC();
  const cleanKey = String(key);

  // Check Supabase user_daily_ads
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('user_daily_ads')
        .select('id')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('type', type)
        .eq('key', cleanKey)
        .maybeSingle();

      if (!error && data) {
        // Cache to localStorage
        if (typeof window !== 'undefined') {
          if (type === 'gift') localStorage.setItem(`E4F_gift_${key}`, today);
          if (type === 'spin') localStorage.setItem(`E4F_spin_${key}`, today);
          if (type === 'mining') localStorage.setItem(`E4F_mining_${today}`, 'done');
        }
        return true;
      }
    } catch (e) {
      console.log('user_daily_ads not ready yet', e);
    }
  }

  // Fallback to server check endpoint
  try {
    const res = await fetch(`/api/ads/anti-fake/daily-status?userId=${encodeURIComponent(userId)}&date=${today}&type=${type}&key=${encodeURIComponent(cleanKey)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.claimed) {
        if (typeof window !== 'undefined') {
          if (type === 'gift') localStorage.setItem(`E4F_gift_${key}`, today);
          if (type === 'spin') localStorage.setItem(`E4F_spin_${key}`, today);
          if (type === 'mining') localStorage.setItem(`E4F_mining_${today}`, 'done');
        }
        return true;
      }
    }
  } catch {}

  return false;
}

// 3. Helper: Save completion to localStorage & Supabase
export async function setDone(type: 'gift' | 'spin' | 'mining', key: string | number, userId?: string): Promise<void> {
  const today = todayUTC();
  const cleanKey = String(key);

  if (typeof window !== 'undefined') {
    try {
      if (type === 'gift') localStorage.setItem(`E4F_gift_${key}`, today);
      if (type === 'spin') localStorage.setItem(`E4F_spin_${key}`, today);
      if (type === 'mining') localStorage.setItem(`E4F_mining_${today}`, 'done');
    } catch {}
  }

  if (userId) {
    if (supabaseClient) {
      try {
        await supabaseClient.from('user_daily_ads').upsert({
          user_id: userId,
          date: today,
          type,
          key: cleanKey,
          done: true,
          created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,type,key,date' });
      } catch (e) {
        console.warn('[setDone Supabase warn]:', e);
      }
    }
  }
}

// 4. Master 100% In-App Ad Engine: showInside(network, id)
export async function showInside(network: 'richads' | 'monetag' | 'onclicka', id: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Initialize Telegram WebApp hooks
  if ((window as any).Telegram?.WebApp) {
    try { (window as any).Telegram.WebApp.ready(); } catch {}
    try { (window as any).Telegram.WebApp.disableVerticalSwipes?.(); } catch {}
  }

  // CRITICAL: Block window.open completely
  const origOpen = window.open;
  (window as any).open = () => null;

  try {
    // -------------------------------------------------------------
    // 1. RICHADS (showRewardedAd)
    // -------------------------------------------------------------
    if (network === 'richads') {
      const ctrl = (window as any).TelegramAdsController;
      if (ctrl) {
        try {
          if (typeof ctrl.showRewardedAd === 'function') {
            const res = await ctrl.showRewardedAd(Number(id));
            return res !== false;
          } else if (typeof ctrl.show === 'function') {
            await ctrl.show({ id: String(id), zone: String(id), placement: String(id) });
            return true;
          } else if (typeof ctrl.showAd === 'function') {
            await ctrl.showAd({ id: String(id), zone: String(id) });
            return true;
          }
        } catch (err) {
          console.warn('[RichAds inside Telegram error]:', err);
          return false;
        }
      }
      return false;
    }

    // -------------------------------------------------------------
    // 2. MONETAG (show_12044377('pop') or showRewardedAd)
    // -------------------------------------------------------------
    if (network === 'monetag') {
      const fn = (window as any).show_12044377;
      if (typeof fn === 'function') {
        try {
          await fn('pop');
          return true;
        } catch (e1) {
          try {
            await fn();
            return true;
          } catch (e2) {
            console.warn('[Monetag pop & fallback failed]:', e2);
            return false;
          }
        }
      } else if (typeof (window as any).showRewardedAd === 'function') {
        try {
          await (window as any).showRewardedAd();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    // -------------------------------------------------------------
    // 3. ONCLICKA (window.initCdTma TMA mode + 30s In-App Modal Overlay)
    // -------------------------------------------------------------
    if (network === 'onclicka') {
      if ((window as any).initCdTma) {
        try {
          const show = await (window as any).initCdTma({ id: String(id) });
          if (typeof show === 'function') {
            await show();
            return true;
          }
        } catch (err) {
          console.warn('[initCdTma in-stream warning]:', err);
        }
      }

      // 100% In-App Fixed Overlay with 30s countdown and disabled Claim button
      return await renderOnclickaInAppOverlay(id);
    }

    return false;
  } finally {
    // Restore window.open
    (window as any).open = origOpen;
  }
}

// In-App OnClickA Fullscreen Modal Overlay (Never external)
function renderOnclickaInAppOverlay(zoneId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById('onclicka-inapp-ad-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'onclicka-inapp-ad-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(7, 11, 20, 0.98);
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      user-select: none;
      -webkit-user-select: none;
    `;

    // Header with timer & close
    const header = document.createElement('div');
    header.style.cssText = `
      height: 52px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(245, 158, 11, 0.2);
      background: #0A0F1D;
    `;

    const timerLabel = document.createElement('div');
    timerLabel.style.cssText = `
      font-size: 13px;
      font-weight: 800;
      color: #F59E0B;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    timerLabel.innerHTML = `⏱️ Watch Ad: <span id="onclicka-countdown" style="color: #fff; font-family: monospace;">30s</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = `
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      font-size: 14px;
      cursor: pointer;
    `;

    header.appendChild(timerLabel);
    header.appendChild(closeBtn);

    // Frame body
    const frameContainer = document.createElement('div');
    frameContainer.style.cssText = `
      flex: 1;
      width: 100%;
      overflow: hidden;
      position: relative;
      background: #000;
    `;

    const iframe = document.createElement('iframe');
    iframe.src = `https://highperformanceformat.com/${zoneId}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: #000;
    `;
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';

    frameContainer.appendChild(iframe);

    // Footer with disabled Claim button until 30s
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: #0A0F1D;
    `;

    const claimBtn = document.createElement('button');
    claimBtn.id = 'onclicka-claim-btn';
    claimBtn.disabled = true;
    claimBtn.innerText = 'Claim Reward (Wait 30s)';
    claimBtn.style.cssText = `
      width: 100%;
      padding: 12px 0;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 900;
      border: none;
      background: #334155;
      color: #94A3B8;
      cursor: not-allowed;
      transition: all 0.2s;
    `;

    footer.appendChild(claimBtn);

    overlay.appendChild(header);
    overlay.appendChild(frameContainer);
    overlay.appendChild(footer);
    document.body.appendChild(overlay);

    let seconds = 30;
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearInterval(timer);
      overlay.remove();
    };

    closeBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    timer = setInterval(() => {
      seconds -= 1;
      const countEl = document.getElementById('onclicka-countdown');
      if (countEl) countEl.innerText = `${seconds}s`;

      if (seconds > 0) {
        claimBtn.innerText = `Claim Reward (Wait ${seconds}s)`;
      } else {
        clearInterval(timer);
        if (countEl) countEl.innerText = 'Completed!';
        claimBtn.disabled = false;
        claimBtn.innerText = 'Claim Reward & Continue';
        claimBtn.style.background = 'linear-gradient(to right, #10B981, #059669)';
        claimBtn.style.color = '#FFFFFF';
        claimBtn.style.cursor = 'pointer';
        claimBtn.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
      }
    }, 1000);

    claimBtn.onclick = () => {
      if (seconds <= 0) {
        cleanup();
        resolve(true);
      }
    };
  });
}

// 5. Anti-Fake Ad Session Management
export interface AntiFakeSession {
  token: string;
  startTime: number;
  adId: string;
}

export async function startAdSession(adId: string, userId: string): Promise<AntiFakeSession> {
  const token = 'e4f_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
  const startTime = Date.now();

  try {
    sessionStorage.setItem('ad_token', token);
  } catch {}

  // Log in Supabase user_ad_logs
  if (supabaseClient && userId) {
    try {
      await supabaseClient.from('user_ad_logs').insert({
        user_id: userId,
        ad_id: adId,
        token,
        started_at: new Date(startTime).toISOString(),
        is_verified: false,
      });
    } catch (e) {
      console.log('Log table not ready yet', e);
    }
  }

  // Log to server as well
  try {
    fetch('/api/ads/anti-fake/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adId, token, startedAt: startTime }),
    }).catch(() => {});
  } catch {}

  return { token, startTime, adId };
}

// 6. Anti-Fake Verification & Reward Crediting
export async function verifyAndGiveReward(
  boxNumOrRemaining: string | number,
  type: 'gift' | 'spin' | 'mining',
  session: AntiFakeSession,
  userId: string
): Promise<{ success: boolean; rewardAmount?: number; error?: string }> {
  const elapsed = Date.now() - session.startTime;

  // 1. Minimum 25-second watch duration requirement
  if (elapsed < 25000) {
    if (supabaseClient && userId) {
      try {
        await supabaseClient.from('user_ad_logs').update({
          is_verified: false,
          watch_duration: Math.round(elapsed / 1000),
          completed_at: new Date().toISOString(),
        }).eq('token', session.token);
      } catch (e) {
        console.log('Log table not ready yet', e);
      }
    }
    alert('Fake Report Detected! Watch 30s');
    return { success: false, error: 'Fake Report Detected! Watch 30s' };
  }

  // 2. Token match check
  let storedToken = '';
  try {
    storedToken = sessionStorage.getItem('ad_token') || '';
  } catch {}

  if (storedToken !== session.token) {
    alert('Fake Report Detected! Invalid session token');
    return { success: false, error: 'Invalid session token' };
  }

  // 3. Daily limit check
  const alreadyDone = await isDone(type, boxNumOrRemaining, userId);
  if (alreadyDone) {
    alert('Already claimed today');
    return { success: false, error: 'Already claimed today' };
  }

  // 4. Server-side authoritative reward call
  try {
    const res = await fetch('/api/ads/anti-fake/verify-and-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type,
        key: String(boxNumOrRemaining),
        token: session.token,
        elapsed,
        adId: session.adId,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Reward verification failed' };
    }

    // Set Done locally and in DB
    await setDone(type, boxNumOrRemaining, userId);

    return {
      success: true,
      rewardAmount: data.rewardAmount || (type === 'gift' ? 2.5 : undefined),
    };
  } catch (err: any) {
    // If backend is momentarily unreachable, try Supabase RPC directly with direct table fallback
    if (supabaseClient && type === 'gift') {
      try {
        await supabaseClient.rpc('add_e4f_balance', {
          p_user_id: userId,
          p_amount: 2.5,
          p_spin_amount: 0,
        });
        await setDone(type, boxNumOrRemaining, userId);
        return { success: true, rewardAmount: 2.5 };
      } catch (rpcErr) {
        console.log('RPC add_e4f_balance failed, using direct profile update fallback', rpcErr);
        try {
          const { data: prof } = await supabaseClient
            .from('profiles')
            .select('e4f_balance')
            .or(`telegram_id.eq.${userId},id.eq.${userId}`)
            .maybeSingle();
          const currentE4F = Number(prof?.e4f_balance || 0);
          await supabaseClient
            .from('profiles')
            .update({ e4f_balance: currentE4F + 2.5 })
            .or(`telegram_id.eq.${userId},id.eq.${userId}`);
          await setDone(type, boxNumOrRemaining, userId);
          return { success: true, rewardAmount: 2.5 };
        } catch (directErr) {
          console.log('Direct profile update failed as well', directErr);
        }
      }
    }
    return { success: false, error: err.message || 'Reward failed' };
  }
}

// 7. Mining Spam Protection: max 5 calls within 10 seconds
const miningCallTimestamps: number[] = [];

export function checkMiningSpam(): boolean {
  const now = Date.now();
  miningCallTimestamps.push(now);

  // Keep timestamps within last 10 seconds
  const cutoff = now - 10000;
  while (miningCallTimestamps.length > 0 && miningCallTimestamps[0] < cutoff) {
    miningCallTimestamps.shift();
  }

  return miningCallTimestamps.length > 5;
}

// 8. Block contextmenu bypass
if (typeof document !== 'undefined') {
  document.addEventListener('contextmenu', (e) => {
    // Disable right click to prevent DevTools inspection bypass
    e.preventDefault();
  });
}

// =========================================================================
// 9. MODULE WATERFALL RUNNERS (Mining, Spin, Gift Box)
// =========================================================================

// --- A. Mystery Gift Box Waterfall ---
export async function openGiftBoxWithWaterfall(
  boxNum: number,
  userId: string,
  onReward?: (reward: number) => void
): Promise<{ success: boolean; error?: string }> {
  // Check if box already claimed today
  const done = await isDone('gift', boxNum, userId);
  if (done) {
    alert('Box already opened today. Resets at UTC 00:00.');
    return { success: false, error: 'Already claimed today' };
  }

  const waterfallTiers = AD_CONFIG.GIFT[boxNum as 1 | 2 | 3 | 4 | 5] || AD_CONFIG.GIFT[1];

  let adCompleted = false;
  let activeSession: AntiFakeSession | null = null;

  for (let i = 0; i < waterfallTiers.length; i++) {
    const tier = waterfallTiers[i];
    console.log(`[Gift Box #${boxNum}] Trying Tier ${i + 1}: ${tier.network} (${tier.id})`);

    // Start Anti-Fake Ad Session
    activeSession = await startAdSession(tier.id, userId);

    const shown = await showInside(tier.network, tier.id);
    if (shown) {
      adCompleted = true;
      break;
    }
    console.warn(`[Gift Box #${boxNum}] Tier ${i + 1} (${tier.network}) failed. Falling back to next...`);
  }

  if (!adCompleted || !activeSession) {
    alert('Ad load failed. Please try again.');
    return { success: false, error: 'All waterfall ad attempts failed.' };
  }

  // Verify and award +2.5 E4F
  const rewardResult = await verifyAndGiveReward(boxNum, 'gift', activeSession, userId);
  if (rewardResult.success) {
    if (onReward) onReward(rewardResult.rewardAmount || 2.5);
    return { success: true };
  } else {
    return { success: false, error: rewardResult.error };
  }
}

// --- B. Spin & Win Lucky Wheel Waterfall ---
export async function handleSpinWithWaterfall(
  remainingKey: string,
  userId: string,
  onAdSuccess?: () => void
): Promise<{ success: boolean; error?: string }> {
  // Check if this spin slot was already claimed today
  const done = await isDone('spin', remainingKey, userId);
  if (done) {
    alert('Spin already claimed for this slot today. Resets at UTC 00:00.');
    return { success: false, error: 'Already claimed today' };
  }

  const tiers = (AD_CONFIG.SPIN as any)[remainingKey] || AD_CONFIG.SPIN['5/5'];

  let adCompleted = false;
  let activeSession: AntiFakeSession | null = null;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    console.log(`[Spin ${remainingKey}] Trying Tier ${i + 1}: ${tier.network} (${tier.id})`);

    activeSession = await startAdSession(tier.id, userId);
    const shown = await showInside(tier.network, tier.id);
    if (shown) {
      adCompleted = true;
      break;
    }
    console.warn(`[Spin ${remainingKey}] Tier ${i + 1} failed. Falling back...`);
  }

  if (!adCompleted || !activeSession) {
    alert('Ad load failed. Please try again.');
    return { success: false, error: 'All waterfall ad attempts failed.' };
  }

  // Verify Anti-fake
  const rewardResult = await verifyAndGiveReward(remainingKey, 'spin', activeSession, userId);
  if (rewardResult.success) {
    if (onAdSuccess) onAdSuccess();
    return { success: true };
  } else {
    return { success: false, error: rewardResult.error };
  }
}

// --- C. Mining Waterfall ---
export async function handleMiningWithWaterfall(
  userId: string,
  onAdSuccess?: () => void
): Promise<{ success: boolean; error?: string }> {
  // Check spam protection: >5 times in 10 sec
  if (checkMiningSpam()) {
    alert('Too many attempts! Please wait 10 seconds before starting mining.');
    return { success: false, error: 'Spam protection triggered' };
  }

  const tiers = AD_CONFIG.MINING;
  let adCompleted = false;
  let activeSession: AntiFakeSession | null = null;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    console.log(`[Mining] Trying Tier ${i + 1}: ${tier.network} (${tier.id})`);

    activeSession = await startAdSession(tier.id, userId);
    const shown = await showInside(tier.network, tier.id);
    if (shown) {
      adCompleted = true;
      break;
    }
    console.warn(`[Mining] Tier ${i + 1} failed. Falling back...`);
  }

  if (!adCompleted || !activeSession) {
    alert('Ad load failed. Please try again.');
    return { success: false, error: 'All waterfall ad attempts failed.' };
  }

  // Verify Anti-fake
  const rewardResult = await verifyAndGiveReward('mining', 'mining', activeSession, userId);
  if (rewardResult.success) {
    if (onAdSuccess) onAdSuccess();
    return { success: true };
  } else {
    return { success: false, error: rewardResult.error };
  }
}
