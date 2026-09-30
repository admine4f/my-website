import React, { useState } from 'react';
import { X, Copy, Check, QrCode, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface DepositModalProps {
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [selectedAsset, setSelectedAsset] = useState('USDT');
  const [network, setNetwork] = useState('BEP20');
  const [copied, setCopied] = useState(false);
  const [simAmount, setSimAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [depositsEnabled, setDepositsEnabled] = useState(true);
  const [depositMinUSDT, setDepositMinUSDT] = useState(2.0);
  const [depositFirstBonusUSDT, setDepositFirstBonusUSDT] = useState(10.0);

  React.useEffect(() => {
    api.getPublicSettings()
      .then(data => {
        if (data.success) {
          if (data.depositsEnabled !== undefined) setDepositsEnabled(data.depositsEnabled);
          if (typeof data.depositMinUSDT === 'number') {
            setDepositMinUSDT(data.depositMinUSDT);
            setSimAmount(prev => (parseFloat(prev) < data.depositMinUSDT ? String(data.depositMinUSDT) : prev));
          }
          if (typeof data.depositFirstBonusUSDT === 'number') {
            setDepositFirstBonusUSDT(data.depositFirstBonusUSDT);
          }
        }
      })
      .catch(() => {});
  }, []);

  const uniqueUserBscAddress = user?.depositAddress || '0x63562945f7845aa1130a5b1499720b29788c82db';
  const uniqueUserTrcAddress = 'T' + uniqueUserBscAddress.slice(2, 35);
  const uniqueUserTonAddress = 'EQ' + uniqueUserBscAddress.slice(2, 34);

  const depositAddress =
    network === 'BEP20'
      ? uniqueUserBscAddress
      : network === 'TRC20'
      ? uniqueUserTrcAddress
      : uniqueUserTonAddress;

  const handleCopy = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Address Copied', 'Your unique deposit address copied to clipboard.', 'info');
  };

  const handleConfirmDeposit = async () => {
    if (!user) return;
    if (!depositsEnabled) {
      addToast('Deposit Disabled', 'Open soon.', 'error');
      return;
    }
    const amountVal = parseFloat(simAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      addToast('Invalid Amount', 'Please enter a valid deposit amount.', 'error');
      return;
    }
    if (selectedAsset === 'USDT' && amountVal < depositMinUSDT) {
      addToast('Below Minimum', `Minimum deposit amount is ${depositMinUSDT} USDT.`, 'error');
      return;
    }
    setLoading(true);
    try {
      await api.deposit(user.id, {
        asset: selectedAsset,
        network,
        amount: amountVal,
      });
      addToast('Deposit Credited!', `+${amountVal} ${selectedAsset} credited to Deposit Balance!`, 'success');
      await refreshProfile();
      onClose();
    } catch (err: any) {
      addToast('Deposit Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1324] border border-slate-700 rounded-3xl p-6 text-slate-200 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Deposit Crypto</h3>
        <p className="text-xs text-slate-400 mb-4">Official multi-chain spot deposit</p>

        {/* Asset Selector */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">Asset</label>
          <div className="grid grid-cols-3 gap-2">
            {['USDT', 'BTC', 'ETH'].map(a => (
              <button
                key={a}
                onClick={() => setSelectedAsset(a)}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedAsset === a
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Network Selector */}
        <div className="mb-4">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">Network</label>
          <div className="grid grid-cols-3 gap-2">
            {['TRC20', 'BEP20', 'TON'].map(n => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={`py-1.5 rounded-lg text-xs font-medium ${
                  network === n
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* QR Code Presentation */}
        <div className="flex flex-col items-center p-3 rounded-2xl bg-white p-4 mx-auto w-40 h-40 mb-3 shadow-lg">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${depositAddress}`}
            alt="Deposit QR"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Address */}
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 mb-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
            <span className="text-amber-400 font-semibold">Your Unique Deposit Address ({network})</span>
            <button onClick={handleCopy} className="text-sky-400 font-bold flex items-center gap-1">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="font-mono text-xs text-slate-200 break-all">{depositAddress}</div>
          <div className="text-[10px] text-emerald-400 mt-1">
            ✓ External deposits credit to your Deposit Balance (used to Verify Account).
          </div>
        </div>

        {/* Quick Amount Presets */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          <span className="text-[10px] text-slate-500 font-semibold">Quick Amount:</span>
          {Array.from(new Set([depositMinUSDT, depositMinUSDT === 2 ? 3 : depositMinUSDT + 1, depositMinUSDT === 2 ? 4 : depositMinUSDT + 2, 5, 10, 20]))
            .filter(val => val >= depositMinUSDT)
            .sort((a, b) => a - b)
            .slice(0, 5)
            .map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setSimAmount(String(val))}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  parseFloat(simAmount) === val
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {val} {selectedAsset}
              </button>
            ))}
        </div>

        {/* Simulation / Confirmation Test Input */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="number"
            step="any"
            min={depositMinUSDT}
            value={simAmount}
            onChange={e => setSimAmount(e.target.value)}
            className="w-24 px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white text-center"
            placeholder="Amount"
          />
          <button
            onClick={handleConfirmDeposit}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : `Confirm Deposit (+${simAmount} ${selectedAsset})`}
          </button>
        </div>

        {depositFirstBonusUSDT > 0 && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] text-center mb-2">
            🎁 First Deposit Booster: Deposit ≥ {depositMinUSDT} USDT to automatically receive an instant +{depositFirstBonusUSDT} USDT Spot Bonus!
          </div>
        )}

        <div className="text-[10px] text-slate-500 text-center">
          Minimum deposit: {depositMinUSDT} USDT • BSC / TRC20 • 12 network block confirmations
        </div>
      </div>
    </div>
  );
};
