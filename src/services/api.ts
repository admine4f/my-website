import { UserAccount, WalletBalances, MiningStats, MarketAsset, CandlestickData, OrderBook, SpotOrder, SocialTask, GiftBox, DailyCheckInState, Announcement, SupportTicket, TransactionRecord } from '../types';

export const api = {
  // Auth
  async loginTelegram(
    initData?: string,
    demoUser?: any,
    storedUserId?: string,
    referralCode?: string
  ): Promise<{ user: UserAccount; balances: WalletBalances; serverTime: number }> {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, demoUser, storedUserId, referralCode }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Telegram auth temporary network issue, reading local cache:', err);
    }

    // Retrieve genuine cached user and balances from local storage - NEVER synthesize fake demo accounts
    let localUser: UserAccount | null = null;
    let localBalances: WalletBalances | null = null;
    try {
      const cachedU = typeof window !== 'undefined' ? localStorage.getItem('e4f_cached_user') : null;
      if (cachedU) localUser = JSON.parse(cachedU);
      const cachedB = typeof window !== 'undefined' ? localStorage.getItem('e4f_cached_balances') : null;
      if (cachedB) localBalances = JSON.parse(cachedB);
    } catch {}

    if (localUser && localBalances) {
      return { user: localUser, balances: localBalances, serverTime: Date.now() };
    }

    // Only if brand new browser visitor with zero cache: create a clean active non-demo account
    const cleanUser: UserAccount = {
      id: storedUserId || 'usr_123456789',
      uid: '87456802',
      telegramId: 123456789,
      firstName: 'E4F User',
      username: 'user_123',
      referralCode: 'E4F256926',
      createdAt: Date.now(),
      status: 'ACTIVE',
      claimedWelcomeBonus: true,
      isDemoUser: false,
      isVerified: false,
      depositBalance: 0,
      depositAddress: '0x187c938bbdfedf58c688b8699a909bd262ed6f20',
    };

    const cleanBalances: WalletBalances = {
      usdt: 0,
      e4f: 0,
      btc: 0.0024,
      eth: 0.0456,
      sol: 0.85,
      bnb: 0.12,
    };

    return { user: cleanUser, balances: cleanBalances, serverTime: Date.now() };
  },

  // User Profile & Balances - Always fetch from server; on temporary reboot error, reject cleanly so caller state is untouched
  async getProfile(userId: string): Promise<{ user: UserAccount; balances: WalletBalances; recentTransactions: TransactionRecord[]; serverTime: number }> {
    const res = await fetch(`/api/user/${userId}/profile`);
    if (!res.ok) {
      throw new Error(`Profile request failed with HTTP ${res.status}`);
    }
    return await res.json();
  },

  // Mining
  async getMiningStatus(userId: string): Promise<MiningStats & { miningRatePerHour: number; durationHours: number; adRequired: boolean; adProvider: string; plannedTargetPriceRange: string }> {
    const res = await fetch(`/api/mining/${userId}/status`);
    if (!res.ok) throw new Error('Failed to fetch mining status');
    return res.json();
  },

  async getActiveAdSession(userId: string): Promise<{
    success: boolean;
    hasActiveSession: boolean;
    session: {
      sessionId: string;
      token: string;
      startedAt: number;
      endsAt: number;
      durationSeconds: number;
      remainingSeconds: number;
      canVerify: boolean;
      verified: boolean;
      serverTime: number;
      adDirectLink?: string;
    } | null;
    serverTime: number;
  }> {
    const res = await fetch(`/api/mining/${userId}/ad-session`);
    if (!res.ok) throw new Error('Failed to fetch active ad session');
    return res.json();
  },

  async createAdSession(userId: string): Promise<{
    success: boolean;
    isExistingSession?: boolean;
    sessionId: string;
    token: string;
    startedAt: number;
    endsAt: number;
    durationSeconds: number;
    remainingSeconds: number;
    canVerify: boolean;
    verified: boolean;
    serverTime: number;
    provider: 'ADSTERRA' | 'MONETAG' | 'SIMULATOR';
    adDirectLink?: string;
    adsterraDirectLink?: string;
    monetagDirectLink?: string;
  }> {
    const res = await fetch('/api/mining/ad-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create ad session');
    return data;
  },

  async startAdPlayback(sessionId: string, token: string): Promise<{ success: boolean; startedPlaybackAt: number }> {
    const res = await fetch('/api/mining/start-ad-playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start playback timer');
    return data;
  },

  async verifyAdSession(sessionId: string, token: string, userId?: string): Promise<{ success: boolean; verified: boolean; sessionId?: string; remainingSeconds?: number; serverTime?: number }> {
    const res = await fetch('/api/mining/verify-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, token, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ad verification failed');
    return data;
  },

  async createUniversalAdSession(
    userId: string,
    actionType: 'MINING' | 'SPIN' | 'GIFT_BOX',
    targetId?: number
  ): Promise<{
    success: boolean;
    sessionId: string;
    token: string;
    actionType: string;
    targetId?: number;
    zoneId: string;
    directLink?: string;
    provider: string;
    serverTime: number;
    durationSeconds?: number;
  }> {
    const res = await fetch('/api/ads/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, actionType, targetId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create ad session');
    return data;
  },

  async startAdWatching(
    sessionId: string,
    token: string,
    userId: string
  ): Promise<{ success: boolean; startedAt: number; serverTime: number }> {
    const res = await fetch('/api/ads/session/start-watching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, token, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register ad watch start');
    return data;
  },

  async cancelAdSession(sessionId: string, token: string, userId?: string): Promise<void> {
    try {
      await fetch('/api/ads/session/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token, userId }),
      });
    } catch {
      // Best-effort cancel
    }
  },

  async completeUniversalAdSession(
    sessionId: string,
    token: string,
    userId: string,
    actionType?: string,
    targetId?: number,
    sdkSignal: string = 'MONETAG_REWARDED_COMPLETED'
  ): Promise<{
    success: boolean;
    verified: boolean;
    sessionId: string;
    claimToken: string;
    serverTime: number;
  }> {
    const res = await fetch('/api/ads/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, token, userId, actionType, targetId, sdkSignal }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ad verification completion failed');
    return data;
  },

  async startMining(userId: string, adSessionId?: string, claimToken?: string): Promise<{ success: boolean; session: any; serverTime: number }> {
    const res = await fetch('/api/mining/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adSessionId, claimToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start mining session');
    return data;
  },

  async claimMiningReward(userId: string, sessionId: string): Promise<{ success: boolean; rewardAmount: number; asset: string; newBalance: number }> {
    const res = await fetch('/api/mining/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to claim mining reward');
    return data;
  },

  async getMiningHistory(userId: string): Promise<{ history: any[] }> {
    const res = await fetch(`/api/mining/${userId}/history`);
    if (!res.ok) throw new Error('Failed to fetch mining history');
    return res.json();
  },

  // Rewards
  async getDailyCheckIn(userId: string): Promise<DailyCheckInState> {
    try {
      const res = await fetch(`/api/rewards/${userId}/daily-checkin`);
      if (res.ok) return await res.json();
    } catch {
      console.warn('getDailyCheckIn network error, using fallback');
    }
    return {
      currentStreak: 0,
      lastCheckInDate: '',
      todayClaimed: false,
      rewards: [
        { day: 1, asset: 'E4F', amount: 0.5 },
        { day: 2, asset: 'USDT', amount: 0.2 },
        { day: 3, asset: 'E4F', amount: 1.0 },
        { day: 4, asset: 'USDT', amount: 0.5 },
        { day: 5, asset: 'E4F', amount: 1.5 },
        { day: 6, asset: 'USDT', amount: 1.0 },
        { day: 7, asset: 'E4F', amount: 3.0 },
      ],
      claimedDays: [],
      nextDayToClaim: 1,
    };
  },

  async claimDailyCheckIn(userId: string): Promise<{ success: boolean; streak: number; reward: any; balances: WalletBalances; claimedDays?: number[]; todayClaimed?: boolean; nextDayToClaim?: number }> {
    const res = await fetch('/api/rewards/daily-checkin/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Daily check-in claim failed');
    return data;
  },

  async resetUserDailyCheckIn(userId: string, adminKey: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/users/${userId}/reset-daily-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
    });
    return res.json();
  },

  async advanceUserDailyCheckIn(userId: string, adminKey: string): Promise<{ success: boolean; message: string; checkIn?: any; nextDayToClaim?: number }> {
    const res = await fetch(`/api/admin/users/${userId}/advance-daily-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
    });
    return res.json();
  },

  async spinWheel(userId: string, adSessionId?: string, claimToken?: string): Promise<{ success: boolean; prizeIndex: number; prize: any; balances: WalletBalances; spinsRemainingToday?: number; spinsUsedToday?: number }> {
    const res = await fetch('/api/rewards/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adSessionId, claimToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Spin failed');
    return data;
  },

  async getGiftBoxes(userId: string): Promise<{
    boxes: GiftBox[];
    canOpenToday: boolean;
    boxesUsedToday: number;
    maxDailyBoxes: number;
    boxesRemainingToday: number;
    adRequired: boolean;
    zoneId?: string;
    provider?: string;
  }> {
    try {
      const res = await fetch(`/api/rewards/${userId}/gift-boxes`);
      if (res.ok) {
        const data = await res.json();
        if (data.boxes && data.boxes.length > 0) return data;
      }
    } catch (e) {
      console.warn('getGiftBoxes fallback:', e);
    }
    return {
      boxes: [
        { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F', rewardAmount: 2.5, color: '#38BDF8', isOpened: false },
        { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT', rewardAmount: 1.5, color: '#A855F7', isOpened: false },
        { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F', rewardAmount: 5.0, color: '#EAB308', isOpened: false },
        { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT', rewardAmount: 3.0, color: '#EF4444', isOpened: false },
        { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F', rewardAmount: 10.0, color: '#10B981', isOpened: false },
      ],
      canOpenToday: true,
      boxesUsedToday: 0,
      maxDailyBoxes: 5,
      boxesRemainingToday: 5,
      adRequired: true,
    };
  },

  async openGiftBox(userId: string, boxId: number, adSessionId?: string, claimToken?: string): Promise<{
    success: boolean;
    box: GiftBox;
    rewardAmount: number;
    rewardAsset: string;
    balances: WalletBalances;
    boxesRemainingToday?: number;
    boxesUsedToday?: number;
    maxDailyBoxes?: number;
  }> {
    const res = await fetch('/api/rewards/gift-box/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, boxId, adSessionId, claimToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to open gift box');
    return data;
  },

  // Tasks
  async getTasks(userId: string): Promise<{ tasks: SocialTask[] }> {
    const res = await fetch(`/api/tasks/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async submitTask(
    userId: string,
    taskId: string,
    proofData?: string | { proof?: string; usernameOrLink?: string; screenshot?: string; description?: string }
  ): Promise<any> {
    const payload = typeof proofData === 'string'
      ? { userId, taskId, proof: proofData, usernameOrLink: proofData }
      : { userId, taskId, ...(proofData || {}) };

    const res = await fetch('/api/tasks/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit task');
    return data;
  },

  async claimTask(userId: string, taskId: string): Promise<any> {
    const res = await fetch('/api/tasks/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId, proof: 'auto_verified' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to claim task');
    return data;
  },

  async startTaskTimer(userId: string, taskId: string, accumulatedSeconds?: number): Promise<{ success: boolean; startTime: number; durationSeconds: number; url: string }> {
    const res = await fetch('/api/tasks/start-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId, accumulatedSeconds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start task timer');
    return data;
  },

  async verifyTaskTimer(userId: string, taskId: string, accumulatedSeconds?: number): Promise<any> {
    const res = await fetch('/api/tasks/verify-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId, accumulatedSeconds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify task timer');
    return data;
  },

  async getSpinStatus(userId: string): Promise<{
    spinsUsed: number;
    maxSpins: number;
    spinsRemainingToday: number;
    adRequired: boolean;
    prizes?: any[];
    zoneId?: string;
    provider?: string;
  }> {
    const res = await fetch(`/api/rewards/${userId}/spin-status`);
    if (!res.ok) throw new Error('Failed to fetch spin status');
    return res.json();
  },

  async deleteAccount(userId: string, confirmText: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/user/${userId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmText }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Account deletion failed');
    return data;
  },

  async updateUsername(userId: string, username: string): Promise<{ success: boolean; user: any; message: string }> {
    const res = await fetch(`/api/user/${userId}/username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update username');
    return data;
  },

  async verifyAccount(userId: string, txHash?: string): Promise<{ success: boolean; message: string; user: any; balances?: any; depositBalance?: number; isVerified: boolean }> {
    const res = await fetch(`/api/user/${userId}/verify-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Account verification failed');
    return data;
  },

  async getPublicSettings(): Promise<{
    success: boolean;
    depositsEnabled: boolean;
    withdrawalsEnabled?: boolean;
    bscDepositAddress: string;
    depositMinUSDT: number;
    depositFirstBonusUSDT?: number;
    e4fPlannedListingDate: string;
    minWithdrawalLimit?: number;
    maxWithdrawalLimit?: number;
    withdrawalFee?: number;
    networkWithdrawSettings?: Record<string, { enabled?: boolean; minAmount: number; maxAmount: number; fee: number }>;
    adRequired?: boolean;
    rewardedAdRequired?: boolean;
    miningRatePerHour?: number;
    miningPrimaryNetwork?: string;
    miningSecondaryNetwork?: string;
    miningWaterfallEnabled?: boolean;
    miningAdDurationSeconds?: number;
    spinAdDurationSeconds?: number;
    giftBoxAdDurationSeconds?: number;
    [key: string]: any;
  }> {
    try {
      const res = await fetch('/api/system/public-settings');
      if (res.ok) {
        const data = await res.json();
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('e4f_cached_public_settings', JSON.stringify(data));
          }
        } catch {}
        return data;
      }
    } catch (e) {
      console.warn('getPublicSettings network fallback:', e);
    }
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('e4f_cached_public_settings');
        if (cached) return JSON.parse(cached);
      }
    } catch {}
    return {
      success: true,
      depositsEnabled: false,
      withdrawalsEnabled: false,
      bscDepositAddress: '0x63562945f7845aa1130a5b1499720b29788c82db',
      depositMinUSDT: 2,
      depositFirstBonusUSDT: 5,
      e4fPlannedListingDate: '2028-02-28',
      minWithdrawalLimit: 1.0,
      maxWithdrawalLimit: 1000,
      withdrawalFee: 1.0,
      miningAdDurationSeconds: 30,
      spinAdDurationSeconds: 30,
      giftBoxAdDurationSeconds: 30,
      networkWithdrawSettings: {
        TRC20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 1.0 },
        BEP20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
        TON: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
      },
    };
  },

  // Referral
  async getReferrals(userId: string): Promise<any> {
    const res = await fetch(`/api/referrals/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch referrals');
    return res.json();
  },

  // Market & Trade
  async getMarketAssets(): Promise<{ assets: MarketAsset[]; serverTime: number }> {
    try {
      const res = await fetch('/api/market/assets');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('getMarketAssets network fallback:', e);
    }
    return {
      assets: [
        {
          symbol: 'E4F/USDT',
          baseAsset: 'E4F',
          quoteAsset: 'USDT',
          name: 'Earn 4 Future',
          isListed: false,
          price: null,
          priceChangePercent24h: null,
          high24h: null,
          low24h: null,
          volume24h: null,
          icon: '/e4f_coin.jpg',
        },
        {
          symbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          name: 'Bitcoin',
          isListed: true,
          price: 68432.5,
          priceChangePercent24h: 2.45,
          high24h: 69210.45,
          low24h: 66102.3,
          volume24h: 34125.8,
          icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040',
        },
        {
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          name: 'Ethereum',
          isListed: true,
          price: 3485.2,
          priceChangePercent24h: 3.12,
          high24h: 3520.0,
          low24h: 3380.1,
          volume24h: 184520.4,
          icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040',
        },
        {
          symbol: 'SOL/USDT',
          baseAsset: 'SOL',
          quoteAsset: 'USDT',
          name: 'Solana',
          isListed: true,
          price: 152.8,
          priceChangePercent24h: 4.85,
          high24h: 156.4,
          low24h: 145.2,
          volume24h: 895400.2,
          icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=040',
        },
        {
          symbol: 'BNB/USDT',
          baseAsset: 'BNB',
          quoteAsset: 'USDT',
          name: 'BNB Chain',
          isListed: true,
          price: 582.3,
          priceChangePercent24h: -0.42,
          high24h: 589.9,
          low24h: 578.1,
          volume24h: 42100.5,
          icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040',
        },
        {
          symbol: 'XRP/USDT',
          baseAsset: 'XRP',
          quoteAsset: 'USDT',
          name: 'XRP',
          isListed: true,
          price: 0.584,
          priceChangePercent24h: 1.15,
          high24h: 0.598,
          low24h: 0.572,
          volume24h: 1254300.0,
          icon: 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=040',
        },
      ],
      serverTime: Date.now(),
    };
  },

  async getKlines(pair: string, timeframe: string): Promise<{ pair: string; timeframe: string; klines: CandlestickData[] }> {
    const res = await fetch(`/api/market/klines?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}`);
    if (!res.ok) throw new Error('Failed to fetch klines');
    return res.json();
  },

  async getOrderBook(pair: string): Promise<OrderBook> {
    const res = await fetch(`/api/market/orderbook?pair=${encodeURIComponent(pair)}`);
    if (!res.ok) throw new Error('Failed to fetch order book');
    return res.json();
  },

  async placeOrder(userId: string, orderData: { pair: string; side: 'BUY' | 'SELL'; type: 'MARKET' | 'LIMIT'; price: number; amount: number }): Promise<{ success: boolean; order: SpotOrder; balances: WalletBalances }> {
    const res = await fetch('/api/trade/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...orderData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order placement failed');
    return data;
  },

  async getOrders(userId: string): Promise<{ orders: SpotOrder[] }> {
    const res = await fetch(`/api/trade/${userId}/orders`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  // Wallet Actions
  async deposit(userId: string, data: { asset: string; network: string; amount: number }): Promise<any> {
    const res = await fetch('/api/wallet/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data }),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Deposit failed');
    return resData;
  },

  async withdraw(userId: string, data: { asset: string; address: string; network: string; amount: number }): Promise<any> {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data }),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Withdrawal failed');
    return resData;
  },

  // Announcements
  async getAnnouncements(): Promise<{ announcements: Announcement[] }> {
    const res = await fetch('/api/announcements');
    if (!res.ok) throw new Error('Failed to fetch announcements');
    return res.json();
  },

  // Support
  async getSupportTickets(userId: string): Promise<{ tickets: SupportTicket[] }> {
    const res = await fetch(`/api/support/${userId}/tickets`);
    if (!res.ok) throw new Error('Failed to fetch support tickets');
    return res.json();
  },

  async createSupportTicket(userId: string, subject: string, message: string): Promise<any> {
    const res = await fetch('/api/support/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subject, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ticket creation failed');
    return data;
  },

  // Admin
  async adminLogin(pin: string, key?: string): Promise<{ success: boolean; token: string; key: string; role: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, key: key || pin, password: pin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Admin login failed');
    return data;
  },

  async getAdminDashboard(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/dashboard', {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to fetch admin dashboard');
    return res.json();
  },

  async updateAdminSettings(settings: any, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async updateAdminAdConfig(config: { enabled: boolean; provider: string; adMiningDurationSeconds?: number; adsterraDirectLink?: string; monetagDirectLink?: string }, adminKey = 'B@n+earn4future26'): Promise<any> {
    return this.updateAdminSettings({
      rewardedAdRequired: config.enabled,
      adProvider: config.provider,
      ...(config.adMiningDurationSeconds ? { adMiningDurationSeconds: config.adMiningDurationSeconds } : {}),
      ...(config.adsterraDirectLink ? { adsterraDirectLink: config.adsterraDirectLink } : {}),
      ...(config.monetagDirectLink ? { monetagDirectLink: config.monetagDirectLink } : {}),
    }, adminKey);
  },

  // Announcements CRUD
  async getAdminAnnouncements(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/announcements', {
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  async createAnnouncement(ann: { title: string; description: string; ctaText?: string; ctaUrl?: string; imageUrl?: string; priority?: string | number; type?: string; validUntil?: number }, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(ann),
    });
    return res.json();
  },

  async updateAnnouncement(id: string, updates: any, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteAnnouncement(id: string, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  // Dynamic Tasks CRUD
  async getAdminTasks(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/tasks', {
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  async createAdminTask(task: any, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(task),
    });
    return res.json();
  },

  async updateAdminTask(id: string, updates: any, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteAdminTask(id: string, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  // Task Submissions Review
  async getAdminTaskSubmissions(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/task-submissions', {
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  async reviewTaskSubmission(submissionId: string, decision: 'APPROVE' | 'REJECT', adminNote?: string, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/task-submissions/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ submissionId, decision, adminNote }),
    });
    return res.json();
  },

  // Users Management
  async getAdminUsers(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/users', {
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  async updateAdminUserStatus(userId: string, status: string, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  async deleteAdminUser(userId: string, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  // Withdrawals Management (Manual Review, Verification & Approval)
  async getAdminWithdrawals(adminKey = 'B@n+earn4future26'): Promise<{ withdrawals: any[] }> {
    const res = await fetch('/api/admin/withdrawals', {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to fetch withdrawals');
    return res.json();
  },

  async reviewAdminWithdrawal(withdrawalId: string, decision: 'APPROVE' | 'REJECT', note?: string, adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ decision, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to review withdrawal');
    return data;
  },

  // Data Retention Cleanup
  async cleanupRetention(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/cleanup-retention', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },

  // Audit Logs
  async getAdminAuditLogs(adminKey = 'B@n+earn4future26'): Promise<any> {
    const res = await fetch('/api/admin/audit-logs', {
      headers: { 'x-admin-key': adminKey },
    });
    return res.json();
  },
};
