import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserAccount, WalletBalances, ScreenTab, Language, MiningSession, MiningStats, AppNotification } from '../types';
import { api } from '../services/api';

export type ModalType =
  | 'TASKS'
  | 'REWARDS'
  | 'REFERRAL'
  | 'PROFILE'
  | 'SUPPORT'
  | 'DOCUMENTS'
  | 'WELCOME'
  | 'WELCOME_BONUS'
  | 'ADMIN'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'NOTIFICATIONS'
  | 'SPIN'
  | 'GIFT_BOXES'
  | null;

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface AppContextType {
  user: UserAccount | null;
  balances: WalletBalances;
  activeTab: ScreenTab;
  setActiveTab: (tab: ScreenTab) => void;
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  miningStats: MiningStats | null;
  activeMiningSession: MiningSession | null;
  refreshMining: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  notifications: AppNotification[];
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'error') => void;
  toasts: ToastItem[];
  removeToast: (id: string) => void;
  showWelcomeBonus: boolean;
  setShowWelcomeBonus: (show: boolean) => void;
  toast: { title: string; message: string; type: 'info' | 'success' | 'error' } | null;
}

const defaultBalances: WalletBalances = {
  usdt: 25.0,
  e4f: 10.0,
  btc: 0.0024,
  eth: 0.0456,
  sol: 0.85,
  bnb: 0.12,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('e4f_cached_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [balances, setBalances] = useState<WalletBalances>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('e4f_cached_balances');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return defaultBalances;
  });
  const [activeTab, setActiveTab] = useState<ScreenTab>('home');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [miningStats, setMiningStats] = useState<MiningStats | null>(null);
  const [showWelcomeBonus, setShowWelcomeBonus] = useState<boolean>(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      title: 'Welcome to E4F Web3 Exchange',
      message: '25 USDT (Spot) + 10 E4F welcome balance has been deposited to your account.',
      type: 'WALLET',
      read: false,
      timestamp: Date.now() - 3600000,
    },
    {
      id: 'notif-2',
      title: 'Mining Season Active',
      message: 'Mine E4F every 8 hours. Planned listing milestone: 28 February 2028.',
      type: 'MINING',
      read: false,
      timestamp: Date.now() - 1800000,
    },
  ]);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem = { id, title, message, type };
    setToast({ title, message, type });
    setToasts(prev => [...prev.slice(-3), newToast]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const openModal = (modal: ModalType) => setActiveModal(modal);
  const closeModal = () => setActiveModal(null);

  // Initialize Telegram User with persistent user ID retention and referral tracking
  useEffect(() => {
    let initData = '';
    let tgUser: any = null;
    let referralCodeParam = '';

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      referralCodeParam = urlParams.get('ref') || urlParams.get('start') || urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || '';

      if ((window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp;
        tg.ready();
        tg.expand();
        initData = tg.initData || '';
        tgUser = tg.initDataUnsafe?.user;
        if (!referralCodeParam && tg.initDataUnsafe?.start_param) {
          referralCodeParam = tg.initDataUnsafe.start_param;
        }
      }
    }

    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('e4f_user_id') || undefined : undefined;

    api
      .loginTelegram(initData, tgUser, storedUserId, referralCodeParam)
      .then(res => {
        setUser(res.user);
        if (res.user?.id) {
          localStorage.setItem('e4f_user_id', res.user.id);
          localStorage.setItem('e4f_cached_user', JSON.stringify(res.user));
        }
        if (res.balances) {
          setBalances(res.balances);
          localStorage.setItem('e4f_cached_balances', JSON.stringify(res.balances));
        }
        // Show welcome bonus modal if newly awarded
        if (res.user.claimedWelcomeBonus) {
          const shown = localStorage.getItem('e4f_welcome_modal_shown');
          if (!shown) {
            setShowWelcomeBonus(true);
            localStorage.setItem('e4f_welcome_modal_shown', 'true');
          }
        }
      })
      .catch(err => {
        console.warn('Auth fallback:', err);
      });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getProfile(user.id);
      setUser(res.user);
      if (res.user?.id) {
        localStorage.setItem('e4f_user_id', res.user.id);
        localStorage.setItem('e4f_cached_user', JSON.stringify(res.user));
      }
      if (res.balances) {
        setBalances(res.balances);
        localStorage.setItem('e4f_cached_balances', JSON.stringify(res.balances));
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  const refreshMining = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getMiningStatus(user.id);
      setMiningStats(res);
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // Periodic poll for mining and profile
  useEffect(() => {
    if (!user) return;
    refreshMining();
    const interval = setInterval(() => {
      refreshMining();
      refreshProfile();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, refreshMining, refreshProfile]);

  return (
    <AppContext.Provider
      value={{
        user,
        balances,
        activeTab,
        setActiveTab,
        activeModal,
        openModal,
        closeModal,
        language,
        setLanguage,
        miningStats,
        activeMiningSession: miningStats?.activeSession || null,
        refreshMining,
        refreshProfile,
        notifications,
        addToast,
        toasts,
        removeToast,
        showWelcomeBonus,
        setShowWelcomeBonus,
        toast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
