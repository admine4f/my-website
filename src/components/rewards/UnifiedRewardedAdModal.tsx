import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Loader2,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { getAdTargetUrl, DEFAULT_ZONE_ID, DEFAULT_DIRECT_LINK } from '../../services/monetagSdk';
import { loadAdsgramScript } from '../../services/adWaterfall';

// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (10 EDITABLE VARIABLES)
// (Can be edited directly here or dynamically from Admin Control Panel)
// =========================================================================
export let SPIN_01_ADSGRAM = 'spin_01_adsgram';
export let SPIN_02_MONETAG = 'spin_02_monetag';
export let SPIN_03_ONCLICKA = 'spin_03_onclicka';
export let SPIN_04_RICHADS = 'spin_04_richads';
export let SPIN_05_ADEXORA = 'spin_05_adexora';

export let BOX_01_ADSGRAM = 'box_01_adsgram';
export let BOX_02_MONETAG = 'box_02_monetag';
export let BOX_03_ONCLICKA = 'box_03_onclicka';
export let BOX_04_RICHADS = 'box_04_richads';
export let BOX_05_ADEXORA = 'box_05_adexora';

// Mining Waterfall Ad Variables (Configurable from Admin without app updates)
export let MINING_01_ADSGRAM = 'mining_01_adsgram';
export let MINING_02_MONETAG = '11442658';
export let MINING_03_ONCLICKA = 'mining_03_onclicka';
export let MINING_04_RICHADS = 'mining_04_richads';
export let MINING_05_ADEXORA = 'mining_05_adexora';
export let MINING_PRIMARY_NETWORK: 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora' = 'AdsGram';
export let MINING_SECONDARY_NETWORK: 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora' = 'Monetag';
export let MINING_WATERFALL_ENABLED = true;

interface WaterfallTier {
  index: number;
  provider: 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora';
  id: string;
  label: string;
}

interface UnifiedRewardedAdModalProps {
  userId: string;
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX';
  targetId?: number;
  title: string;
  description: string;
  rewardHint?: string;
  durationSeconds?: number;
  onComplete: (adSessionId: string, claimToken: string) => void;
  onCancel: () => void;
}

const DEFAULT_WATCH_SECONDS = 30;

