import { useState, useEffect } from 'react';
import AdInside from './AdInside';
import { getAdForHouse, HouseType } from '../services/adWaterfall';
import { generateAdToken } from '../services/antiFakeAds';

interface AdWaterfallProps {
  house: HouseType | string;
  onAdLoaded?: () => void;
}

export default function AdWaterfall({ house, onAdLoaded }: AdWaterfallProps) {
  const [attempt, setAttempt] = useState(0);
  const ad = getAdForHouse(house as HouseType, attempt);

  const handleFail = () => {
    if (attempt < 2) setAttempt(attempt + 1);
  };

  useEffect(() => {
    generateAdToken();
    if (onAdLoaded) onAdLoaded();
  }, [attempt, onAdLoaded]);

  // If ad not filled in 5 sec, auto try next network in waterfall
  useEffect(() => {
    const timer = setTimeout(() => {
      if (attempt < 2) {
        console.log(`[AdWaterfall] 5s timeout reached for attempt ${attempt}, switching to next network...`);
        setAttempt(prev => prev + 1);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [attempt]);

  return (
    <div className="w-full">
      <AdInside adScript={ad.code} />
      <button style={{ display: 'none' }} onClick={handleFail}>fallback</button>
    </div>
  );
}
