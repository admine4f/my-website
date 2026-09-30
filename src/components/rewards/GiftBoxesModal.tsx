import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { GiftBox } from '../../types';
import { UnifiedRewardedAdModal } from './UnifiedRewardedAdModal';

interface GiftBoxesModalProps {
  onClose: () => void;
}

const defaultGiftBoxes: GiftBox[] = [
  { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F', rewardAmount: 2.5, color: '#38BDF8', isOpened: false },
  { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT', rewardAmount: 1.5, color: '#A855F7', isOpened: false },
  { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F', rewardAmount: 5.0, color: '#EAB308', isOpened: false },
  { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT', rewardAmount: 3.0, color: '#EF4444', isOpened: false },
  { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F', rewardAmount: 10.0, color: '#10B981', isOpened: false },
];

export const GiftBoxesModal: React.FC<GiftBoxesModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [boxes, setBoxes] = useState<GiftBox[]>(defaultGiftBoxes);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [boxesRemainingToday, setBoxesRemainingToday] = useState<number>(5);
  const [maxDailyBoxes, setMaxDailyBoxes] = useState<number>(5);
  const [adRequired, setAdRequired] = useState<boolean>(true);

  // Selected box waiting for Rewarded Ad completion
  const [adTargetBox, setAdTargetBox] = useState<GiftBox | null>(null);

  const fetchBoxes = async () => {
    if (!user) return;
    try {
      const res = await api.getGiftBoxes(user.id);
      if (res && Array.isArray(res.boxes) && res.boxes.length > 0) {
        setBoxes(res.boxes);
      }
      if (typeof res?.boxesRemainingToday === 'number') {
        setBoxesRemainingToday(res.boxesRemainingToday);
      }
      if (typeof res?.maxDailyBoxes === 'number') {
        setMaxDailyBoxes(res.maxDailyBoxes);
      }
      if (typeof res?.adRequired === 'boolean') {
        setAdRequired(res.adRequired);
      }
    } catch {
      // Keep default boxes
    }
  };

  useEffect(() => {
    fetchBoxes();
  }, [user]);

  const handleBoxClick = (box: GiftBox) => {
    if (!user || openingId || box.isOpened) return;

    if (boxesRemainingToday <= 0) {
      addToast('Daily Limit', 'You have opened all 5 gift boxes for today. Resets tomorrow at 00:00 UTC.', 'info');
      return;
    }

    if (adRequired) {
      setAdTargetBox(box);
    } else {
      executeOpenBox(box.id);
    }
  };

  const handleAdCompleted = (adSessionId: string, claimToken: string) => {
    if (!adTargetBox) return;
    const boxId = adTargetBox.id;
    setAdTargetBox(null);
    executeOpenBox(boxId, adSessionId, claimToken);
  };

  const executeOpenBox = async (boxId: number, adSessionId?: string, claimToken?: string) => {
    if (!user) return;
    setOpeningId(boxId);
    try {
      const res = await api.openGiftBox(user.id, boxId, adSessionId, claimToken);
      if (res.success) {
        addToast(
          'Box Unlocked!',
          `You received +${res.rewardAmount} ${res.rewardAsset}! Credited to your wallet.`,
          'success'
        );
        await fetchBoxes();
        await refreshProfile();
      }
    } catch (err: any) {
      addToast('Box Locked', err.message || 'Could not open box.', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {/* Rewarded Ad Gate Modal */}
      {adTargetBox && user && (
        <UnifiedRewardedAdModal
          userId={user.id}
          actionType="GIFT_BOX"
          targetId={adTargetBox.id}
          title={`Unlock Mystery Gift Box #${adTargetBox.boxNumber}`}
          description="Complete the official rewarded ad to open this mystery box."
          rewardHint={`+${adTargetBox.rewardAmount} ${adTargetBox.rewardAsset}`}
          onComplete={handleAdCompleted}
          onCancel={() => setAdTargetBox(null)}
        />
      )}

      <div className="relative w-full max-w-sm bg-[#0C1326] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-black text-white mb-1">5 Exclusive Mystery Boxes</h3>
        <p className="text-xs text-slate-400 mb-2">Each box requires its own completed rewarded ad</p>

        {/* Counter Badge */}
        <div className="mb-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold">
          <span className="text-slate-400">Available Today:</span>
          <span className={boxesRemainingToday > 0 ? 'text-amber-400 font-bold' : 'text-slate-400 font-semibold'}>
            {boxesRemainingToday} / {maxDailyBoxes}
          </span>
        </div>

        {/* 5 Gift Boxes Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {boxes.map((box) => (
            <div
              key={box.id}
              className={`p-3.5 rounded-2xl border transition-all text-center relative ${
                box.isOpened
                  ? 'bg-slate-900/40 border-slate-800 opacity-60'
                  : 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-lg'
              }`}
            >
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2 shadow-inner"
                style={{ backgroundColor: `${box.color}20`, border: `1px solid ${box.color}50` }}
              >
                <Gift className="w-6 h-6" style={{ color: box.color }} />
              </div>

              <div className="text-xs font-bold text-white mb-0.5">Box {box.boxNumber}</div>
              <div className="text-[10px] text-slate-400 mb-2">{box.name}</div>

              {box.isOpened ? (
                <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Opened (+{box.rewardAmount} {box.rewardAsset})</span>
                </div>
              ) : (
                <button
                  onClick={() => handleBoxClick(box)}
                  disabled={openingId === box.id || boxesRemainingToday <= 0}
                  className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow transition-transform active:scale-95 cursor-pointer"
                >
                  {openingId === box.id ? 'Opening...' : adRequired ? 'Watch Ad & Open' : 'Open Box'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Server-verified one-time ad tokens • Instant wallet crediting</span>
        </div>
      </div>
    </div>
  );
};