export const UnifiedRewardedAdModal: React.FC<UnifiedRewardedAdModalProps> = ({
  userId,
  actionType,
  targetId,
  title,
  description,
  rewardHint,
  durationSeconds,
  onComplete,
  onCancel,
}) => {
  const initialDuration = durationSeconds || DEFAULT_WATCH_SECONDS;
  const [requiredWatchSeconds, setRequiredWatchSeconds] = useState<number>(initialDuration);
  const requiredWatchSecondsRef = useRef<number>(initialDuration);
  const [step, setStep] = useState<
    'INITIALIZING' | 'READY' | 'WATCHING' | 'EARLY_EXIT' | 'COMPLETED' | 'VERIFYING' | 'ALL_FAILED' | 'ERROR'
  >('INITIALIZING');

  const [adSession, setAdSession] = useState<{
    sessionId: string;
    token: string;
    zoneId: string;
    directLink: string;
  } | null>(null);

  // Waterfall Tiers & Current Index
  const [tiers, setTiers] = useState<WaterfallTier[]>([]);
  const [tierIndex, setTierIndex] = useState<number>(0);
  const [tierFailReason, setTierFailReason] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsWatched, setSecondsWatched] = useState<number>(0);

  const watchStartTimeRef = useRef<number | null>(null);
  const totalWatchedSecondsRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const hasStartedRef = useRef<boolean>(false);

  // 1. Initialize Waterfall Tiers & Ad Session
  useEffect(() => {
    isMountedRef.current = true;

    async function initWaterfallAndSession() {
      try {
        setStep('INITIALIZING');
        setErrorMsg(null);
        setTierFailReason(null);
        setSecondsWatched(0);
        totalWatchedSecondsRef.current = 0;
        watchStartTimeRef.current = null;
        hasStartedRef.current = false;

        // Fetch dynamic admin settings for all waterfall variables
        try {
          const pub = await api.getPublicSettings();
          if (pub) {
            if ((pub as any).spin_01_adsgram) SPIN_01_ADSGRAM = (pub as any).spin_01_adsgram;
            if ((pub as any).spin_02_monetag) SPIN_02_MONETAG = (pub as any).spin_02_monetag;
            if ((pub as any).spin_03_onclicka) SPIN_03_ONCLICKA = (pub as any).spin_03_onclicka;
            if ((pub as any).spin_04_richads) SPIN_04_RICHADS = (pub as any).spin_04_richads;
            if ((pub as any).spin_05_adexora) SPIN_05_ADEXORA = (pub as any).spin_05_adexora;

            if ((pub as any).box_01_adsgram) BOX_01_ADSGRAM = (pub as any).box_01_adsgram;
            if ((pub as any).box_02_monetag) BOX_02_MONETAG = (pub as any).box_02_monetag;
            if ((pub as any).box_03_onclicka) BOX_03_ONCLICKA = (pub as any).box_03_onclicka;
            if ((pub as any).box_04_richads) BOX_04_RICHADS = (pub as any).box_04_richads;
            if ((pub as any).box_05_adexora) BOX_05_ADEXORA = (pub as any).box_05_adexora;

            if ((pub as any).mining_01_adsgram) MINING_01_ADSGRAM = (pub as any).mining_01_adsgram;
            if ((pub as any).mining_02_monetag) MINING_02_MONETAG = (pub as any).mining_02_monetag;
            if ((pub as any).mining_03_onclicka) MINING_03_ONCLICKA = (pub as any).mining_03_onclicka;
            if ((pub as any).mining_04_richads) MINING_04_RICHADS = (pub as any).mining_04_richads;
            if ((pub as any).mining_05_adexora) MINING_05_ADEXORA = (pub as any).mining_05_adexora;
            if ((pub as any).miningPrimaryNetwork) MINING_PRIMARY_NETWORK = (pub as any).miningPrimaryNetwork;
            if ((pub as any).miningSecondaryNetwork) MINING_SECONDARY_NETWORK = (pub as any).miningSecondaryNetwork;
            if ((pub as any).miningWaterfallEnabled !== undefined) MINING_WATERFALL_ENABLED = (pub as any).miningWaterfallEnabled;

            let dur = 30;
            if (actionType === 'MINING') {
              dur = Number((pub as any).miningAdDurationSeconds || (pub as any).adMiningDurationSeconds || 30);
            } else if (actionType === 'SPIN') {
              dur = Number((pub as any).spinAdDurationSeconds || 30);
            } else if (actionType === 'GIFT_BOX') {
              dur = Number((pub as any).giftBoxAdDurationSeconds || 30);
            }
            if (dur && dur > 0) {
              setRequiredWatchSeconds(dur);
              requiredWatchSecondsRef.current = dur;
            }
          }
        } catch (e) {
          console.warn('Could not sync dynamic waterfall settings, using defaults:', e);
        }

        const isTg = typeof window !== 'undefined' && Boolean((window as any).Telegram?.WebApp?.initData);

        // Construct 5 Waterfall Tiers
        let computedTiers: WaterfallTier[] = [];
        if (actionType === 'SPIN') {
          computedTiers = isTg ? [
            { index: 1, provider: 'AdsGram', id: SPIN_01_ADSGRAM, label: 'AdsGram' },
            { index: 2, provider: 'Monetag', id: SPIN_02_MONETAG, label: 'Monetag' },
            { index: 3, provider: 'OnClickA', id: SPIN_03_ONCLICKA, label: 'OnClickA' },
            { index: 4, provider: 'RichAds', id: SPIN_04_RICHADS, label: 'RichAds' },
            { index: 5, provider: 'Adexora', id: SPIN_05_ADEXORA, label: 'Adexora' },
          ] : [
            { index: 1, provider: 'Monetag', id: SPIN_02_MONETAG, label: 'Monetag' },
            { index: 2, provider: 'OnClickA', id: SPIN_03_ONCLICKA, label: 'OnClickA' },
            { index: 3, provider: 'RichAds', id: SPIN_04_RICHADS, label: 'RichAds' },
            { index: 4, provider: 'Adexora', id: SPIN_05_ADEXORA, label: 'Adexora' },
            { index: 5, provider: 'AdsGram', id: SPIN_01_ADSGRAM, label: 'AdsGram' },
          ];
        } else if (actionType === 'GIFT_BOX') {
          computedTiers = isTg ? [
            { index: 1, provider: 'AdsGram', id: BOX_01_ADSGRAM, label: 'AdsGram' },
            { index: 2, provider: 'Monetag', id: BOX_02_MONETAG, label: 'Monetag' },
            { index: 3, provider: 'OnClickA', id: BOX_03_ONCLICKA, label: 'OnClickA' },
            { index: 4, provider: 'RichAds', id: BOX_04_RICHADS, label: 'RichAds' },
            { index: 5, provider: 'Adexora', id: BOX_05_ADEXORA, label: 'Adexora' },
          ] : [
            { index: 1, provider: 'Monetag', id: BOX_02_MONETAG, label: 'Monetag' },
            { index: 2, provider: 'OnClickA', id: BOX_03_ONCLICKA, label: 'OnClickA' },
            { index: 3, provider: 'RichAds', id: BOX_04_RICHADS, label: 'RichAds' },
            { index: 4, provider: 'Adexora', id: BOX_05_ADEXORA, label: 'Adexora' },
            { index: 5, provider: 'AdsGram', id: BOX_01_ADSGRAM, label: 'AdsGram' },
          ];
        } else if (actionType === 'MINING') {
          const miningMap: Record<'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora', { provider: 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora'; id: string; label: string }> = {
            'AdsGram': { provider: 'AdsGram', id: MINING_01_ADSGRAM, label: 'AdsGram' },
            'Monetag': { provider: 'Monetag', id: MINING_02_MONETAG, label: 'Monetag' },
            'OnClickA': { provider: 'OnClickA', id: MINING_03_ONCLICKA, label: 'OnClickA' },
            'RichAds': { provider: 'RichAds', id: MINING_04_RICHADS, label: 'RichAds' },
            'Adexora': { provider: 'Adexora', id: MINING_05_ADEXORA, label: 'Adexora' },
          };

          let pNet = MINING_PRIMARY_NETWORK || 'AdsGram';
          if (!isTg && pNet === 'AdsGram') {
            pNet = 'Monetag'; // On web browsers / Netlify, Monetag works reliably
          }
          const sNet = (MINING_SECONDARY_NETWORK && MINING_SECONDARY_NETWORK !== pNet)
            ? MINING_SECONDARY_NETWORK
            : (pNet === 'Monetag' ? 'AdsGram' : 'Monetag');

          const tierSequence: Array<{ provider: 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora'; id: string; label: string }> = [];
          tierSequence.push(miningMap[pNet] || miningMap['Monetag']);

          if (MINING_WATERFALL_ENABLED) {
            tierSequence.push(miningMap[sNet] || miningMap['OnClickA']);
            const used = new Set(tierSequence.map(t => t.provider));
            const allOrder: Array<'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora'> = isTg
              ? ['AdsGram', 'Monetag', 'OnClickA', 'RichAds', 'Adexora']
              : ['Monetag', 'OnClickA', 'RichAds', 'Adexora', 'AdsGram'];
            for (const n of allOrder) {
              if (!used.has(n)) {
                tierSequence.push(miningMap[n]);
                used.add(n);
              }
            }
          }

          computedTiers = tierSequence.map((t, idx) => ({
            index: idx + 1,
            provider: t.provider,
            id: t.id,
            label: idx === 0 ? `${t.label} (Primary)` : idx === 1 ? `${t.label} (Secondary)` : `${t.label} (Fallback ${idx + 1})`,
          }));
        } else {
          // Default fallback
          computedTiers = [
            { index: 1, provider: 'Monetag', id: DEFAULT_ZONE_ID, label: 'Monetag' },
            { index: 2, provider: 'AdsGram', id: 'adsgram_default', label: 'AdsGram' },
          ];
        }

        setTiers(computedTiers);
        setTierIndex(0);

        // Preload AdsGram script if on tier 1
        loadAdsgramScript().catch(() => {});

        // Create authoritative backend session
        const session = await api.createUniversalAdSession(userId, actionType, targetId);
        if (!isMountedRef.current) return;

        if (session.durationSeconds && session.durationSeconds > 0) {
          setRequiredWatchSeconds(session.durationSeconds);
          requiredWatchSecondsRef.current = session.durationSeconds;
        }

        setAdSession({
          sessionId: session.sessionId,
          token: session.token,
          zoneId: session.zoneId || DEFAULT_ZONE_ID,
          directLink: session.directLink || DEFAULT_DIRECT_LINK,
        });

        setStep('READY');
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setStep('ERROR');
        setErrorMsg(err.message || 'Failed to initialize ad session.');
      }
    }

    initWaterfallAndSession();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, actionType, targetId]);

  // Safe Cancellation
  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (adSession) {
      api.cancelAdSession(adSession.sessionId, adSession.token, userId);
    }
    onCancel();
  }, [adSession, userId, onCancel]);

  // Listen to browser / Android back button (`popstate`)
  useEffect(() => {
    const handlePopState = () => {
      handleCancel();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleCancel]);

  // Waterfall Fallback Trigger: Called whenever an ad network fails
  const advanceWaterfall = useCallback(
    (reason: string) => {
      if (!isMountedRef.current) return;
      if (timerRef.current) clearInterval(timerRef.current);

      const nextIndex = tierIndex + 1;
      console.warn(`[Waterfall] Tier ${tierIndex + 1} (${tiers[tierIndex]?.provider}) failed: ${reason}.`);

      if (nextIndex < tiers.length) {
        setTierIndex(nextIndex);
        setTierFailReason('Connecting to alternative sponsored stream...');
        setSecondsWatched(0);
        totalWatchedSecondsRef.current = 0;
        watchStartTimeRef.current = null;
        hasStartedRef.current = false;
        setStep('READY');

        // Clear warning message after 3.5 seconds
        setTimeout(() => {
          if (isMountedRef.current) setTierFailReason(null);
        }, 3500);
      } else {
        // ALL 5 AD NETWORKS FAILED!
        setStep('ALL_FAILED');
      }
    },
    [tierIndex, tiers]
  );

  // Monitor Tab Visibility / App Minimize (for external watch ad tabs)
  const currentBurstStartTimeRef = useRef<number | null>(null);
  const isVerifyingRef = useRef<boolean>(false);
  const triggerAutoClaimRef = useRef<() => void>(() => {});
  const stepRef = useRef(step);
  stepRef.current = step;

  // Pause watching if user leaves tab, switches window, or minimizes
  const pauseAdWatching = useCallback(() => {
    if (stepRef.current !== 'WATCHING' || !currentBurstStartTimeRef.current) return;
    const targetSec = requiredWatchSecondsRef.current || DEFAULT_WATCH_SECONDS;
    const burstElapsed = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
    const accumulated = Math.min(targetSec, totalWatchedSecondsRef.current + burstElapsed);

    totalWatchedSecondsRef.current = accumulated;
    setSecondsWatched(accumulated);
    currentBurstStartTimeRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (accumulated >= targetSec) {
      setStep('COMPLETED');
      triggerAutoClaimRef.current();
    } else {
      // User switched tabs or left before 30s: pause timer at watched seconds and show remaining seconds!
      setStep('EARLY_EXIT');
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pauseAdWatching();
      } else if (document.visibilityState === 'visible') {
        if (stepRef.current === 'WATCHING' && currentBurstStartTimeRef.current) {
          const targetSec = requiredWatchSecondsRef.current || DEFAULT_WATCH_SECONDS;
          const burstElapsed = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
          const accumulated = Math.min(targetSec, totalWatchedSecondsRef.current + burstElapsed);
          totalWatchedSecondsRef.current = accumulated;
          setSecondsWatched(accumulated);

          if (accumulated >= targetSec) {
            currentBurstStartTimeRef.current = null;
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setStep('COMPLETED');
            triggerAutoClaimRef.current();
          } else {
            // User returned before completing full duration -> pause at watched time!
            currentBurstStartTimeRef.current = null;
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setStep('EARLY_EXIT');
          }
        }
      }
    };

    const handleWindowBlur = () => {
      pauseAdWatching();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [pauseAdWatching]);

  // 4. User Clicks "Watch Ad Now"
  const handleWatchAdClick = async (e?: React.MouseEvent) => {
    if (!adSession || tiers.length === 0) return;
    const currentTier = tiers[tierIndex] || tiers[0];
    setErrorMsg(null);

    // =========================================================
    // CASE A: ADSGRAM TIER (Native Telegram Mini App Video Ad)
    // =========================================================
    if (currentTier.provider === 'AdsGram') {
      setStep('WATCHING');
      try {
        const scriptLoaded = await loadAdsgramScript();
        const adsgramObj = (window as any).Adsgram;

        if (scriptLoaded && adsgramObj && typeof adsgramObj.init === 'function') {
          // Initialize AdsGram controller with block ID
          const AdController = adsgramObj.init({ blockId: currentTier.id, debug: false });
          const res = await AdController.show();

          if (res && res.done) {
            // Adsgram completed successfully!
            handleClaimReward(`ADSGRAM_${currentTier.id}_COMPLETED`);
            return;
          } else {
            advanceWaterfall('AdsGram ad playback was skipped or closed.');
            return;
          }
        } else {
          // Adsgram script not supported or blocked in current environment
          advanceWaterfall('Adsgram SDK not available in this client.');
          return;
        }
      } catch (err: any) {
        advanceWaterfall(err.message || 'AdsGram ad request failed.');
        return;
      }
    }

    // =========================================================
    // CASE B: MONETAG, ONCLICKA, RICHADS, ADEXORA (30s Rewarded)
    // =========================================================
    const now = Date.now();
    currentBurstStartTimeRef.current = now;

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      api.startAdWatching(adSession.sessionId, adSession.token, userId).catch(console.warn);
    }

    // Determine target URL for the active network
    let targetUrl = adSession.directLink;
    if (currentTier.provider === 'Monetag') {
      const customId = currentTier.id;
      targetUrl = customId && customId.startsWith('http') ? customId : getAdTargetUrl(adSession.directLink, customId || adSession.zoneId);
    } else if (currentTier.provider === 'OnClickA') {
      const customId = currentTier.id;
      targetUrl = customId && customId.startsWith('http') ? customId : `https://onclicka.com/zone/${customId || 'onclicka_direct'}`;
    } else if (currentTier.provider === 'RichAds') {
      const customId = currentTier.id;
      targetUrl = customId && customId.startsWith('http') ? customId : `https://richads.com/zone/${customId || 'richads_direct'}`;
    } else if (currentTier.provider === 'Adexora') {
      const customId = currentTier.id;
      targetUrl = customId && customId.startsWith('http') ? customId : `https://adexora.com/zone/${customId || 'adexora_direct'}`;
    }

    // Open ad window
    if (typeof window !== 'undefined') {
      if ((window as any).Telegram?.WebApp?.openLink) {
        if (e) e.preventDefault();
        try {
          (window as any).Telegram.WebApp.openLink(targetUrl);
        } catch {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    }

    setStep('WATCHING');

    // Run active tick
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!currentBurstStartTimeRef.current || !isMountedRef.current) return;

      const targetSec = requiredWatchSecondsRef.current || DEFAULT_WATCH_SECONDS;
      const currentBurst = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
      const total = Math.min(targetSec, totalWatchedSecondsRef.current + currentBurst);
      setSecondsWatched(total);

      if (total >= targetSec) {
        clearInterval(timerRef.current);
        totalWatchedSecondsRef.current = targetSec;
        setStep('COMPLETED');
        triggerAutoClaimRef.current();
      }
    }, 500);
  };

  // 5. Authoritative Backend Verification & Claim
  const handleClaimReward = async (customSignal?: string) => {
    if (!adSession || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    try {
      setStep('VERIFYING');
      setErrorMsg(null);

      const currentTier = tiers[tierIndex] || tiers[0];
      const signalToSubmit = customSignal || `WATERFALL_${currentTier?.provider}_${currentTier?.id}_COMPLETED`;

      const verifyRes = await api.completeUniversalAdSession(
        adSession.sessionId,
        adSession.token,
        userId,
        actionType,
        targetId,
        signalToSubmit
      );

      if (verifyRes.verified && verifyRes.claimToken) {
        setStep('COMPLETED');
        if (isMountedRef.current) {
          onComplete(adSession.sessionId, verifyRes.claimToken);
        }
      } else {
        isVerifyingRef.current = false;
        advanceWaterfall('Server could not validate ad completion signal.');
      }
    } catch (err: any) {
      isVerifyingRef.current = false;
      if (!isMountedRef.current) return;
      setStep('EARLY_EXIT');
      setErrorMsg(err.message || `Verification failed. Full ${requiredWatchSecondsRef.current || DEFAULT_WATCH_SECONDS}s watch required.`);
    }
  };

  triggerAutoClaimRef.current = () => handleClaimReward();

  const currentTier = tiers[tierIndex] || tiers[0];
  const targetWatchSeconds = requiredWatchSeconds || DEFAULT_WATCH_SECONDS;
  const remainingSeconds = Math.max(0, targetWatchSeconds - secondsWatched);
  const progressPercent = Math.min(100, Math.round((secondsWatched / targetWatchSeconds) * 100));

  // Determine current Tier target ad URL
  let activeAdUrl = '#';
  if (adSession && currentTier) {
    if (currentTier.provider === 'Monetag') {
      const customId = currentTier.id;
      activeAdUrl = customId && customId.startsWith('http') ? customId : getAdTargetUrl(adSession.directLink, customId || adSession.zoneId);
    } else if (currentTier.provider === 'OnClickA') {
      const customId = currentTier.id;
      activeAdUrl = customId && customId.startsWith('http') ? customId : `https://onclicka.com/zone/${customId || 'onclicka_direct'}`;
    } else if (currentTier.provider === 'RichAds') {
      const customId = currentTier.id;
      activeAdUrl = customId && customId.startsWith('http') ? customId : `https://richads.com/zone/${customId || 'richads_direct'}`;
    } else if (currentTier.provider === 'Adexora') {
      const customId = currentTier.id;
      activeAdUrl = customId && customId.startsWith('http') ? customId : `https://adexora.com/zone/${customId || 'adexora_direct'}`;
    } else {
      activeAdUrl = adSession.directLink;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1326] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/20 blur-2xl pointer-events-none" />

        {/* Close Button */}
        {step !== 'VERIFYING' && (
          <button
            onClick={handleCancel}
            title="Cancel and Exit"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}



        {/* Modal Title */}
        <h3 className="text-lg font-black text-white mb-1 mt-1">{title}</h3>
        <p className="text-xs text-slate-400 mb-2">{description}</p>

        {rewardHint && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-center gap-1.5">
            <span className="text-amber-400 font-bold">Reward:</span>
            <span>{rewardHint}</span>
          </div>
        )}

        {/* Fallback Banner Notice */}
        {tierFailReason && (
          <div className="mb-3 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1.5 animate-in fade-in">
            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
            <span>{tierFailReason}</span>
          </div>
        )}

        {/* STATE: INITIALIZING */}
        {step === 'INITIALIZING' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-xs text-slate-300 font-medium">Loading ad...</div>
          </div>
        )}

        {/* STATE: READY */}
        {step === 'READY' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Play className="w-8 h-8 fill-amber-400 ml-0.5" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                WATCH FULL ADS TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                WATCH FULL ADS TO UNLOCK REWARD
              </div>
            </div>

            <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
              Tap below to watch the video and claim your reward.
            </p>

            {/* Watch Ad Button */}
            {currentTier?.provider === 'AdsGram' ? (
              <button
                onClick={() => handleWatchAdClick()}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Watch Video Ad</span>
              </button>
            ) : (
              <a
                href={activeAdUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWatchAdClick}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Watch Video Ad ({targetWatchSeconds}s)</span>
              </a>
            )}
          </div>
        )}

        {/* STATE: WATCHING */}
        {step === 'WATCHING' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Play className="w-7 h-7 fill-amber-400 animate-pulse ml-0.5" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                WATCH FULL ADS TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
                AD IN PROGRESS • COUNTDOWN RUNNING
              </div>
            </div>

            {/* Live Watch Timer Card */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Ad Watch Time:</span>
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {remainingSeconds > 0 ? `${remainingSeconds}s remaining` : `${targetWatchSeconds}s Completed!`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[10px] text-slate-400 pt-1">
                Please remain on the ad window until the timer completes.
              </p>
            </div>

            {/* Re-open / Return to Ad button */}
            {currentTier?.provider !== 'AdsGram' && (
              <a
                href={activeAdUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWatchAdClick}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Return to Ad Window</span>
              </a>
            )}

            {/* Manual next network fallback if stuck */}
            {tierIndex < tiers.length - 1 && (
              <button
                onClick={() => advanceWaterfall('User skipped blocked ad')}
                className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
              >
                Ad blocked or stuck? Try next ad
              </button>
            )}
          </div>
        )}

        {/* STATE: EARLY_EXIT */}
        {step === 'EARLY_EXIT' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                AD WATCH PAUSED
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                Watched <span className="text-amber-400 font-bold">{secondsWatched}s</span> of {targetWatchSeconds}s required.
              </div>
            </div>

            {errorMsg && <p className="text-[11px] text-amber-400 px-2">{errorMsg}</p>}

            <a
              href={activeAdUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWatchAdClick}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Continue Watching Ad ({remainingSeconds}s remaining)</span>
            </a>

            {tierIndex < tiers.length - 1 && (
              <button
                onClick={() => advanceWaterfall('Ad playback incomplete')}
                className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                Try next ad
              </button>
            )}
          </div>
        )}

        {/* STATE: COMPLETED */}
        {step === 'COMPLETED' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-emerald-400 uppercase tracking-wide">
                FULL 30S AD COMPLETED!
              </div>
              <div className="text-xs text-slate-300">
                Ad completed and verified.
              </div>
            </div>

            <button
              onClick={() => handleClaimReward()}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Claim Verified Reward Now</span>
            </button>
          </div>
        )}

        {/* STATE: VERIFYING */}
        {step === 'VERIFYING' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <div className="text-xs text-emerald-300 font-bold">Verifying Full Ad Watch on Server...</div>
            <div className="text-[10px] text-slate-400">Securing your reward tokens...</div>
          </div>
        )}

        {/* STATE: ALL_FAILED -> RULE: If all ads fail, show "No Ads Available, Try Again Later" */}
        {step === 'ALL_FAILED' && (
          <div className="py-4 flex flex-col items-center justify-center gap-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-black text-amber-400 uppercase tracking-wide">
                No Ads Available, Try Again Later
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed px-2">
                No sponsored ads could be loaded at this moment. Please try again later.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full pt-1">
              <button
                onClick={() => {
                  setTierIndex(0);
                  setStep('READY');
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                onClick={handleCancel}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* STATE: ERROR */}
        {step === 'ERROR' && (
          <div className="py-4 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-xs text-rose-300 font-semibold px-2">
              {errorMsg || 'Failed to complete ad verification.'}
            </div>

            <button
              onClick={() => advanceWaterfall('Ad error occurred')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer block"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
