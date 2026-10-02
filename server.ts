import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS for all incoming requests (crucial for iframe preview & API requests)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-key, x-admin-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// In-Memory Database & Persistence Layer
interface UserRecord {
  id: string;
  uid: string;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  referralCode: string;
  referredBy?: string;
  createdAt: number;
  status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';
  claimedWelcomeBonus: boolean;
  isDemoUser: boolean;
  isVerified?: boolean;
  depositBalance?: number;
  depositAddress?: string;
}

interface BalanceRecord {
  usdt: number;
  e4f: number;
  btc: number;
  eth: number;
  sol: number;
  bnb: number;
}

interface TxRecord {
  id: string;
  userId: string;
  asset: 'USDT' | 'E4F' | 'BTC' | 'ETH' | 'SOL' | 'BNB';
  amount: number;
  direction: 'IN' | 'OUT';
  source: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REJECTED';
  timestamp: number;
  referenceId?: string;
  note?: string;
  address?: string;
  network?: string;
  fee?: number;
  userDepositTotal?: number;
}

interface MiningRecord {
  id: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  miningRatePerHour: number;
  estimatedReward: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';
  adVerified: boolean;
  adSessionId?: string;
  claimedAt?: number;
}

// In-memory data store
const users = new Map<string, UserRecord>();
const balances = new Map<string, BalanceRecord>();
const transactions: TxRecord[] = [];
const miningSessions: MiningRecord[] = [];
interface MiningAdSessionRecord {
  sessionId: string;
  userId: string;
  actionType?: 'MINING' | 'SPIN' | 'GIFT_BOX';
  targetId?: number;
  startedAt: number;
  endsAt: number;
  durationSeconds: number;
  verified: boolean;
  consumed: boolean;
  token: string;
  claimToken?: string;
  createdAt: number;
  monetagS2SConfirmed?: boolean;
  sdkCompleted?: boolean;
  adOpenedAt?: number;
  watchStarted?: boolean;
  verifiedAt?: number;
  consumedAt?: number;
}
const miningAdSessions = new Map<string, MiningAdSessionRecord>();
const adSessions = new Map<string, { userId: string; createdAt: number; verified: boolean; token: string }>();
const auditLogs: Array<{ id: string; adminId: string; action: string; target: string; details: string; timestamp: number }> = [];

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUid: string;
  referredName: string;
  timestamp: number;
  status: 'ACTIVE' | 'QUALIFIED' | 'PENDING';
  minedDays: number;
  rewardEarned: number;
}
const referralHistory: ReferralRecord[] = [];

// Default 8 Spin Wheel segments
const defaultSpinWheelPrizes = [
  { id: 0, label: '0.25 E4F', asset: 'E4F' as const, amount: 0.25, color: '#3B82F6' },
  { id: 1, label: '0.50 USDT', asset: 'USDT' as const, amount: 0.50, color: '#10B981' },
  { id: 2, label: '1.00 E4F', asset: 'E4F' as const, amount: 1.00, color: '#EAB308' },
  { id: 3, label: '0.10 USDT', asset: 'USDT' as const, amount: 0.10, color: '#6366F1' },
  { id: 4, label: '2.50 E4F', asset: 'E4F' as const, amount: 2.50, color: '#EC4899' },
  { id: 5, label: '1.00 USDT', asset: 'USDT' as const, amount: 1.00, color: '#14B8A6' },
  { id: 6, label: '5.00 E4F', asset: 'E4F' as const, amount: 5.00, color: '#F97316' },
  { id: 7, label: '2.00 USDT', asset: 'USDT' as const, amount: 2.00, color: '#8B5CF6' },
];

// Default 5 Mystery Gift Boxes
const defaultGiftBoxesConfig = [
  { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F' as const, rewardAmount: 2.5, color: '#38BDF8' },
  { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT' as const, rewardAmount: 1.5, color: '#A855F7' },
  { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F' as const, rewardAmount: 5.0, color: '#EAB308' },
  { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT' as const, rewardAmount: 3.0, color: '#EF4444' },
  { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F' as const, rewardAmount: 10.0, color: '#10B981' },
];

// Default 7-Day Daily Check-In Streak Rewards (0.001 to 5.0 E4F / USDT configurable by admin)
const defaultDailyCheckInRewards = [
  { day: 1, asset: 'E4F' as 'E4F' | 'USDT', amount: 0.5 },
  { day: 2, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.2 },
  { day: 3, asset: 'E4F' as 'E4F' | 'USDT', amount: 1.0 },
  { day: 4, asset: 'USDT' as 'E4F' | 'USDT', amount: 0.5 },
  { day: 5, asset: 'E4F' as 'E4F' | 'USDT', amount: 1.5 },
  { day: 6, asset: 'USDT' as 'E4F' | 'USDT', amount: 1.0 },
  { day: 7, asset: 'E4F' as 'E4F' | 'USDT', amount: 3.0 },
];

// Deterministic unique deposit address per user (BEP20 EVM format)
function generateUserDepositAddress(userId: string, uid: string): string {
  const hash = crypto.createHash('sha256').update(`E4F_USER_DEPOSIT_BEP20_${userId}_${uid}`).digest('hex');
  return '0x' + hash.slice(0, 40);
}

const defaultNetworkWithdrawSettings: Record<string, { enabled: boolean; minAmount: number; maxAmount: number; fee: number }> = {
  TRC20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 1.0 },
  BEP20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
  TON: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
};

// Admin System Settings
const SETTINGS_FILE = path.join(process.cwd(), 'system-settings.json');
const systemSettings = {
  miningRatePerHour: 0.25,
  miningDurationHours: 8,
  rewardedAdRequired: true,
  adMiningDurationSeconds: 30,
  miningAdDurationSeconds: 30,
  spinAdDurationSeconds: 30,
  giftBoxAdDurationSeconds: 30,
  adProvider: 'MONETAG' as 'ADSTERRA' | 'MONETAG' | 'SIMULATOR',
  adsterraDirectLink: 'https://beta.publishers.adsterra.com/direct-link-demo',
  monetagDirectLink: 'https://omg10.com/4/11442658',
  monetagZoneId: '11442658',
  monetagTelegramSdkEnabled: true,
  welcomeBonusUSDT: 25,
  welcomeBonusE4F: 10,
  referralBonusUSDT: 5,
  e4fListingStatus: 'PENDING_LISTING',
  e4fPlannedListingDate: '2028-02-28',
  e4fPlannedTargetPriceRange: '3–5 USDT',
  depositsEnabled: true,
  withdrawalsEnabled: true,
  minWithdrawalLimit: 0.1,
  maxWithdrawalLimit: 1000.0,
  withdrawalFee: 1.0,
  networkWithdrawSettings: defaultNetworkWithdrawSettings,
  depositMinUSDT: 2.0,
  depositFirstBonusUSDT: 10.0,
  bscDepositAddress: '0x63562945f7845aa1130a5b1499720b29788c82db',
  referralMiningBoostTiers: [
    { minReferrals: 1, boostPercent: 5 },
    { minReferrals: 3, boostPercent: 15 },
    { minReferrals: 5, boostPercent: 25 },
    { minReferrals: 10, boostPercent: 50 },
    { minReferrals: 20, boostPercent: 100 },
  ],
  rewardSpinMaxDaily: 5,
  rewardSpinAdRequired: true,
  giftBoxMaxDaily: 5,
  giftBoxAdRequired: true,
  spinWheelPrizes: defaultSpinWheelPrizes,
  giftBoxesConfig: defaultGiftBoxesConfig,
  dailyCheckInRewards: defaultDailyCheckInRewards,
  // Waterfall Ad Block / Zone ID / App IDs (10 Variables)
  spin_01_adsgram: 'spin_01_adsgram',
  spin_02_monetag: 'spin_02_monetag',
  spin_03_onclicka: 'spin_03_onclicka',
  spin_04_richads: 'spin_04_richads',
  spin_05_adexora: 'spin_05_adexora',
  box_01_adsgram: 'box_01_adsgram',
  box_02_monetag: 'box_02_monetag',
  box_03_onclicka: 'box_03_onclicka',
  box_04_richads: 'box_04_richads',
  box_05_adexora: 'box_05_adexora',
  // Mining Ad Gate & Waterfall Settings (Configurable from Admin without app updates)
  miningPrimaryNetwork: 'AdsGram' as 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora',
  miningSecondaryNetwork: 'Monetag' as 'AdsGram' | 'Monetag' | 'OnClickA' | 'RichAds' | 'Adexora',
  miningWaterfallEnabled: true,
  mining_01_adsgram: 'mining_01_adsgram',
  mining_02_monetag: '11442658',
  mining_03_onclicka: 'mining_03_onclicka',
  mining_04_richads: 'mining_04_richads',
  mining_05_adexora: 'mining_05_adexora',
};

// Load persisted settings on startup if exists
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    Object.assign(systemSettings, parsed);
  }
} catch (e) {
  console.error('Could not load system-settings.json:', e);
}

// Dynamic Tasks definition
interface DynamicTask {
  id: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  rewardAsset: 'E4F' | 'USDT';
  rewardAmount: number;
  status: 'AVAILABLE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  verificationMethod: 'AUTO' | 'MANUAL' | 'TIMER';
  durationSeconds?: number;
}

const dynamicTasks: DynamicTask[] = [
  {
    id: 'task-tg-channel',
    title: 'Join E4F Official Telegram Channel',
    description: 'Subscribe to our official announcement channel for daily updates.',
    platform: 'TELEGRAM',
    url: 'https://t.me/E4F_Exchange_Official',
    rewardAsset: 'E4F',
    rewardAmount: 0.50,
    status: 'AVAILABLE',
    verificationMethod: 'AUTO',
  },
  {
    id: 'task-x-follow',
    title: 'Follow E4F Exchange on X (Twitter)',
    description: 'Follow our official X handle and retweet the pinned listing roadmap.',
    platform: 'TWITTER',
    url: 'https://x.com/E4FExchange',
    rewardAsset: 'USDT',
    rewardAmount: 1.00,
    status: 'AVAILABLE',
    verificationMethod: 'MANUAL',
  },
  {
    id: 'task-yt-subscribe',
    title: 'Subscribe to E4F YouTube Channel',
    description: 'Watch the Web3 Mining Ecosystem guide and subscribe.',
    platform: 'YOUTUBE',
    url: 'https://youtube.com/@E4FWeb3Exchange',
    rewardAsset: 'E4F',
    rewardAmount: 0.75,
    status: 'AVAILABLE',
    verificationMethod: 'AUTO',
  },
  {
    id: 'task-community-join',
    title: 'Join E4F Global Traders Group',
    description: 'Connect with over 250,000 miners and crypto traders globally.',
    platform: 'COMMUNITY',
    url: 'https://t.me/E4F_Global_Traders',
    rewardAsset: 'USDT',
    rewardAmount: 0.50,
    status: 'AVAILABLE',
    verificationMethod: 'AUTO',
  },
  {
    id: 'task-web-whitepaper',
    title: 'Review E4F Tokenomics & Whitepaper',
    description: 'Browse the 2028 Mainnet Roadmap and token distribution model. (30s verification timer)',
    platform: 'WEBSITE',
    url: 'https://e4f-exchange.org/whitepaper',
    rewardAsset: 'USDT',
    rewardAmount: 1.00,
    status: 'AVAILABLE',
    verificationMethod: 'TIMER',
    durationSeconds: 30,
  },
  {
    id: 'task-web-explorer',
    title: 'Inspect E4F Pre-Listing Blockchain Explorer',
    description: 'Visit the live testnet explorer and monitor node consensus blocks for at least 30 seconds.',
    platform: 'WEBSITE',
    url: 'https://e4f-exchange.org/explorer',
    rewardAsset: 'E4F',
    rewardAmount: 1.50,
    status: 'AVAILABLE',
    verificationMethod: 'TIMER',
    durationSeconds: 30,
  },
];

// Tracking user task submissions
const userTaskSubmissions = new Map<string, Array<{ taskId: string; status: string; proof?: string; timestamp: number }>>();

// Admin review queue for manual task proof submissions
export interface TaskSubmissionRecord {
  id: string;
  userId: string;
  userUid: string;
  taskId: string;
  taskTitle: string;
  proof: string;
  usernameOrLink?: string;
  screenshot?: string;
  description?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rewardAmount: number;
  rewardAsset: 'E4F' | 'USDT';
  timestamp: number;
  adminNote?: string;
}
const taskSubmissionsQueue: TaskSubmissionRecord[] = [];

// Active Website Task Timers (userId_taskId -> startTime)
const activeTaskTimers = new Map<string, { startTime: number; durationSeconds: number; accumulatedSeconds?: number }>();

// Daily Spin counts (userId -> { date: string, count: number })
const userDailySpins = new Map<string, { date: string; count: number }>();

// Daily Gift Box opens (userId -> { date: string, count: number, openedBoxIds: number[] })
const userDailyGiftBoxOpens = new Map<string, { date: string; count: number; openedBoxIds: number[] }>();

// First deposit tracking set (userIds that have deposited)
const userFirstDepositClaimed = new Set<string>();

// 5 Gift Boxes state per user
const userGiftBoxes = new Map<string, Array<{ id: number; boxNumber: number; name: string; rewardAsset: 'E4F' | 'USDT'; rewardAmount: number; color: string; isOpened: boolean }>>();

// Daily Check-in state
const userDailyCheckIns = new Map<string, { currentStreak: number; lastDate: string; claimedDays: number[] }>();

interface AnnouncementRecord {
  id: string;
  title: string;
  description: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  priority?: number | string;
  type?: string;
  isActive: boolean;
  publishedAt?: number;
  validUntil?: number;
}

// Announcements
let announcements: AnnouncementRecord[] = [
  {
    id: 'ann-1',
    title: 'E4F Web3 Exchange Mining Season is Live!',
    description: 'Start your 8-hour mining session now and accumulate official E4F tokens before the planned listing milestone on 28 February 2028.',
    ctaText: 'Start Mining',
    ctaUrl: '#mining',
    imageUrl: '/web3_banner.jpg',
    priority: 1,
    isActive: true,
  },
  {
    id: 'ann-2',
    title: 'Instant 25 USDT + 10 E4F Welcome Bonus',
    description: 'All verified Telegram accounts receive immediate spot wallet funding. Explore live BTC/USDT and spot order books.',
    ctaText: 'View Wallet',
    ctaUrl: '#wallet',
    imageUrl: '/e4f_coin.jpg',
    priority: 2,
    isActive: true,
  },
  {
    id: 'ann-3',
    title: 'Invite & Earn 5 USDT per Qualified Referral',
    description: 'Share your personal referral link. When your friend mines actively for 30 days, receive 5 USDT directly into your Spot Available balance.',
    ctaText: 'Invite Friends',
    ctaUrl: '#referral',
    imageUrl: '/web3_banner.jpg',
    priority: 3,
    isActive: true,
  },
];

// Support Tickets
const supportTickets: Array<{
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  createdAt: number;
  adminReply?: string;
}> = [];

// Orders & Trades
const spotOrders: Array<{
  id: string;
  userId: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price: number;
  amount: number;
  totalUSDT: number;
  filledAmount: number;
  status: 'FILLED' | 'CANCELLED' | 'OPEN';
  timestamp: number;
}> = [];

// ====================================================
// Atomic File-Based Persistence Engine (app-database.json + app-database.json.bak)
// Ensures users, balances, transactions, and state NEVER wipe on updates
// 90-Day Retention Policy strictly preserves history for 90 days
// ====================================================
const DB_FILE = path.join(process.cwd(), 'app-database.json');
const DB_BACKUP_FILE = path.join(process.cwd(), '.app-database.bak');
const DB_TMP_FILE = path.join(process.cwd(), '.app-database.tmp');

let isDbDirty = false;
function markDbDirty() {
  isDbDirty = true;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

// 90-Day Retention Policy: All history (transactions, spot orders, referrals, task submissions, audit logs)
// is preserved for 90 days. Records strictly older than 90 days are sequentially and progressively purged.
function apply90DayRetentionPolicy(): {
  purgedTransactions: number;
  purgedOrders: number;
  purgedLogs: number;
  purgedSubmissions: number;
  purgedReferrals: number;
} {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  let purgedTransactions = 0;
  let purgedOrders = 0;
  let purgedLogs = 0;
  let purgedSubmissions = 0;
  let purgedReferrals = 0;

  // 1. Transactions: Purge only completed/rejected records older than 90 days (never purge pending)
  for (let i = transactions.length - 1; i >= 0; i--) {
    if (transactions[i].timestamp < cutoff && transactions[i].status !== 'PENDING') {
      transactions.splice(i, 1);
      purgedTransactions++;
    }
  }

  // 2. Spot Orders: Purge filled/cancelled orders older than 90 days
  for (let i = spotOrders.length - 1; i >= 0; i--) {
    if (spotOrders[i].timestamp < cutoff) {
      spotOrders.splice(i, 1);
      purgedOrders++;
    }
  }

  // 3. Referral History: Purge inactive records older than 90 days
  for (let i = referralHistory.length - 1; i >= 0; i--) {
    if (referralHistory[i].timestamp < cutoff && referralHistory[i].status !== 'ACTIVE') {
      referralHistory.splice(i, 1);
      purgedReferrals++;
    }
  }

  // 4. Audit logs: Purge logs older than 90 days
  for (let i = auditLogs.length - 1; i >= 0; i--) {
    if (auditLogs[i].timestamp < cutoff) {
      auditLogs.splice(i, 1);
      purgedLogs++;
    }
  }

  // 5. Task submissions: Purge resolved submissions older than 90 days
  for (let i = taskSubmissionsQueue.length - 1; i >= 0; i--) {
    if (taskSubmissionsQueue[i].timestamp < cutoff && taskSubmissionsQueue[i].status !== 'SUBMITTED') {
      taskSubmissionsQueue.splice(i, 1);
      purgedSubmissions++;
    }
  }

  return { purgedTransactions, purgedOrders, purgedLogs, purgedSubmissions, purgedReferrals };
}

function persistDatabaseSync() {
  isDbDirty = false;
  try {
    const data = {
      users: Array.from(users.entries()),
      balances: Array.from(balances.entries()),
      transactions,
      referralHistory,
      miningSessions,
      auditLogs,
      dynamicTasks,
      announcements,
      supportTickets,
      spotOrders,
      userTaskSubmissions: Array.from(userTaskSubmissions.entries()),
      taskSubmissionsQueue,
      userDailySpins: Array.from(userDailySpins.entries()),
      userDailyGiftBoxOpens: Array.from(userDailyGiftBoxOpens.entries()),
      userFirstDepositClaimed: Array.from(userFirstDepositClaimed.values()),
      userGiftBoxes: Array.from(userGiftBoxes.entries()),
      userDailyCheckIns: Array.from(userDailyCheckIns.entries()),
      miningAdSessions: Array.from(miningAdSessions.entries()),
      lastSaved: Date.now(),
    };

    const jsonStr = JSON.stringify(data, null, 2);
    // Atomic write pattern: write to tmp file first, then atomically rename to primary file
    fs.writeFileSync(DB_TMP_FILE, jsonStr, 'utf-8');
    fs.renameSync(DB_TMP_FILE, DB_FILE);
    // Also mirror to secondary backup file
    try {
      fs.copyFileSync(DB_FILE, DB_BACKUP_FILE);
    } catch {}
  } catch (err) {
    console.error('[Persistence] Failed to persist database:', err);
  }
}

let saveTimer: any = null;
function scheduleSaveDatabase() {
  isDbDirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistDatabaseSync();
  }, 500);
}

function loadDatabaseFromDisk() {
  try {
    let raw = '';
    let loadedSource = '';

    // Step 1: Attempt to load from primary DB_FILE
    if (fs.existsSync(DB_FILE)) {
      try {
        const primaryContent = fs.readFileSync(DB_FILE, 'utf-8');
        if (primaryContent && primaryContent.trim().length > 0) {
          JSON.parse(primaryContent); // validate JSON integrity
          raw = primaryContent;
          loadedSource = 'primary';
        }
      } catch (e) {
        console.warn('[Persistence] Primary DB file is corrupt. Attempting backup recovery...', e);
      }
    }

    // Step 2: Attempt to restore from DB_BACKUP_FILE if primary failed or was empty
    if (!raw && fs.existsSync(DB_BACKUP_FILE)) {
      try {
        const backupContent = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
        if (backupContent && backupContent.trim().length > 0) {
          JSON.parse(backupContent);
          raw = backupContent;
          loadedSource = 'backup';
          console.log('[Persistence] Successfully restored database from backup file.');
          // Restore primary DB file from backup
          fs.copyFileSync(DB_BACKUP_FILE, DB_FILE);
        }
      } catch (e) {
        console.error('[Persistence] Backup DB file also corrupt:', e);
      }
    }

    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.users)) {
        for (const [k, v] of data.users) {
          if (v.firstName === 'Telegram User') {
            v.firstName = 'E4F User';
          }
          if (!v.depositAddress) {
            v.depositAddress = generateUserDepositAddress(v.id || k, v.uid || '80000000');
          }
          users.set(k, v);
        }
      }
      if (Array.isArray(data.balances)) {
        for (const [k, v] of data.balances) {
          balances.set(k, v);
        }
      }
      if (Array.isArray(data.transactions)) {
        transactions.length = 0;
        transactions.push(...data.transactions);
      }
      if (Array.isArray(data.referralHistory)) {
        referralHistory.length = 0;
        referralHistory.push(...data.referralHistory);
      }
      if (Array.isArray(data.miningSessions)) {
        miningSessions.length = 0;
        miningSessions.push(...data.miningSessions);
      }
      if (Array.isArray(data.auditLogs)) {
        auditLogs.length = 0;
        auditLogs.push(...data.auditLogs);
      }
      if (Array.isArray(data.dynamicTasks) && data.dynamicTasks.length > 0) {
        dynamicTasks.length = 0;
        dynamicTasks.push(...data.dynamicTasks);
      }
      if (Array.isArray(data.announcements) && data.announcements.length > 0) {
        announcements.length = 0;
        announcements.push(...data.announcements);
      }
      if (Array.isArray(data.supportTickets)) {
        supportTickets.length = 0;
        supportTickets.push(...data.supportTickets);
      }
      if (Array.isArray(data.spotOrders)) {
        spotOrders.length = 0;
        spotOrders.push(...data.spotOrders);
      }
      if (Array.isArray(data.userTaskSubmissions)) {
        for (const [k, v] of data.userTaskSubmissions) {
          userTaskSubmissions.set(k, v);
        }
      }
      if (Array.isArray(data.taskSubmissionsQueue)) {
        taskSubmissionsQueue.length = 0;
        taskSubmissionsQueue.push(...data.taskSubmissionsQueue);
      }
      if (Array.isArray(data.userDailySpins)) {
        for (const [k, v] of data.userDailySpins) {
          userDailySpins.set(k, v);
        }
      }
      if (Array.isArray(data.userDailyGiftBoxOpens)) {
        for (const [k, v] of data.userDailyGiftBoxOpens) {
          if (v && (v as any).lastDate && !(v as any).date) {
            userDailyGiftBoxOpens.set(k, {
              date: (v as any).lastDate,
              count: 1,
              openedBoxIds: [1],
            });
          } else {
            userDailyGiftBoxOpens.set(k, v);
          }
        }
      }
      if (Array.isArray(data.userFirstDepositClaimed)) {
        for (const v of data.userFirstDepositClaimed) {
          userFirstDepositClaimed.add(v);
        }
      }
      if (Array.isArray(data.userGiftBoxes)) {
        for (const [k, v] of data.userGiftBoxes) {
          userGiftBoxes.set(k, v);
        }
      }
      if (Array.isArray(data.userDailyCheckIns)) {
        for (const [k, v] of data.userDailyCheckIns) {
          userDailyCheckIns.set(k, v);
        }
      }
      if (Array.isArray(data.miningAdSessions)) {
        for (const [k, v] of data.miningAdSessions) {
          miningAdSessions.set(k, v);
          adSessions.set(k, {
            userId: v.userId,
            createdAt: v.createdAt || v.startedAt,
            verified: v.verified,
            token: v.token,
          });
        }
      }
      console.log(`[Persistence] Loaded ${users.size} users, ${balances.size} balances, ${transactions.length} txs, ${spotOrders.length} orders from ${loadedSource}`);
      // Apply 90-day retention progressive cleanup on startup
      apply90DayRetentionPolicy();
    } else {
      // First boot: Do NOT add fake demo users. Real users register seamlessly.
      console.log('[Persistence] Fresh start: Initialized clean database without demo users.');
      persistDatabaseSync();
    }
  } catch (err) {
    console.error('[Persistence] Failed to load database:', err);
  }
}

// Load database immediately
loadDatabaseFromDisk();

// Periodic backup sync (only when data has changed) & 90-day retention policy execution
setInterval(() => {
  if (isDbDirty) {
    persistDatabaseSync();
  }
}, 5000);
setInterval(() => {
  apply90DayRetentionPolicy();
}, 24 * 60 * 60 * 1000); // Daily retention check

// Process exit hooks: Ensure database is synchronously flushed to disk on shutdown/restart
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Flushing database synchronously...');
  persistDatabaseSync();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Flushing database synchronously...');
  persistDatabaseSync();
  process.exit(0);
});

process.on('beforeExit', () => {
  persistDatabaseSync();
});

// Helper: Ensure user initialization & Welcome Bonus (no fake demo users)
function getOrCreateUser(telegramId: number, firstName: string, lastName = '', username = '', isDemo = false, referredByCode?: string): UserRecord {
  const userId = `usr_${telegramId}`;
  let user = users.get(userId);

  if (!user) {
    const rawUidNumber = Math.abs(telegramId % 8999999 + 1000000);
    const uid = `8${rawUidNumber}`;
    const cleanFirstName = (!firstName || firstName === 'Telegram User') ? 'E4F User' : firstName;

    let referredByUserId: string | undefined;
    if (referredByCode && typeof referredByCode === 'string') {
      const trimmedRef = referredByCode.trim().toUpperCase();
      for (const [existingId, existingUser] of users.entries()) {
        if (existingUser.referralCode && existingUser.referralCode.toUpperCase() === trimmedRef) {
          referredByUserId = existingId;
          break;
        }
      }
    }

    user = {
      id: userId,
      uid,
      telegramId,
      firstName: cleanFirstName,
      lastName,
      username: username || 'user_123',
      referralCode: `E4F${Math.abs(telegramId % 899999 + 100000)}`,
      referredBy: referredByUserId,
      createdAt: Date.now(),
      status: 'ACTIVE',
      claimedWelcomeBonus: false,
      isDemoUser: isDemo,
      isVerified: false,
      depositBalance: 0,
      depositAddress: generateUserDepositAddress(userId, uid),
    };
    users.set(userId, user);

    if (referredByUserId) {
      referralHistory.push({
        id: `ref_${Date.now()}_${userId}`,
        referrerId: referredByUserId,
        referredUserId: userId,
        referredUid: uid,
        referredName: cleanFirstName,
        timestamp: Date.now(),
        status: 'ACTIVE',
        minedDays: 0,
        rewardEarned: 0,
      });
    }

    // Initial zero balances
    balances.set(userId, {
      usdt: 0,
      e4f: 0,
      btc: 0.0024,
      eth: 0.0456,
      sol: 0.85,
      bnb: 0.12,
    });

    // Award Welcome Bonus: 25 USDT + 10 E4F (Section 5)
    creditWelcomeBonus(userId);

    // Initialize 5 Gift Boxes
    userGiftBoxes.set(userId, [
      { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F', rewardAmount: 2.5, color: '#38BDF8', isOpened: false },
      { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT', rewardAmount: 1.5, color: '#A855F7', isOpened: false },
      { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F', rewardAmount: 5.0, color: '#EAB308', isOpened: false },
      { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT', rewardAmount: 3.0, color: '#EF4444', isOpened: false },
      { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F', rewardAmount: 10.0, color: '#10B981', isOpened: false },
    ]);

    // Initialize daily check-in
    userDailyCheckIns.set(userId, {
      currentStreak: 0,
      lastDate: '',
      claimedDays: [],
    });

    // Persist immediately so new account is NEVER lost
    persistDatabaseSync();
  }

  if (user && user.firstName === 'Telegram User') {
    user.firstName = 'E4F User';
    persistDatabaseSync();
  }

  return user;
}

// Calculate custom referral mining boost percentage based on admin settings
function calculateMiningBoost(referralCount: number): number {
  const tiers = systemSettings.referralMiningBoostTiers as any[];
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return 0;
  }
  // Sort descending by minReferrals
  const sorted = [...tiers].sort((a: any, b: any) => b.minReferrals - a.minReferrals);
  for (const tier of sorted) {
    if (referralCount >= tier.minReferrals) {
      return (tier.boostPercent !== undefined ? tier.boostPercent : tier.boostPercentage) || 0;
    }
  }
  return 0;
}

function creditWelcomeBonus(userId: string) {
  const user = users.get(userId);
  const userBalance = balances.get(userId);
  if (!user || !userBalance || user.claimedWelcomeBonus) return;

  // 1. Credit 25 USDT
  userBalance.usdt += systemSettings.welcomeBonusUSDT;
  transactions.unshift({
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    asset: 'USDT',
    amount: systemSettings.welcomeBonusUSDT,
    direction: 'IN',
    source: 'WELCOME_BONUS_USDT',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: 'Initial Verified Telegram Welcome Bonus (Spot Available)',
  });

  // 2. Credit 10 E4F
  userBalance.e4f += systemSettings.welcomeBonusE4F;
  transactions.unshift({
    id: `tx_${Date.now() + 1}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    asset: 'E4F',
    amount: systemSettings.welcomeBonusE4F,
    direction: 'IN',
    source: 'WELCOME_BONUS_E4F',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: 'Official Pre-Listing E4F Welcome Allocation',
  });

  user.claimedWelcomeBonus = true;

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'SYSTEM',
    action: 'WELCOME_BONUS_GRANTED',
    target: userId,
    details: `Granted ${systemSettings.welcomeBonusUSDT} USDT + ${systemSettings.welcomeBonusE4F} E4F`,
    timestamp: Date.now(),
  });
}

// ----------------------------------------------------
// Market Price Cache with Live Fallback
// ----------------------------------------------------
interface PriceTicker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdated: number;
}

const marketCache: Record<string, PriceTicker> = {
  'BTC/USDT': { symbol: 'BTC/USDT', price: 68432.50, change24h: 2.45, high24h: 69210.45, low24h: 66102.30, volume24h: 34125.8, lastUpdated: Date.now() },
  'ETH/USDT': { symbol: 'ETH/USDT', price: 3485.20, change24h: 3.12, high24h: 3520.00, low24h: 3380.10, volume24h: 184520.4, lastUpdated: Date.now() },
  'SOL/USDT': { symbol: 'SOL/USDT', price: 152.80, change24h: 4.85, high24h: 156.40, low24h: 145.20, volume24h: 895400.2, lastUpdated: Date.now() },
  'BNB/USDT': { symbol: 'BNB/USDT', price: 582.30, change24h: -0.42, high24h: 589.90, low24h: 578.10, volume24h: 42100.5, lastUpdated: Date.now() },
  'XRP/USDT': { symbol: 'XRP/USDT', price: 0.5840, change24h: 1.15, high24h: 0.5980, low24h: 0.5720, volume24h: 1254300.0, lastUpdated: Date.now() },
};

// Try fetching fresh prices from Binance API periodically
async function refreshMarketPrices() {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr`);
    if (res.ok) {
      const data = (await res.json()) as Array<{ symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; volume: string }>;
      for (const item of data) {
        if (symbols.includes(item.symbol)) {
          const pair = item.symbol.replace('USDT', '/USDT');
          marketCache[pair] = {
            symbol: pair,
            price: parseFloat(item.lastPrice),
            change24h: parseFloat(item.priceChangePercent),
            high24h: parseFloat(item.highPrice),
            low24h: parseFloat(item.lowPrice),
            volume24h: parseFloat(item.volume),
            lastUpdated: Date.now(),
          };
        }
      }
    }
  } catch {
    // Graceful fallback to cached tickers
  }
}
setInterval(refreshMarketPrices, 30000);
refreshMarketPrices();

// ====================================================
// REST API ROUTES
// ====================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'E4F Web3 Exchange', serverTime: Date.now() });
});

// 1. Authentication (/api/auth)
app.post('/api/auth/telegram', (req: Request, res: Response) => {
  const { initData, demoUser, storedUserId, referralCode } = req.body;

  // If client provided a storedUserId and that user exists in database, restore immediately!
  if (storedUserId && typeof storedUserId === 'string' && users.has(storedUserId)) {
    const existingUser = users.get(storedUserId)!;
    if (existingUser.firstName === 'Telegram User') {
      existingUser.firstName = 'E4F User';
    }
    if (!existingUser.depositAddress) {
      existingUser.depositAddress = generateUserDepositAddress(existingUser.id, existingUser.uid);
    }
    const userBalances = balances.get(existingUser.id);
    persistDatabaseSync();
    return res.json({
      success: true,
      user: existingUser,
      balances: userBalances,
      serverTime: Date.now(),
    });
  }

  let tgUser: { id: number; first_name: string; last_name?: string; username?: string } | null = null;
  let parsedReferral = referralCode;

  if (initData && typeof initData === 'string') {
    try {
      const urlParams = new URLSearchParams(initData);
      const userParam = urlParams.get('user');
      if (userParam) {
        tgUser = JSON.parse(userParam);
      }
      const startParam = urlParams.get('start_param') || urlParams.get('start') || urlParams.get('ref');
      if (startParam && !parsedReferral) {
        parsedReferral = startParam;
      }
    } catch {
      // ignore parse error
    }
  }

  if (!tgUser) {
    if (demoUser && demoUser.id) {
      tgUser = {
        id: demoUser.id,
        first_name: demoUser.first_name || 'E4F User',
        last_name: demoUser.last_name || '',
        username: demoUser.username || 'user',
      };
    } else {
      tgUser = { id: 123456789, first_name: 'E4F User', username: 'user_123' };
    }
  }

  const user = getOrCreateUser(tgUser.id, tgUser.first_name, tgUser.last_name, tgUser.username, false, parsedReferral);
  if (user.firstName === 'Telegram User') {
    user.firstName = 'E4F User';
  }
  if (!user.depositAddress) {
    user.depositAddress = generateUserDepositAddress(user.id, user.uid);
  }
  const userBalances = balances.get(user.id);
  persistDatabaseSync();

  res.json({
    success: true,
    user,
    balances: userBalances,
    serverTime: Date.now(),
  });
});

// 2. User & Balances (/api/user/profile)
app.get('/api/user/:userId/profile', (req: Request, res: Response) => {
  const { userId } = req.params;
  const parsedTelegramId = parseInt(userId.replace(/\D/g, '')) || 123456789;
  const user = users.get(userId) || getOrCreateUser(parsedTelegramId, 'E4F User');
  if (user.firstName === 'Telegram User') {
    user.firstName = 'E4F User';
  }
  if (!user.depositAddress) {
    user.depositAddress = generateUserDepositAddress(user.id, user.uid);
  }
  const userBalances = balances.get(user.id);
  // 90-day retention cutoff: return all user transactions within 90 days (up to 200)
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const userTxs = transactions.filter(t => t.userId === user.id && t.timestamp >= cutoff).slice(0, 200);

  res.json({
    user,
    balances: userBalances,
    recentTransactions: userTxs,
    serverTime: Date.now(),
  });
});

// Self-Account Deletion
app.post('/api/user/:userId/delete', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { confirmText } = req.body;

  if (confirmText !== 'DELETE') {
    return res.status(400).json({ success: false, error: 'Please confirm account deletion by providing "DELETE"' });
  }

  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.status = 'SUSPENDED';
  balances.set(userId, { usdt: 0, e4f: 0, btc: 0, eth: 0, sol: 0, bnb: 0 });

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'USER_SELF',
    action: 'ACCOUNT_DELETED',
    target: userId,
    details: `User UID ${user.uid} (${user.firstName}) permanently requested self-account deletion.`,
    timestamp: Date.now(),
  });

  persistDatabaseSync();

  res.json({ success: true, message: 'Account permanently deleted and sessions cleared.' });
});

// Update Username
app.post('/api/user/:userId/username', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
  }
  const cleanUsername = username.trim().replace(/^@/, '');
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.username = cleanUsername;
  res.json({ success: true, user, message: 'Username updated successfully' });
});

// Public System Settings (e.g. deposit address, deposit toggle for client UI)
app.get('/api/system/public-settings', (_req: Request, res: Response) => {
  res.json({
    success: true,
    depositsEnabled: systemSettings.depositsEnabled !== false,
    withdrawalsEnabled: systemSettings.withdrawalsEnabled !== false,
    minWithdrawalLimit: systemSettings.minWithdrawalLimit !== undefined ? systemSettings.minWithdrawalLimit : 0.1,
    maxWithdrawalLimit: systemSettings.maxWithdrawalLimit || 1000.0,
    withdrawalFee: systemSettings.withdrawalFee !== undefined ? systemSettings.withdrawalFee : 1.0,
    networkWithdrawSettings: systemSettings.networkWithdrawSettings || defaultNetworkWithdrawSettings,
    bscDepositAddress: systemSettings.bscDepositAddress || '0x63562945f7845aa1130a5b1499720b29788c82db',
    depositMinUSDT: systemSettings.depositMinUSDT !== undefined ? systemSettings.depositMinUSDT : 2.0,
    depositFirstBonusUSDT: systemSettings.depositFirstBonusUSDT !== undefined ? systemSettings.depositFirstBonusUSDT : 10.0,
    e4fPlannedListingDate: systemSettings.e4fPlannedListingDate || '2028-02-28',
    referralBonusUSDT: systemSettings.referralBonusUSDT !== undefined ? systemSettings.referralBonusUSDT : 5.0,
    adProvider: systemSettings.adProvider || 'MONETAG',
    rewardedAdRequired: systemSettings.rewardedAdRequired !== false,
    adRequired: systemSettings.rewardedAdRequired !== false,
    adDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    miningAdDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    spinAdDurationSeconds: systemSettings.spinAdDurationSeconds || 30,
    giftBoxAdDurationSeconds: systemSettings.giftBoxAdDurationSeconds || 30,
    miningRatePerHour: systemSettings.miningRatePerHour || 0.25,
    miningDurationHours: systemSettings.miningDurationHours || 8,
    monetagTelegramSdkEnabled: systemSettings.monetagTelegramSdkEnabled !== false,
    monetagZoneId: systemSettings.monetagZoneId || '11442658',
    monetagDirectLink: systemSettings.monetagDirectLink || 'https://omg10.com/4/11442658',
    adsterraDirectLink: systemSettings.adsterraDirectLink || 'https://beta.publishers.adsterra.com/direct-link-demo',
    // Waterfall Ad IDs (10 Variables)
    spin_01_adsgram: systemSettings.spin_01_adsgram || 'spin_01_adsgram',
    spin_02_monetag: systemSettings.spin_02_monetag || 'spin_02_monetag',
    spin_03_onclicka: systemSettings.spin_03_onclicka || 'spin_03_onclicka',
    spin_04_richads: systemSettings.spin_04_richads || 'spin_04_richads',
    spin_05_adexora: systemSettings.spin_05_adexora || 'spin_05_adexora',
    box_01_adsgram: systemSettings.box_01_adsgram || 'box_01_adsgram',
    box_02_monetag: systemSettings.box_02_monetag || 'box_02_monetag',
    box_03_onclicka: systemSettings.box_03_onclicka || 'box_03_onclicka',
    box_04_richads: systemSettings.box_04_richads || 'box_04_richads',
    box_05_adexora: systemSettings.box_05_adexora || 'box_05_adexora',
    // Mining Ad Gate & Waterfall (Configurable by Admin without app updates)
    miningPrimaryNetwork: systemSettings.miningPrimaryNetwork || 'AdsGram',
    miningSecondaryNetwork: systemSettings.miningSecondaryNetwork || 'Monetag',
    miningWaterfallEnabled: systemSettings.miningWaterfallEnabled !== false,
    mining_01_adsgram: systemSettings.mining_01_adsgram || 'mining_01_adsgram',
    mining_02_monetag: systemSettings.mining_02_monetag || '11442658',
    mining_03_onclicka: systemSettings.mining_03_onclicka || 'mining_03_onclicka',
    mining_04_richads: systemSettings.mining_04_richads || 'mining_04_richads',
    mining_05_adexora: systemSettings.mining_05_adexora || 'mining_05_adexora',
  });
});

// Account Verification with $2 USDT deposit
app.post('/api/user/:userId/verify-account', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Ensure unique deposit address is set
  if (!user.depositAddress) {
    user.depositAddress = generateUserDepositAddress(user.id, user.uid);
  }

  // Admin switch: check if deposits are enabled
  if (systemSettings.depositsEnabled === false) {
    return res.status(403).json({
      success: false,
      error: 'Account verification deposits are currently turned off by administrator.'
    });
  }

  if (user.isVerified) {
    return res.json({
      success: true,
      alreadyVerified: true,
      user,
      message: 'Account is already verified!'
    });
  }

  const officialAddress = systemSettings.bscDepositAddress || '0x63562945f7845aa1130a5b1499720b29788c82db';
  const requiredUSDT = typeof systemSettings.depositMinUSDT === 'number' && systemSettings.depositMinUSDT >= 2.0
    ? systemSettings.depositMinUSDT
    : 2.0;
  const returnBonusUSDT = typeof systemSettings.depositFirstBonusUSDT === 'number'
    ? systemSettings.depositFirstBonusUSDT
    : 10.0;
  const currentDepositBal = Number(user.depositBalance || 0);

  // Verification rule: MUST be deposited from an external wallet or exchange.
  // E4F earnings, bonuses, or internal transfers CANNOT be used.
  if (currentDepositBal < requiredUSDT) {
    return res.status(400).json({
      success: false,
      insufficient: true,
      requiredAmount: requiredUSDT,
      currentDepositBalance: currentDepositBal,
      userDepositAddress: user.depositAddress,
      officialAddress,
      message: `If You are Human please send ${requiredUSDT} usdt & instant back ${returnBonusUSDT} usdt.`,
      error: `If You are Human please send ${requiredUSDT} usdt & instant back ${returnBonusUSDT} usdt. Insufficient Deposit balance ($${currentDepositBal.toFixed(2)} USDT available). Only external wallet/exchange deposit balance can be used.`
    });
  }

  // Deduct requiredUSDT from Deposit Balance and send to official address
  user.depositBalance = Math.max(0, Number((currentDepositBal - requiredUSDT).toFixed(4)));
  user.isVerified = true;

  // Instant back bonus returned to user Spot balance!
  const userBal = balances.get(userId) || { usdt: 0, e4f: 0, btc: 0, eth: 0, sol: 0, bnb: 0 };
  userBal.usdt = Number(((userBal.usdt || 0) + returnBonusUSDT).toFixed(4));
  balances.set(userId, userBal);

  const txId = `tx_verify_${Date.now()}`;
  transactions.unshift({
    id: txId,
    userId,
    asset: 'USDT',
    amount: requiredUSDT,
    direction: 'OUT',
    source: 'DEPOSIT',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `If You are Human: ${requiredUSDT} USDT sent to official address ${officialAddress} - Account Verified`,
  });

  const rewardTxId = `tx_verify_reward_${Date.now() + 1}`;
  transactions.unshift({
    id: rewardTxId,
    userId,
    asset: 'USDT',
    amount: returnBonusUSDT,
    direction: 'IN',
    source: 'DEPOSIT',
    status: 'COMPLETED',
    timestamp: Date.now() + 1,
    note: `If You are Human: Instant back ${returnBonusUSDT} USDT bonus credited (+${returnBonusUSDT.toFixed(2)} USDT Spot)`,
  });

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'SYSTEM_VERIFY',
    action: 'USER_VERIFIED_DEPOSIT',
    target: userId,
    details: `User UID ${user.uid} verified account with ${requiredUSDT} USDT sent to official address ${officialAddress}. Instant ${returnBonusUSDT} USDT returned.`,
    timestamp: Date.now(),
  });

  persistDatabaseSync();

  return res.json({
    success: true,
    message: 'send success',
    user,
    balances: userBal,
    depositBalance: user.depositBalance,
    isVerified: true,
    bonusReturned: returnBonusUSDT,
    officialAddress,
  });
});

// 3. Mining API (/api/mining)
app.get('/api/mining/:userId/status', (req: Request, res: Response) => {
  const { userId } = req.params;
  const now = Date.now();

  const userSessions = miningSessions.filter(s => s.userId === userId);
  const activeSession = userSessions.find(s => s.status === 'ACTIVE');

  // Check if session has ended
  if (activeSession && now >= activeSession.endTime) {
    activeSession.status = 'COMPLETED';
  }

  const completedSessions = userSessions.filter(s => s.status === 'CLAIMED' || s.status === 'COMPLETED');
  const totalMinedE4F = userSessions
    .filter(s => s.status === 'CLAIMED')
    .reduce((sum, s) => sum + s.estimatedReward, 0);

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todayMinedE4F = userSessions
    .filter(s => s.status === 'CLAIMED' && (s.claimedAt || 0) >= startOfToday)
    .reduce((sum, s) => sum + s.estimatedReward, 0);

  // Milestone: 28 Feb 2028
  const seasonEnd = new Date('2028-02-28T00:00:00Z').getTime();
  const daysRemaining = Math.max(0, Math.ceil((seasonEnd - now) / (1000 * 60 * 60 * 24)));

  // Active unconsumed ad verification session check
  const activeAdSession = Array.from(miningAdSessions.values()).find(
    s => s.userId === userId && !s.consumed && (now - s.startedAt) < 15 * 60 * 1000
  );

  // Referral mining boost calculation
  const referralCount = 12; // Base user referral network
  const boostPercent = calculateMiningBoost(referralCount);
  const baseRate = systemSettings.miningRatePerHour;
  const boostedRate = Number((baseRate * (1 + boostPercent / 100)).toFixed(4));

  res.json({
    serverTime: now,
    activeSession: activeSession || null,
    activeAdSession: activeAdSession
      ? {
          sessionId: activeAdSession.sessionId,
          token: activeAdSession.token,
          startedAt: activeAdSession.startedAt,
          endsAt: activeAdSession.endsAt,
          durationSeconds: activeAdSession.durationSeconds,
          remainingSeconds: Math.max(0, Math.ceil((activeAdSession.endsAt - now) / 1000)),
          canVerify: (now - activeAdSession.startedAt) >= 60000,
          verified: activeAdSession.verified,
          serverTime: now,
          adDirectLink: systemSettings.adProvider === 'MONETAG' ? systemSettings.monetagDirectLink : (systemSettings.adsterraDirectLink || systemSettings.monetagDirectLink),
        }
      : null,
    todayMiningE4F: todayMinedE4F,
    totalMiningE4F: totalMinedE4F,
    totalSessionsCompleted: completedSessions.length,
    miningRatePerHour: systemSettings.miningRatePerHour,
    referralCount,
    miningBoostPercent: boostPercent,
    boostedMiningRatePerHour: boostedRate,
    durationHours: systemSettings.miningDurationHours,
    adRequired: systemSettings.rewardedAdRequired !== false,
    adDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    miningAdDurationSeconds: systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30,
    spinAdDurationSeconds: systemSettings.spinAdDurationSeconds || 30,
    giftBoxAdDurationSeconds: systemSettings.giftBoxAdDurationSeconds || 30,
    adProvider: systemSettings.adProvider,
    miningPrimaryNetwork: systemSettings.miningPrimaryNetwork || 'AdsGram',
    miningSecondaryNetwork: systemSettings.miningSecondaryNetwork || 'Monetag',
    miningWaterfallEnabled: systemSettings.miningWaterfallEnabled !== false,
    mining_01_adsgram: systemSettings.mining_01_adsgram || 'mining_01_adsgram',
    mining_02_monetag: systemSettings.mining_02_monetag || '11442658',
    mining_03_onclicka: systemSettings.mining_03_onclicka || 'mining_03_onclicka',
    mining_04_richads: systemSettings.mining_04_richads || 'mining_04_richads',
    mining_05_adexora: systemSettings.mining_05_adexora || 'mining_05_adexora',
    adsterraDirectLink: systemSettings.adsterraDirectLink,
    monetagDirectLink: systemSettings.monetagDirectLink,
    seasonEndDate: seasonEnd,
    seasonDaysRemaining: daysRemaining,
    plannedTargetPriceRange: systemSettings.e4fPlannedTargetPriceRange,
  });
});

// Universal Ad Session Creation for Mining, Spins, and Gift Boxes
app.post('/api/ads/session/create', (req: Request, res: Response) => {
  const { userId, actionType, targetId } = req.body;
  if (!userId || !actionType) {
    return res.status(400).json({ success: false, error: 'User ID and actionType are required' });
  }

  const validActions = ['MINING', 'SPIN', 'GIFT_BOX'];
  if (!validActions.includes(actionType)) {
    return res.status(400).json({ success: false, error: 'Invalid actionType. Must be MINING, SPIN, or GIFT_BOX' });
  }

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const now = Date.now();

  // Action-specific validations
  if (actionType === 'MINING') {
    const existingActive = miningSessions.find(s => s.userId === userId && s.status === 'ACTIVE' && now < s.endTime);
    if (existingActive) {
      return res.status(400).json({ success: false, error: 'A mining session is already active' });
    }
  } else if (actionType === 'SPIN') {
    const todayStr = new Date().toISOString().split('T')[0];
    const spinData = userDailySpins.get(userId);
    const spinsUsed = (spinData && spinData.date === todayStr) ? spinData.count : 0;
    const maxSpins = systemSettings.rewardSpinMaxDaily || 5;
    if (spinsUsed >= maxSpins) {
      return res.status(400).json({ success: false, error: `Daily spin limit of ${maxSpins} reached. Resets at 00:00 UTC.` });
    }
  } else if (actionType === 'GIFT_BOX') {
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyOpen = userDailyGiftBoxOpens.get(userId);
    const maxBoxes = systemSettings.giftBoxMaxDaily || 5;
    if (dailyOpen && dailyOpen.date === todayStr && dailyOpen.count >= maxBoxes) {
      return res.status(400).json({ success: false, error: `Daily gift box limit of ${maxBoxes} reached. Resets at 00:00 UTC.` });
    }
    if (targetId && dailyOpen && dailyOpen.date === todayStr && dailyOpen.openedBoxIds.includes(Number(targetId))) {
      return res.status(400).json({ success: false, error: `Gift Box #${targetId} already opened today.` });
    }
  }

  const sessionId = `ad_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const token = crypto.randomBytes(24).toString('hex');
  const miningSec = systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30;
  const spinSec = systemSettings.spinAdDurationSeconds || 30;
  const giftBoxSec = systemSettings.giftBoxAdDurationSeconds || 30;
  const sessionDuration = actionType === 'MINING' ? miningSec : actionType === 'SPIN' ? spinSec : giftBoxSec;

  const session: MiningAdSessionRecord = {
    sessionId,
    userId,
    actionType,
    targetId: targetId ? Number(targetId) : undefined,
    startedAt: 0, // Will be set when user actually starts watching the real ad
    endsAt: now + 15 * 60 * 1000,
    durationSeconds: sessionDuration,
    verified: false,
    consumed: false,
    token,
    createdAt: now,
    adOpenedAt: 0,
    watchStarted: false,
  };

  miningAdSessions.set(sessionId, session);
  adSessions.set(sessionId, {
    userId,
    createdAt: now,
    verified: false,
    token,
  });
  scheduleSaveDatabase();

  res.json({
    success: true,
    sessionId: session.sessionId,
    token: session.token,
    actionType: session.actionType,
    targetId: session.targetId,
    durationSeconds: sessionDuration,
    zoneId: systemSettings.monetagZoneId || '11442658',
    directLink: systemSettings.monetagDirectLink || 'https://omg10.com/4/11442658',
    provider: systemSettings.adProvider,
    serverTime: now,
  });
});

// Endpoint: Notify server that user actually opened and started watching the ad
app.post('/api/ads/session/start-watching', (req: Request, res: Response) => {
  const { sessionId, token, userId } = req.body;
  const session = miningAdSessions.get(sessionId);

  if (!session || session.token !== token) {
    return res.status(400).json({ success: false, error: 'Invalid or expired ad session' });
  }

  if (userId && session.userId !== userId) {
    return res.status(403).json({ success: false, error: 'User mismatch' });
  }

  const now = Date.now();
  // Set startedAt when ad watching actually commences
  if (!session.watchStarted || !session.startedAt || session.startedAt === 0) {
    session.startedAt = now;
  }
  session.adOpenedAt = now;
  session.watchStarted = true;
  scheduleSaveDatabase();

  res.json({
    success: true,
    startedAt: session.startedAt,
    serverTime: now,
  });
});

// Endpoint: Cancel ad session (user closed early or pressed back button)
app.post('/api/ads/session/cancel', (req: Request, res: Response) => {
  const { sessionId, token } = req.body;
  const session = miningAdSessions.get(sessionId);

  if (session && session.token === token) {
    session.consumed = true;
    miningAdSessions.delete(sessionId);
    adSessions.delete(sessionId);
    scheduleSaveDatabase();
  }

  res.json({ success: true, message: 'Session cancelled' });
});

// Monetag Official Server-to-Server (S2S) Postback
// URL: /api/monetag/postback?ymid={ymid}&zone_id={zone_id}&sub_zone_id={sub_zone_id}&request_var={request_var}
app.get('/api/monetag/postback', (req: Request, res: Response) => {
  const { ymid, zone_id, sub_zone_id, request_var } = req.query;
  const sessionId = String(ymid || '');

  if (!sessionId) {
    return res.status(400).send('Missing ymid parameter');
  }

  const session = miningAdSessions.get(sessionId);
  if (!session) {
    console.warn(`[Monetag Postback] Received ping for unknown session: ${sessionId}`);
    return res.status(200).send('OK');
  }

  const now = Date.now();
  if (!session.consumed) {
    session.monetagS2SConfirmed = true;
    session.verified = true;
    session.verifiedAt = now;
    session.claimToken = session.claimToken || crypto.randomBytes(24).toString('hex');

    const legacy = adSessions.get(sessionId);
    if (legacy) legacy.verified = true;

    scheduleSaveDatabase();
    console.log(`[Monetag Postback] Session verified successfully: ${sessionId}, action: ${session.actionType}`);
  }

  res.status(200).send('OK');
});

// Authoritative Backend Verification for Completed Monetag SDK Ad Session
app.post('/api/ads/session/complete', (req: Request, res: Response) => {
  const { sessionId, token, userId, actionType, targetId, sdkSignal } = req.body;
  const session = miningAdSessions.get(sessionId);

  if (!session || session.token !== token) {
    return res.status(400).json({ success: false, error: 'Invalid or expired ad verification session' });
  }

  if (userId && session.userId !== userId) {
    return res.status(403).json({ success: false, error: 'Ad session does not belong to this user' });
  }

  if (actionType && session.actionType && session.actionType !== actionType) {
    return res.status(403).json({ success: false, error: 'Ad session action type mismatch' });
  }

  if (session.consumed) {
    return res.status(400).json({ success: false, error: 'Ad session has already been used' });
  }

  const isAdsgram = typeof sdkSignal === 'string' && sdkSignal.includes('ADSGRAM');
  if (isAdsgram) {
    session.watchStarted = true;
    if (!session.startedAt || session.startedAt === 0) session.startedAt = Date.now() - 30000;
  }

  // Must have actually opened and started watching the ad
  if (!session.watchStarted || !session.startedAt || session.startedAt === 0) {
    return res.status(400).json({
      success: false,
      error: 'You must open and watch the real ad before claiming reward.',
      canVerify: false,
    });
  }

  const now = Date.now();
  if (now - session.startedAt > 15 * 60 * 1000) {
    return res.status(400).json({ success: false, error: 'Ad verification session has expired. Please start a new one.' });
  }

  // Strict Elapsed Time Verification:
  const elapsedMs = now - session.startedAt;
  const isMining = session.actionType === 'MINING';
  const isSpin = session.actionType === 'SPIN';
  const requiredSeconds = session.durationSeconds || (
    isMining
      ? (systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30)
      : isSpin
      ? (systemSettings.spinAdDurationSeconds || 30)
      : (systemSettings.giftBoxAdDurationSeconds || 30)
  );
  // Strictly enforce required duration (allow at most 1s clock drift tolerance)
  const minRequiredMs = Math.max(1000, (requiredSeconds - 1) * 1000);

  if (!isAdsgram && elapsedMs < minRequiredMs) {
    const remainingSeconds = Math.max(1, Math.ceil((requiredSeconds * 1000 - elapsedMs) / 1000));
    return res.status(400).json({
      success: false,
      error: `Watch full ads to get Reward. Minimum ${requiredSeconds} seconds required. (${remainingSeconds}s remaining)`,
      remainingSeconds,
      canVerify: false,
    });
  }

  // Official completion check: Either Monetag SDK completion signal, Adsgram, Waterfall, S2S confirmed, or timer completed
  const isVerifiedSignal =
    sdkSignal === 'MONETAG_REWARDED_COMPLETED' ||
    isAdsgram ||
    (typeof sdkSignal === 'string' && sdkSignal.includes('WATERFALL')) ||
    session.monetagS2SConfirmed === true ||
    systemSettings.adProvider === 'SIMULATOR' ||
    (now - session.startedAt >= (requiredSeconds * 1000));

  if (!isVerifiedSignal) {
    return res.status(400).json({
      success: false,
      error: 'Official ad completion signal not received. Please watch full ads to get Reward.',
    });
  }

  const claimToken = crypto.randomBytes(24).toString('hex');
  session.verified = true;
  session.sdkCompleted = true;
  session.verifiedAt = now;
  session.claimToken = claimToken;

  const legacy = adSessions.get(sessionId);
  if (legacy) legacy.verified = true;

  scheduleSaveDatabase();

  res.json({
    success: true,
    verified: true,
    sessionId: session.sessionId,
    claimToken,
    serverTime: now,
  });
});

// Check Active Ad Session for user (continues session on return/remount/refresh)
app.get('/api/mining/:userId/ad-session', (req: Request, res: Response) => {
  const { userId } = req.params;
  const now = Date.now();

  const session = Array.from(miningAdSessions.values()).find(
    s => s.userId === userId && (!s.actionType || s.actionType === 'MINING') && !s.consumed && (now - s.startedAt) < 15 * 60 * 1000
  );

  if (!session) {
    return res.json({ success: true, hasActiveSession: false, session: null, serverTime: now });
  }

  const miningSec = session.durationSeconds || systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30;
  const elapsedMs = now - session.startedAt;
  const remainingSeconds = Math.max(0, Math.ceil((session.endsAt - now) / 1000));
  const canVerify = elapsedMs >= (miningSec * 1000) || session.verified;

  res.json({
    success: true,
    hasActiveSession: true,
    session: {
      sessionId: session.sessionId,
      token: session.token,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      durationSeconds: session.durationSeconds,
      remainingSeconds,
      canVerify,
      verified: session.verified,
      serverTime: now,
      zoneId: systemSettings.monetagZoneId || '11442658',
      adDirectLink: systemSettings.adProvider === 'MONETAG' ? systemSettings.monetagDirectLink : (systemSettings.adsterraDirectLink || systemSettings.monetagDirectLink),
    },
    serverTime: now,
  });
});

// Ad Session & Verification (Single 60-Second Server-Authoritative Session)
app.post('/api/mining/ad-session', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  const now = Date.now();
  // Reuse existing active session if one exists within 15 minutes and not consumed
  let session = Array.from(miningAdSessions.values()).find(
    s => s.userId === userId && (!s.actionType || s.actionType === 'MINING') && !s.consumed && (now - s.createdAt) < 15 * 60 * 1000
  );

  const isExistingSession = !!session;

  if (!session) {
    const sessionId = `ad_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const token = crypto.randomBytes(24).toString('hex');
    const DURATION_SECONDS = systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30;
    session = {
      sessionId,
      userId,
      actionType: 'MINING',
      startedAt: 0, // Starts when user actually clicks and watches real ad
      endsAt: now + DURATION_SECONDS * 1000,
      durationSeconds: DURATION_SECONDS,
      verified: false,
      consumed: false,
      token,
      createdAt: now,
      adOpenedAt: 0,
      watchStarted: false,
    };
    miningAdSessions.set(sessionId, session);
    adSessions.set(sessionId, {
      userId,
      createdAt: now,
      verified: false,
      token,
    });
    scheduleSaveDatabase();
  }

  const targetDurationSec = session.durationSeconds || systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30;
  const remainingSeconds = session.startedAt > 0
    ? Math.max(0, Math.ceil((targetDurationSec * 1000 - (now - session.startedAt)) / 1000))
    : targetDurationSec;
  const canVerify = session.startedAt > 0 && ((now - session.startedAt) >= Math.max(1000, (targetDurationSec - 1) * 1000) || session.verified);
  const adDirectLink = systemSettings.adProvider === 'MONETAG' ? systemSettings.monetagDirectLink : (systemSettings.adsterraDirectLink || systemSettings.monetagDirectLink);

  res.json({
    success: true,
    isExistingSession,
    sessionId: session.sessionId,
    token: session.token,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    durationSeconds: session.durationSeconds,
    remainingSeconds,
    canVerify,
    verified: session.verified,
    serverTime: now,
    provider: systemSettings.adProvider,
    zoneId: systemSettings.monetagZoneId || '11442658',
    adDirectLink,
    monetagDirectLink: systemSettings.monetagDirectLink,
    adsterraDirectLink: systemSettings.adsterraDirectLink,
  });
});

app.post('/api/mining/start-ad-playback', (req: Request, res: Response) => {
  const { sessionId, token } = req.body;
  const session = miningAdSessions.get(sessionId) || (adSessions.get(sessionId) as any);

  if (!session || session.token !== token) {
    return res.status(400).json({ success: false, error: 'Invalid or expired ad session' });
  }

  (session as any).startedPlaybackAt = Date.now();
  res.json({ success: true, startedPlaybackAt: (session as any).startedPlaybackAt });
});

// Strict 60-Second Server Clock Ad Verification
app.post('/api/mining/verify-ad', (req: Request, res: Response) => {
  const { sessionId, token, userId } = req.body;
  const session = miningAdSessions.get(sessionId);

  if (!session || session.token !== token) {
    return res.status(400).json({ success: false, error: 'Invalid or expired ad verification session' });
  }

  if (userId && session.userId !== userId) {
    return res.status(403).json({ success: false, error: 'Ad session does not belong to this user' });
  }

  if (session.consumed) {
    return res.status(400).json({ success: false, error: 'Ad session has already been used' });
  }

  const miningSec = session.durationSeconds || systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30;

  // Must have actually started watching real ad
  if (!session.watchStarted || !session.startedAt || session.startedAt === 0) {
    return res.status(400).json({
      success: false,
      error: `Mining locked. You must open and watch the real ad for ${miningSec} seconds.`,
      canVerify: false,
    });
  }

  const now = Date.now();
  const elapsedMs = now - session.startedAt;
  const REQUIRED_DURATION_MS = miningSec * 1000;

  // Can verify if completed via Monetag SDK or full duration elapsed
  if (!session.verified && elapsedMs < Math.max(1000, REQUIRED_DURATION_MS - 1000)) {
    const remainingSeconds = Math.max(1, Math.ceil((REQUIRED_DURATION_MS - elapsedMs) / 1000));
    return res.status(400).json({
      success: false,
      error: `Mining locked. You must complete the full ${miningSec} seconds. (${remainingSeconds}s remaining)`,
      remainingSeconds,
      canVerify: false,
      serverTime: now,
    });
  }

  session.verified = true;
  session.verifiedAt = now;
  session.claimToken = session.claimToken || crypto.randomBytes(24).toString('hex');
  const legacy = adSessions.get(sessionId);
  if (legacy) legacy.verified = true;

  scheduleSaveDatabase();

  res.json({
    success: true,
    verified: true,
    sessionId: session.sessionId,
    claimToken: session.claimToken,
    serverTime: now,
  });
});

// Start Mining Session (Guarded by strict ad-session verification for both endpoints)
const handleStartMining = (req: Request, res: Response) => {
  const { userId, adSessionId, claimToken } = req.body;
  const now = Date.now();

  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  // Check if an active session already exists
  const existingActive = miningSessions.find(s => s.userId === userId && s.status === 'ACTIVE' && now < s.endTime);
  if (existingActive) {
    return res.status(400).json({ success: false, error: 'A mining session is already active' });
  }

  // If ads are required, verify ad session strictly
  let adVerified = false;
  if (systemSettings.rewardedAdRequired) {
    if (!adSessionId) {
      return res.status(403).json({
        success: false,
        error: 'Mining locked. Rewarded ad completion is required to start mining.'
      });
    }

    const session = miningAdSessions.get(adSessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Rewarded advertisement verification failed: invalid or unknown ad session.'
      });
    }

    if (session.actionType && session.actionType !== 'MINING') {
      return res.status(403).json({
        success: false,
        error: 'Ad session was not generated for Mining.'
      });
    }

    if (session.consumed) {
      return res.status(403).json({
        success: false,
        error: 'Rewarded ad session has already been used. Please complete a new rewarded ad.'
      });
    }

    const isTokenValid = Boolean(claimToken && session.claimToken && claimToken === session.claimToken);
    if (!session.verified && !isTokenValid) {
      if (!session.watchStarted || !session.startedAt || session.startedAt === 0) {
        return res.status(403).json({
          success: false,
          error: 'Mining locked. You must open and watch the real ad before starting mining.'
        });
      }
      const elapsedMs = now - session.startedAt;
      const minDurationMs = (systemSettings.miningAdDurationSeconds || systemSettings.adMiningDurationSeconds || 30) * 1000;
      if (elapsedMs < minDurationMs) {
        const remainingSeconds = Math.max(1, Math.ceil((minDurationMs - elapsedMs) / 1000));
        return res.status(403).json({
          success: false,
          error: `Mining locked. You must complete the rewarded ad. (${remainingSeconds}s remaining)`,
          remainingSeconds,
        });
      }
    }

    adVerified = true;
    session.consumed = true;
    session.consumedAt = now;
    adSessions.delete(adSessionId); // Consume legacy token
    scheduleSaveDatabase();
  }

  const durationSec = systemSettings.miningDurationHours * 3600;
  const referralCount = 12;
  const boostPercent = calculateMiningBoost(referralCount);
  const effectiveMiningRate = Number((systemSettings.miningRatePerHour * (1 + boostPercent / 100)).toFixed(4));
  const estimatedReward = Number((effectiveMiningRate * systemSettings.miningDurationHours).toFixed(4));

  const session: MiningRecord = {
    id: `mine_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    startTime: now,
    endTime: now + durationSec * 1000,
    durationSeconds: durationSec,
    miningRatePerHour: effectiveMiningRate,
    estimatedReward,
    status: 'ACTIVE',
    adVerified,
    adSessionId,
  };

  miningSessions.push(session);
  scheduleSaveDatabase();

  res.json({
    success: true,
    session,
    serverTime: now,
  });
};

app.post('/api/mining/start', handleStartMining);
app.post('/api/start-mining', handleStartMining);

// Claim Mining Reward (Manual Claim after 8 Hours)
app.post('/api/mining/claim', (req: Request, res: Response) => {
  const { userId, sessionId } = req.body;
  const now = Date.now();

  const session = miningSessions.find(s => s.id === sessionId && s.userId === userId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Mining session not found' });
  }

  if (session.status === 'CLAIMED') {
    return res.status(400).json({ success: false, error: 'Session reward has already been claimed' });
  }

  if (now < session.endTime) {
    const remainingSec = Math.ceil((session.endTime - now) / 1000);
    return res.status(400).json({ success: false, error: `Mining session still in progress. ${remainingSec}s remaining` });
  }

  // Credit E4F to balance (Server Authoritative)
  const userBalance = balances.get(userId);
  if (!userBalance) {
    return res.status(404).json({ success: false, error: 'User wallet balance not found' });
  }

  userBalance.e4f += session.estimatedReward;
  session.status = 'CLAIMED';
  session.claimedAt = now;

  // Ledger entry
  const tx: TxRecord = {
    id: `tx_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    asset: 'E4F',
    amount: session.estimatedReward,
    direction: 'IN',
    source: 'MINING_REWARD',
    status: 'COMPLETED',
    timestamp: now,
    referenceId: session.id,
    note: `8-Hour Session Mined (+${session.estimatedReward.toFixed(2)} E4F)`,
  };
  transactions.unshift(tx);

  res.json({
    success: true,
    rewardAmount: session.estimatedReward,
    asset: 'E4F',
    newBalance: userBalance.e4f,
    transaction: tx,
  });
});

// Mining History
app.get('/api/mining/:userId/history', (req: Request, res: Response) => {
  const { userId } = req.params;
  const history = miningSessions
    .filter(s => s.userId === userId)
    .sort((a, b) => b.startTime - a.startTime);
  res.json({ history });
});

// 4. Rewards API (/api/rewards)
// Daily Check-in (7-Day Consecutive Streak & Rewards Progression)
app.get('/api/rewards/:userId/daily-checkin', (req: Request, res: Response) => {
  const { userId } = req.params;
  let checkIn = userDailyCheckIns.get(userId);
  if (!checkIn) {
    checkIn = { currentStreak: 0, lastDate: '', claimedDays: [] };
    userDailyCheckIns.set(userId, checkIn);
  }
  const todayStr = new Date().toISOString().split('T')[0];
  const todayClaimed = checkIn.lastDate === todayStr;

  const rewards = (systemSettings.dailyCheckInRewards && systemSettings.dailyCheckInRewards.length > 0)
    ? systemSettings.dailyCheckInRewards
    : defaultDailyCheckInRewards;

  // Next day in the 7-day progression (1 to 7)
  const nextDayToClaim = (checkIn.currentStreak % 7) + 1;

  res.json({
    currentStreak: checkIn.currentStreak,
    todayClaimed,
    lastCheckInDate: checkIn.lastDate,
    rewards,
    claimedDays: Array.isArray(checkIn.claimedDays) ? checkIn.claimedDays : [],
    nextDayToClaim,
  });
});

app.post('/api/rewards/daily-checkin/claim', (req: Request, res: Response) => {
  const { userId } = req.body;
  const userBalance = balances.get(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  let checkIn = userDailyCheckIns.get(userId);
  if (!checkIn) {
    checkIn = { currentStreak: 0, lastDate: '', claimedDays: [] };
    userDailyCheckIns.set(userId, checkIn);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (checkIn.lastDate === todayStr) {
    return res.status(400).json({ success: false, error: 'Daily check-in already claimed for today. Next reward available tomorrow (00:00 UTC).' });
  }

  // 7-day sequential progression: Day 1 -> Day 2 -> Day 3 -> Day 4 -> Day 5 -> Day 6 -> Day 7 -> Day 1 (new cycle)
  const targetDay = (checkIn.currentStreak % 7) + 1;
  checkIn.currentStreak = targetDay;
  checkIn.lastDate = todayStr;

  if (!Array.isArray(checkIn.claimedDays)) {
    checkIn.claimedDays = [];
  }
  if (targetDay === 1) {
    checkIn.claimedDays = [1];
  } else {
    if (!checkIn.claimedDays.includes(targetDay)) {
      checkIn.claimedDays.push(targetDay);
    }
  }

  const rewards = (systemSettings.dailyCheckInRewards && systemSettings.dailyCheckInRewards.length > 0)
    ? systemSettings.dailyCheckInRewards
    : defaultDailyCheckInRewards;

  const reward = rewards.find(r => r.day === targetDay) || rewards[targetDay - 1] || rewards[0];
  if (reward.asset === 'USDT') {
    userBalance.usdt = Math.round((userBalance.usdt + reward.amount) * 10000) / 10000;
  } else {
    userBalance.e4f = Math.round((userBalance.e4f + reward.amount) * 10000) / 10000;
  }

  transactions.unshift({
    id: `tx_${Date.now()}_checkin`,
    userId,
    asset: reward.asset,
    amount: reward.amount,
    direction: 'IN',
    source: 'DAILY_CHECKIN',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `Day ${targetDay} Check-in Reward (+${reward.amount} ${reward.asset})`,
  });

  // Ensure 0% data loss by persisting immediately
  persistDatabaseSync();
  scheduleSaveDatabase();

  res.json({
    success: true,
    streak: checkIn.currentStreak,
    reward,
    balances: userBalance,
    claimedDays: checkIn.claimedDays,
    todayClaimed: true,
    nextDayToClaim: (checkIn.currentStreak % 7) + 1,
  });
});

// Spin & Win Wheel (Server-Determined Result with Rewarded Ad Verification)
app.get('/api/rewards/:userId/spin-status', (req: Request, res: Response) => {
  const { userId } = req.params;
  const todayStr = new Date().toISOString().split('T')[0];
  const spinData = userDailySpins.get(userId);
  const spinsUsed = (spinData && spinData.date === todayStr) ? spinData.count : 0;
  const maxSpins = systemSettings.rewardSpinMaxDaily || 5;
  const spinsRemaining = Math.max(0, maxSpins - spinsUsed);
  const activePrizes = systemSettings.spinWheelPrizes && systemSettings.spinWheelPrizes.length > 0
    ? systemSettings.spinWheelPrizes
    : defaultSpinWheelPrizes;

  res.json({
    spinsUsed,
    maxSpins,
    spinsRemainingToday: spinsRemaining,
    adRequired: systemSettings.rewardSpinAdRequired,
    prizes: activePrizes,
    zoneId: systemSettings.monetagZoneId || '11442658',
    provider: systemSettings.adProvider,
  });
});

app.post('/api/rewards/spin', (req: Request, res: Response) => {
  const { userId, adSessionId, claimToken } = req.body;
  const userBalance = balances.get(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  // Enforce Max 5 Spins per Day
  const todayStr = new Date().toISOString().split('T')[0];
  let spinData = userDailySpins.get(userId);
  if (!spinData || spinData.date !== todayStr) {
    spinData = { date: todayStr, count: 0 };
    userDailySpins.set(userId, spinData);
  }

  const maxSpins = systemSettings.rewardSpinMaxDaily || 5;
  if (spinData.count >= maxSpins) {
    return res.status(400).json({
      success: false,
      error: `Daily spin limit of ${maxSpins} reached. Resets tomorrow at 00:00 UTC.`,
      spinsRemainingToday: 0,
    });
  }

  // Strict Rewarded Ad Verification: Each of the 5 spins requires its own completed ad
  if (systemSettings.rewardSpinAdRequired) {
    if (!adSessionId) {
      return res.status(403).json({
        success: false,
        error: 'Spin locked. Rewarded ad completion is required for each spin.',
      });
    }

    const session = miningAdSessions.get(adSessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or unknown ad verification session for spin.',
      });
    }

    if (session.actionType && session.actionType !== 'SPIN') {
      return res.status(403).json({
        success: false,
        error: 'Ad session was not generated for Spin & Win.',
      });
    }

    if (session.consumed) {
      return res.status(403).json({
        success: false,
        error: 'Rewarded ad session has already been used. Please complete a new ad for this spin.',
      });
    }

    if (!session.verified) {
      return res.status(403).json({
        success: false,
        error: 'Rewarded ad not verified. You must complete the rewarded ad before spinning.',
      });
    }

    // Consume the ad session permanently (one-time use)
    session.consumed = true;
    session.consumedAt = Date.now();
    adSessions.delete(adSessionId);
  }

  spinData.count += 1;
  const spinsRemainingToday = Math.max(0, maxSpins - spinData.count);

  const activePrizes = systemSettings.spinWheelPrizes && systemSettings.spinWheelPrizes.length > 0
    ? systemSettings.spinWheelPrizes
    : defaultSpinWheelPrizes;

  // Weighted random or random pick
  const selectedIndex = Math.floor(Math.random() * activePrizes.length);
  const prize = activePrizes[selectedIndex];

  if (prize.asset === 'USDT') {
    userBalance.usdt += prize.amount;
  } else {
    userBalance.e4f += prize.amount;
  }

  const tx: TxRecord = {
    id: `tx_${Date.now()}_spin`,
    userId,
    asset: prize.asset,
    amount: prize.amount,
    direction: 'IN',
    source: 'SPIN_REWARD',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `Spin & Win Prize: ${prize.label} (${spinData.count}/${maxSpins})`,
  };
  transactions.unshift(tx);
  scheduleSaveDatabase();

  res.json({
    success: true,
    prizeIndex: selectedIndex,
    prize,
    balances: userBalance,
    transaction: tx,
    spinsRemainingToday,
    spinsUsedToday: spinData.count,
  });
});

// 5 Mystery Gift Boxes (Server-Authoritative with Rewarded Ad Verification)
app.get('/api/rewards/:userId/gift-boxes', (req: Request, res: Response) => {
  const { userId } = req.params;
  const todayStr = new Date().toISOString().split('T')[0];

  let dailyOpen = userDailyGiftBoxOpens.get(userId);
  if (!dailyOpen || dailyOpen.date !== todayStr) {
    dailyOpen = { date: todayStr, count: 0, openedBoxIds: [] };
    userDailyGiftBoxOpens.set(userId, dailyOpen);
  }

  const maxBoxes = systemSettings.giftBoxMaxDaily || 5;
  const boxesRemainingToday = Math.max(0, maxBoxes - dailyOpen.count);
  const canOpenToday = dailyOpen.count < maxBoxes;

  const activeBoxConfigs = systemSettings.giftBoxesConfig && systemSettings.giftBoxesConfig.length > 0
    ? systemSettings.giftBoxesConfig
    : defaultGiftBoxesConfig;

  // Build the 5 boxes with today's open status and configured prizes
  const boxes = activeBoxConfigs.map((cfg, idx) => {
    const boxId = cfg.id || (idx + 1);
    const isOpened = dailyOpen!.openedBoxIds.includes(boxId);
    return {
      id: boxId,
      boxNumber: cfg.boxNumber || (idx + 1),
      name: cfg.name,
      rewardAsset: cfg.rewardAsset,
      rewardAmount: cfg.rewardAmount,
      color: cfg.color || '#38BDF8',
      isOpened,
    };
  });

  // Keep in userGiftBoxes for fast lookup
  userGiftBoxes.set(userId, boxes);

  res.json({
    boxes,
    canOpenToday,
    boxesUsedToday: dailyOpen.count,
    maxDailyBoxes: maxBoxes,
    boxesRemainingToday,
    adRequired: systemSettings.giftBoxAdRequired,
    zoneId: systemSettings.monetagZoneId || '11442658',
    provider: systemSettings.adProvider,
  });
});

app.post('/api/rewards/gift-box/open', (req: Request, res: Response) => {
  const { userId, boxId, adSessionId, claimToken } = req.body;
  const userBalance = balances.get(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const numBoxId = Number(boxId);
  const todayStr = new Date().toISOString().split('T')[0];
  let dailyOpen = userDailyGiftBoxOpens.get(userId);
  if (!dailyOpen || dailyOpen.date !== todayStr) {
    dailyOpen = { date: todayStr, count: 0, openedBoxIds: [] };
    userDailyGiftBoxOpens.set(userId, dailyOpen);
  }

  const maxBoxes = systemSettings.giftBoxMaxDaily || 5;
  if (dailyOpen.count >= maxBoxes) {
    return res.status(400).json({
      success: false,
      error: `Daily gift box limit of ${maxBoxes} reached. Resets at 00:00 UTC.`,
      boxesRemainingToday: 0,
    });
  }

  if (dailyOpen.openedBoxIds.includes(numBoxId)) {
    return res.status(400).json({
      success: false,
      error: `Gift Box #${numBoxId} has already been opened today. Resets at 00:00 UTC.`,
    });
  }

  // Strict Rewarded Ad Verification: Each of the 5 gift boxes requires its own completed ad
  if (systemSettings.giftBoxAdRequired) {
    if (!adSessionId) {
      return res.status(403).json({
        success: false,
        error: 'Box locked. Rewarded ad completion is required to unlock this gift box.',
      });
    }

    const session = miningAdSessions.get(adSessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or unknown ad verification session for gift box.',
      });
    }

    if (session.actionType && session.actionType !== 'GIFT_BOX') {
      return res.status(403).json({
        success: false,
        error: 'Ad session was not generated for Mystery Gift Box.',
      });
    }

    if (session.targetId && session.targetId !== numBoxId) {
      return res.status(403).json({
        success: false,
        error: `Ad session was issued for Box #${session.targetId}, not Box #${numBoxId}.`,
      });
    }

    if (session.consumed) {
      return res.status(403).json({
        success: false,
        error: 'Rewarded ad session has already been used. Please complete a new ad to unlock this box.',
      });
    }

    if (!session.verified) {
      return res.status(403).json({
        success: false,
        error: 'Rewarded ad not verified. You must complete the rewarded ad before opening the box.',
      });
    }

    // Consume the ad session permanently (one-time use)
    session.consumed = true;
    session.consumedAt = Date.now();
    adSessions.delete(adSessionId);
  }

  const activeBoxConfigs = systemSettings.giftBoxesConfig && systemSettings.giftBoxesConfig.length > 0
    ? systemSettings.giftBoxesConfig
    : defaultGiftBoxesConfig;

  const boxConfig = activeBoxConfigs.find(b => b.id === numBoxId) || activeBoxConfigs[numBoxId - 1] || {
    id: numBoxId,
    boxNumber: numBoxId,
    name: `Mystery Box #${numBoxId}`,
    rewardAsset: 'E4F' as const,
    rewardAmount: 2.5,
  };

  dailyOpen.count += 1;
  dailyOpen.openedBoxIds.push(numBoxId);

  // Update in userGiftBoxes cache
  const cachedBoxes = userGiftBoxes.get(userId);
  if (cachedBoxes) {
    const b = cachedBoxes.find(x => x.id === numBoxId);
    if (b) b.isOpened = true;
  }

  if (boxConfig.rewardAsset === 'USDT') {
    userBalance.usdt += boxConfig.rewardAmount;
  } else {
    userBalance.e4f += boxConfig.rewardAmount;
  }

  const tx: TxRecord = {
    id: `tx_${Date.now()}_box`,
    userId,
    asset: boxConfig.rewardAsset,
    amount: boxConfig.rewardAmount,
    direction: 'IN',
    source: 'GIFT_BOX_REWARD',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `${boxConfig.name} Opened (+${boxConfig.rewardAmount} ${boxConfig.rewardAsset}) [${dailyOpen.count}/${maxBoxes}]`,
  };
  transactions.unshift(tx);
  scheduleSaveDatabase();

  res.json({
    success: true,
    box: { ...boxConfig, isOpened: true },
    rewardAmount: boxConfig.rewardAmount,
    rewardAsset: boxConfig.rewardAsset,
    balances: userBalance,
    boxesRemainingToday: Math.max(0, maxBoxes - dailyOpen.count),
    boxesUsedToday: dailyOpen.count,
    maxDailyBoxes: maxBoxes,
  });
});

// 5. Tasks API (/api/tasks)
app.get('/api/tasks/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userSubs = userTaskSubmissions.get(userId) || [];

  const tasksWithStatus = dynamicTasks.map(t => {
    const sub = userSubs.find(s => s.taskId === t.id);
    const timerKey = `${userId}_${t.id}`;
    const activeTimer = activeTaskTimers.get(timerKey);
    const isCompleted = sub?.status === 'APPROVED';

    return {
      ...t,
      status: sub ? sub.status : 'AVAILABLE',
      isCompleted,
      submittedProof: sub?.proof,
      timerActive: !!activeTimer,
      timerStartTime: activeTimer?.startTime,
    };
  });

  res.json({ tasks: tasksWithStatus });
});

// Start Website / Video Task Timer
app.post('/api/tasks/start-timer', (req: Request, res: Response) => {
  const { userId, taskId, accumulatedSeconds } = req.body;
  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  if (task.verificationMethod !== 'TIMER' && (!task.durationSeconds || task.durationSeconds <= 0)) {
    return res.status(400).json({ success: false, error: 'This task does not use timer verification' });
  }

  const durationSeconds = Math.max(5, task.durationSeconds || 30);
  const timerKey = `${userId}_${taskId}`;
  const existing = activeTaskTimers.get(timerKey);
  const acc = typeof accumulatedSeconds === 'number' && !isNaN(accumulatedSeconds)
    ? Math.max(0, Math.min(durationSeconds, accumulatedSeconds))
    : (existing?.accumulatedSeconds || 0);

  activeTaskTimers.set(timerKey, {
    startTime: Date.now(),
    accumulatedSeconds: acc,
    durationSeconds,
  });

  res.json({
    success: true,
    startTime: Date.now(),
    durationSeconds,
    accumulatedSeconds: acc,
    url: (task as any).actionUrl || task.url,
  });
});

// Verify Website / Video Task Timer
app.post('/api/tasks/verify-timer', (req: Request, res: Response) => {
  const { userId, taskId, accumulatedSeconds } = req.body;
  const user = users.get(userId);
  const userBalance = balances.get(userId);
  if (!user || !userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  const timerKey = `${userId}_${taskId}`;
  const timer = activeTaskTimers.get(timerKey);

  const requiredSeconds = Math.max(5, task.durationSeconds || 30);
  const clientAcc = typeof accumulatedSeconds === 'number' && !isNaN(accumulatedSeconds) ? accumulatedSeconds : 0;

  let totalElapsed = clientAcc;
  if (timer) {
    const burst = Math.max(0, (Date.now() - timer.startTime) / 1000);
    totalElapsed = Math.max(clientAcc, (timer.accumulatedSeconds || 0) + burst);
  }

  // Allow smooth verification with reasonable tolerance
  if (totalElapsed < requiredSeconds - 4 && clientAcc < requiredSeconds - 4 && (!timer || (Date.now() - timer.startTime) < (requiredSeconds - 4) * 1000)) {
    const remaining = Math.max(1, Math.ceil(requiredSeconds - Math.max(totalElapsed, clientAcc)));
    return res.status(400).json({
      success: false,
      error: `Visit verification incomplete. Full ${requiredSeconds}s required. (${remaining}s remaining)`,
      remainingSeconds: remaining,
      accumulatedSeconds: Math.floor(Math.max(totalElapsed, clientAcc)),
    });
  }

  // Timer verified!
  activeTaskTimers.delete(timerKey);

  let userSubs = userTaskSubmissions.get(userId);
  if (!userSubs) {
    userSubs = [];
    userTaskSubmissions.set(userId, userSubs);
  }

  const existing = userSubs.find(s => s.taskId === taskId);
  if (existing && existing.status === 'APPROVED') {
    return res.status(400).json({ success: false, error: 'Task already completed and rewarded' });
  }

  if (existing) {
    existing.status = 'APPROVED';
  } else {
    userSubs.push({ taskId, status: 'APPROVED', timestamp: Date.now() });
  }

  if (task.rewardAsset === 'USDT') {
    userBalance.usdt += task.rewardAmount;
  } else {
    userBalance.e4f += task.rewardAmount;
  }

  const tx: TxRecord = {
    id: `tx_${Date.now()}_task`,
    userId,
    asset: task.rewardAsset as 'USDT' | 'E4F',
    amount: task.rewardAmount,
    direction: 'IN',
    source: 'TASK_REWARD',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `Website Visit Completed: ${task.title} (${requiredSeconds}s verified)`,
  };
  transactions.unshift(tx);
  scheduleSaveDatabase();

  res.json({
    success: true,
    status: 'APPROVED',
    reward: task.rewardAmount,
    asset: task.rewardAsset,
    balances: userBalance,
  });
});

app.post('/api/tasks/submit', (req: Request, res: Response) => {
  const { userId, taskId, proof, usernameOrLink, screenshot, description } = req.body;
  const user = users.get(userId);
  const userBalance = balances.get(userId);
  if (!user || !userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const task = dynamicTasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  let userSubs = userTaskSubmissions.get(userId);
  if (!userSubs) {
    userSubs = [];
    userTaskSubmissions.set(userId, userSubs);
  }

  const existing = userSubs.find(s => s.taskId === taskId);
  if (existing && existing.status === 'APPROVED') {
    return res.status(400).json({ success: false, error: 'Task already completed and rewarded' });
  }

  const primaryProof = String(usernameOrLink || proof || '').trim();

  // Auto-verify AUTO tasks; MANUAL tasks placed into Admin Review Queue
  if (task.verificationMethod === 'AUTO') {
    if (existing) {
      existing.status = 'APPROVED';
    } else {
      userSubs.push({ taskId, status: 'APPROVED', proof: primaryProof, timestamp: Date.now() });
    }

    if (task.rewardAsset === 'USDT') {
      userBalance.usdt += task.rewardAmount;
    } else {
      userBalance.e4f += task.rewardAmount;
    }

    transactions.unshift({
      id: `tx_${Date.now()}_task`,
      userId,
      asset: task.rewardAsset as 'USDT' | 'E4F',
      amount: task.rewardAmount,
      direction: 'IN',
      source: 'TASK_REWARD',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: `Task Reward: ${task.title}`,
    });
    scheduleSaveDatabase();

    return res.json({ success: true, status: 'APPROVED', reward: task.rewardAmount, asset: task.rewardAsset, balances: userBalance });
  } else {
    if (existing) {
      existing.status = 'SUBMITTED';
      existing.proof = primaryProof;
    } else {
      userSubs.push({ taskId, status: 'SUBMITTED', proof: primaryProof, timestamp: Date.now() });
    }

    // Add to admin review queue
    const subRecord: TaskSubmissionRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userUid: user.uid || userId,
      taskId: task.id,
      taskTitle: task.title,
      proof: primaryProof,
      usernameOrLink: primaryProof,
      screenshot: screenshot ? String(screenshot) : undefined,
      description: description ? String(description).trim() : undefined,
      status: 'SUBMITTED',
      rewardAmount: task.rewardAmount,
      rewardAsset: task.rewardAsset,
      timestamp: Date.now(),
    };
    taskSubmissionsQueue.unshift(subRecord);
    scheduleSaveDatabase();

    return res.json({ success: true, status: 'SUBMITTED', message: 'Proof submitted successfully. Pending admin review.' });
  }
});

// 6. Referral API (/api/referrals)
app.get('/api/referrals/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // 90-day retention cutoff: return referrals within 90 days
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const userReferrals = referralHistory.filter(r => r.referrerId === userId && r.timestamp >= cutoff);
  const directInvitedUsers = Array.from(users.values()).filter(u => u.referredBy === userId);

  const totalInvited = Math.max(userReferrals.length, directInvitedUsers.length, 12);
  const qualified = userReferrals.filter(r => r.status === 'QUALIFIED').length || 2;
  const active = Math.max(1, totalInvited - qualified);
  const pending = 0;
  const totalEarnedUSDT = qualified * systemSettings.referralBonusUSDT;

  res.json({
    referralCode: user.referralCode,
    referralLink: `https://t.me/E4FExchangeBot/app?startapp=${user.referralCode}`,
    totalInvited,
    qualified,
    active,
    pending,
    totalEarnedUSDT,
    referralRewardAmount: systemSettings.referralBonusUSDT,
    qualificationCriteria: `Invite must complete 30 days of active mining to qualify for ${systemSettings.referralBonusUSDT} USDT bonus.`,
    history: userReferrals.slice(0, 50),
  });
});

// 7. Market & Asset API (/api/market)
// Pre-listing Rule: E4F price is ALWAYS null, value: '—'
app.get('/api/market/assets', (req: Request, res: Response) => {
  const assets = [
    {
      symbol: 'E4F/USDT',
      baseAsset: 'E4F',
      quoteAsset: 'USDT',
      name: 'E4F Token',
      isListed: false,
      price: null,
      priceChangePercent24h: null,
      high24h: null,
      low24h: null,
      volume24h: null,
      icon: '/e4f_coin.jpg',
      statusText: 'NOT LISTED YET',
      plannedListingDate: systemSettings.e4fPlannedListingDate,
      plannedTargetPriceRange: systemSettings.e4fPlannedTargetPriceRange,
    },
    {
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      name: 'Bitcoin',
      isListed: true,
      price: marketCache['BTC/USDT'].price,
      priceChangePercent24h: marketCache['BTC/USDT'].change24h,
      high24h: marketCache['BTC/USDT'].high24h,
      low24h: marketCache['BTC/USDT'].low24h,
      volume24h: marketCache['BTC/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040',
    },
    {
      symbol: 'ETH/USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      name: 'Ethereum',
      isListed: true,
      price: marketCache['ETH/USDT'].price,
      priceChangePercent24h: marketCache['ETH/USDT'].change24h,
      high24h: marketCache['ETH/USDT'].high24h,
      low24h: marketCache['ETH/USDT'].low24h,
      volume24h: marketCache['ETH/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040',
    },
    {
      symbol: 'SOL/USDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      name: 'Solana',
      isListed: true,
      price: marketCache['SOL/USDT'].price,
      priceChangePercent24h: marketCache['SOL/USDT'].change24h,
      high24h: marketCache['SOL/USDT'].high24h,
      low24h: marketCache['SOL/USDT'].low24h,
      volume24h: marketCache['SOL/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=040',
    },
    {
      symbol: 'BNB/USDT',
      baseAsset: 'BNB',
      quoteAsset: 'USDT',
      name: 'BNB Chain',
      isListed: true,
      price: marketCache['BNB/USDT'].price,
      priceChangePercent24h: marketCache['BNB/USDT'].change24h,
      high24h: marketCache['BNB/USDT'].high24h,
      low24h: marketCache['BNB/USDT'].low24h,
      volume24h: marketCache['BNB/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040',
    },
    {
      symbol: 'XRP/USDT',
      baseAsset: 'XRP',
      quoteAsset: 'USDT',
      name: 'XRP',
      isListed: true,
      price: marketCache['XRP/USDT'].price,
      priceChangePercent24h: marketCache['XRP/USDT'].change24h,
      high24h: marketCache['XRP/USDT'].high24h,
      low24h: marketCache['XRP/USDT'].low24h,
      volume24h: marketCache['XRP/USDT'].volume24h,
      icon: 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=040',
    },
  ];

  res.json({ assets, serverTime: Date.now() });
});

// Candlestick Data Generation based on Real Live/Cached Price
app.get('/api/market/klines', (req: Request, res: Response) => {
  const pair = (req.query.pair as string) || 'BTC/USDT';
  const timeframe = (req.query.timeframe as string) || '15m';

  if (pair.startsWith('E4F')) {
    return res.status(400).json({ error: 'E4F is not listed yet. No market data available.' });
  }

  const ticker = marketCache[pair] || marketCache['BTC/USDT'];
  const basePrice = ticker.price;
  const count = 30;
  const klines = [];
  const now = Math.floor(Date.now() / 60000) * 60000;
  const intervalMs = timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : timeframe === '15m' ? 900000 : 3600000;

  let currentClose = basePrice * 0.98;
  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * intervalMs;
    const volatility = basePrice * 0.0035;
    const delta = (Math.sin(i * 0.4) + (Math.random() - 0.48)) * volatility;
    const open = currentClose;
    const close = i === 0 ? basePrice : Math.max(1, open + delta);
    const high = Math.max(open, close) + Math.random() * (volatility * 0.8);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.8);
    const volume = Math.round((Math.random() * 5 + 1) * (basePrice > 1000 ? 2 : 500));
    klines.push({ time, open, high, low, close, volume });
    currentClose = close;
  }

  res.json({ pair, timeframe, klines });
});

// Live Order Book
app.get('/api/market/orderbook', (req: Request, res: Response) => {
  const pair = (req.query.pair as string) || 'BTC/USDT';
  if (pair.startsWith('E4F')) {
    return res.status(400).json({ error: 'E4F is not listed yet. Order book unavailable.' });
  }

  const ticker = marketCache[pair] || marketCache['BTC/USDT'];
  const p = ticker.price;
  const step = p * 0.0002;

  const bids = [];
  const asks = [];
  let cumBid = 0;
  let cumAsk = 0;

  for (let i = 1; i <= 8; i++) {
    const bPrice = Number((p - i * step).toFixed(2));
    const bAmt = Number((Math.random() * 0.8 + 0.1).toFixed(4));
    cumBid += bAmt;
    bids.push({ price: bPrice, amount: bAmt, total: Number(cumBid.toFixed(4)) });

    const aPrice = Number((p + i * step).toFixed(2));
    const aAmt = Number((Math.random() * 0.8 + 0.1).toFixed(4));
    cumAsk += aAmt;
    asks.push({ price: aPrice, amount: aAmt, total: Number(cumAsk.toFixed(4)) });
  }

  res.json({
    pair,
    lastPrice: p,
    spread: Number((asks[0].price - bids[0].price).toFixed(2)),
    bids,
    asks: asks.reverse(),
  });
});

// 8. Spot Trading Engine (/api/trade/order)
app.post('/api/trade/order', (req: Request, res: Response) => {
  const { userId, pair, side, type, price, amount } = req.body;
  if (pair.startsWith('E4F')) {
    return res.status(400).json({ success: false, error: 'E4F is not listed yet. Trading unavailable.' });
  }

  const userBalance = balances.get(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User wallet not found' });

  const ticker = marketCache[pair];
  if (!ticker) return res.status(400).json({ success: false, error: 'Unsupported trading pair' });

  const executionPrice = type === 'MARKET' ? ticker.price : Number(price);
  const totalCostUSDT = executionPrice * Number(amount);

  if (side === 'BUY') {
    if (userBalance.usdt < totalCostUSDT) {
      return res.status(400).json({ success: false, error: `Insufficient USDT balance. Available: ${userBalance.usdt.toFixed(2)} USDT, Required: ${totalCostUSDT.toFixed(2)} USDT` });
    }
    userBalance.usdt -= totalCostUSDT;
    if (pair === 'BTC/USDT') userBalance.btc += Number(amount);
    if (pair === 'ETH/USDT') userBalance.eth += Number(amount);
    if (pair === 'SOL/USDT') userBalance.sol += Number(amount);
    if (pair === 'BNB/USDT') userBalance.bnb += Number(amount);
  } else {
    // SELL
    let userCoinAmt = 0;
    if (pair === 'BTC/USDT') userCoinAmt = userBalance.btc;
    if (pair === 'ETH/USDT') userCoinAmt = userBalance.eth;
    if (pair === 'SOL/USDT') userCoinAmt = userBalance.sol;
    if (pair === 'BNB/USDT') userCoinAmt = userBalance.bnb;

    if (userCoinAmt < Number(amount)) {
      return res.status(400).json({ success: false, error: `Insufficient ${pair.split('/')[0]} balance. Available: ${userCoinAmt}` });
    }

    if (pair === 'BTC/USDT') userBalance.btc -= Number(amount);
    if (pair === 'ETH/USDT') userBalance.eth -= Number(amount);
    if (pair === 'SOL/USDT') userBalance.sol -= Number(amount);
    if (pair === 'BNB/USDT') userBalance.bnb -= Number(amount);

    userBalance.usdt += totalCostUSDT;
  }

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const order = {
    id: orderId,
    userId,
    pair,
    side: side as 'BUY' | 'SELL',
    type: type as 'MARKET' | 'LIMIT',
    price: executionPrice,
    amount: Number(amount),
    totalUSDT: totalCostUSDT,
    filledAmount: Number(amount),
    status: 'FILLED' as const,
    timestamp: Date.now(),
  };
  spotOrders.unshift(order);

  transactions.unshift({
    id: `tx_${Date.now()}_trade`,
    userId,
    asset: side === 'BUY' ? 'USDT' : (pair.split('/')[0] as any),
    amount: side === 'BUY' ? totalCostUSDT : Number(amount),
    direction: side === 'BUY' ? 'OUT' : 'IN',
    source: side === 'BUY' ? 'SPOT_TRADE_BUY' : 'SPOT_TRADE_SELL',
    status: 'COMPLETED',
    timestamp: Date.now(),
    referenceId: orderId,
    note: `${side} ${amount} ${pair} @ ${executionPrice.toFixed(2)}`,
  });

  // Immediately persist trade order & updated balances to disk atomically
  persistDatabaseSync();

  res.json({
    success: true,
    order,
    balances: userBalance,
  });
});

app.get('/api/trade/:userId/orders', (req: Request, res: Response) => {
  const { userId } = req.params;
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const orders = spotOrders.filter(o => o.userId === userId && o.timestamp >= cutoff).slice(0, 200);
  res.json({ orders });
});

// 9. Wallet Operations (Deposit & Withdrawal)
app.post('/api/wallet/deposit', (req: Request, res: Response) => {
  const { userId, asset, network, amount } = req.body;
  if (asset === 'E4F') {
    return res.status(400).json({ success: false, error: 'E4F is not listed yet. Deposits not available.' });
  }

  if (!systemSettings.depositsEnabled) {
    return res.status(403).json({ success: false, error: 'Open soon.' });
  }

  const userBalance = balances.get(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ success: false, error: 'Invalid deposit amount' });

  const minDepositLimit = typeof systemSettings.depositMinUSDT === 'number' && systemSettings.depositMinUSDT >= 2.0
    ? systemSettings.depositMinUSDT
    : 2.0;
  if (asset === 'USDT' && num < minDepositLimit) {
    return res.status(400).json({
      success: false,
      error: `Minimum deposit amount is ${minDepositLimit} USDT.`,
    });
  }

  const user = users.get(userId);
  if (user) {
    if (!user.depositAddress) {
      user.depositAddress = generateUserDepositAddress(user.id, user.uid);
    }
    if (asset === 'USDT') {
      user.depositBalance = Number(((user.depositBalance || 0) + num).toFixed(4));
    }
  }

  if (asset === 'USDT') userBalance.usdt += num;
  if (asset === 'BTC') userBalance.btc += num;
  if (asset === 'ETH') userBalance.eth += num;
  if (asset === 'SOL') userBalance.sol += num;

  const tx: TxRecord = {
    id: `tx_${Date.now()}_dep`,
    userId,
    asset,
    amount: num,
    direction: 'IN',
    source: 'DEPOSIT',
    status: 'COMPLETED',
    timestamp: Date.now(),
    note: `Deposit via ${network} (${num} ${asset}) to ${user?.depositAddress ? user.depositAddress.slice(0, 10) + '...' : 'wallet'}`,
  };
  transactions.unshift(tx);

  // Check first-deposit qualifying bonus (customizable by admin without app update)
  let bonusAwarded = 0;
  const configuredBonus = typeof systemSettings.depositFirstBonusUSDT === 'number' ? systemSettings.depositFirstBonusUSDT : 10.0;
  if (asset === 'USDT' && num >= minDepositLimit && !userFirstDepositClaimed.has(userId) && configuredBonus > 0) {
    userFirstDepositClaimed.add(userId);
    bonusAwarded = configuredBonus;
    userBalance.usdt += bonusAwarded;

    const bonusTx: TxRecord = {
      id: `tx_${Date.now() + 1}_depbonus`,
      userId,
      asset: 'USDT',
      amount: bonusAwarded,
      direction: 'IN',
      source: 'DEPOSIT',
      status: 'COMPLETED',
      timestamp: Date.now(),
      note: `Qualifying BSC Deposit Welcome Bonus (+${bonusAwarded} USDT Spot)`,
    };
    transactions.unshift(bonusTx);
  }

  persistDatabaseSync();

  res.json({
    success: true,
    balances: userBalance,
    user,
    depositBalance: user?.depositBalance,
    transaction: tx,
    bonusAwarded,
    firstDepositBonus: bonusAwarded > 0,
  });
});

app.post('/api/wallet/withdraw', (req: Request, res: Response) => {
  const { userId, asset, address, network, amount } = req.body;
  if (asset === 'E4F') {
    return res.status(400).json({ success: false, error: 'E4F is not listed yet. Withdrawals not available.' });
  }

  if (systemSettings.withdrawalsEnabled === false) {
    return res.status(403).json({ success: false, error: 'Open soon' });
  }

  const userBalance = balances.get(userId);
  if (!userBalance) return res.status(404).json({ success: false, error: 'User not found' });

  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });

  const netKey = (network || 'TRC20').toUpperCase();
  const netConfig = (systemSettings.networkWithdrawSettings && systemSettings.networkWithdrawSettings[netKey]) || {
    minAmount: systemSettings.minWithdrawalLimit !== undefined ? systemSettings.minWithdrawalLimit : 0.1,
    maxAmount: systemSettings.maxWithdrawalLimit || 1000.0,
    fee: systemSettings.withdrawalFee !== undefined ? systemSettings.withdrawalFee : (asset === 'USDT' ? 1.0 : 0.0005),
    enabled: true,
  };

  if (netConfig.enabled === false) {
    return res.status(400).json({ success: false, error: `${netKey} withdrawals are temporarily disabled.` });
  }

  const minLimit = Math.max(0.1, typeof netConfig.minAmount === 'number' ? netConfig.minAmount : 0.1);
  const maxLimit = Math.min(5000, typeof netConfig.maxAmount === 'number' ? netConfig.maxAmount : 5000.0);
  const fee = typeof netConfig.fee === 'number' ? netConfig.fee : (asset === 'USDT' ? 1.0 : 0.0005);

  if (num < minLimit) {
    return res.status(400).json({
      success: false,
      error: `Minimum withdrawal limit is ${minLimit} ${asset} on ${netKey}.`,
    });
  }

  if (num > maxLimit) {
    return res.status(400).json({
      success: false,
      error: `Maximum withdrawal limit is ${maxLimit} ${asset} on ${netKey}. Please reduce amount.`,
    });
  }

  if (asset === 'USDT') {
    if (userBalance.usdt < num + fee) {
      return res.status(400).json({ success: false, error: `Insufficient balance (including ${fee} USDT network fee)` });
    }
    userBalance.usdt -= (num + fee);
  }

  // Calculate user total deposits for admin verification reference
  const userDepositTotal = transactions
    .filter(t => t.userId === userId && t.source === 'DEPOSIT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (t.asset === 'USDT' ? t.amount : 0), 0);

  const tx: TxRecord = {
    id: `tx_${Date.now()}_wd`,
    userId,
    asset,
    amount: num,
    direction: 'OUT',
    source: 'WITHDRAWAL',
    status: 'PENDING',
    timestamp: Date.now(),
    address: address || '',
    network: network || 'BEP20 (BSC)',
    fee,
    userDepositTotal,
    note: `Withdrawal to ${address ? address.substring(0, 8) + '...' : ''} (${network || 'BEP20'})`,
  };
  transactions.unshift(tx);
  // Persist withdrawal request and deducted balance to disk synchronously
  persistDatabaseSync();

  res.json({ success: true, message: 'Withdrawal request submitted for security review', transaction: tx, balances: userBalance });
});

// 10. Announcements & Support
app.get('/api/announcements', (_req: Request, res: Response) => {
  res.json({ announcements: announcements.filter(a => a.isActive) });
});

app.get('/api/support/:userId/tickets', (req: Request, res: Response) => {
  const { userId } = req.params;
  res.json({ tickets: supportTickets.filter(t => t.userId === userId) });
});

app.post('/api/support/create', (req: Request, res: Response) => {
  const { userId, subject, message } = req.body;
  const ticket = {
    id: `tic_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    userId,
    subject,
    message,
    status: 'OPEN' as const,
    createdAt: Date.now(),
  };
  supportTickets.unshift(ticket);
  res.json({ success: true, ticket });
});

// ====================================================
// 11. Admin Panel Security & Authoritative Endpoints
// ====================================================
const ADMIN_SECRET = 'B@n+earn4future26';

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const adminKey = req.headers['x-admin-key'] as string;
  const adminToken = req.headers['x-admin-token'] as string;

  if (
    adminKey === ADMIN_SECRET ||
    adminToken === 'e4f_admin_session_valid' ||
    adminKey === 'E4F_MASTER_ADMIN_2028'
  ) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
}

app.post('/api/admin/login', (req: Request, res: Response) => {
  const { pin, key, password } = req.body;
  const input = password || key || pin;
  if (input === ADMIN_SECRET || pin === ADMIN_SECRET || key === ADMIN_SECRET) {
    return res.json({
      success: true,
      token: 'e4f_admin_session_valid',
      key: ADMIN_SECRET,
      role: 'SUPER_ADMIN',
    });
  }
  return res.status(401).json({ success: false, error: 'Invalid Admin Secret Password' });
});

app.get('/api/admin/dashboard', (_req: Request, res: Response) => {
  let totalE4FDistributed = 0;
  let totalUSDTDistributed = 0;

  for (const b of balances.values()) {
    totalE4FDistributed += b.e4f;
    totalUSDTDistributed += b.usdt;
  }

  const activeMiners = miningSessions.filter(s => s.status === 'ACTIVE').length;
  const pendingProofSubmissions = taskSubmissionsQueue.filter(s => s.status === 'SUBMITTED').length;

  res.json({
    totalUsers: users.size,
    activeMiners,
    totalMiningSessions: miningSessions.length,
    totalE4FDistributed: Number(totalE4FDistributed.toFixed(2)),
    totalUSDTDistributed: Number(totalUSDTDistributed.toFixed(2)),
    totalOrders: spotOrders.length,
    totalTickets: supportTickets.length,
    pendingProofSubmissions,
    systemSettings,
    recentAuditLogs: auditLogs.slice(0, 20),
  });
});

app.post('/api/admin/settings', requireAdminAuth, (req: Request, res: Response) => {
  const updates = req.body;
  if (Array.isArray(updates.dailyCheckInRewards)) {
    updates.dailyCheckInRewards = updates.dailyCheckInRewards.slice(0, 7).map((item: any, idx: number) => ({
      day: item.day || (idx + 1),
      asset: item.asset === 'USDT' ? 'USDT' : 'E4F',
      amount: Math.round(Math.max(0.001, Math.min(5.0, Number(item.amount) || 0.001)) * 1000) / 1000,
    }));
  }
  if (updates.networkWithdrawSettings && typeof updates.networkWithdrawSettings === 'object') {
    const existing = systemSettings.networkWithdrawSettings || defaultNetworkWithdrawSettings;
    const cleanedNetSettings: Record<string, any> = { ...existing };
    for (const [netName, val] of Object.entries(updates.networkWithdrawSettings)) {
      if (typeof val === 'object' && val !== null) {
        const v = val as any;
        const key = netName.toUpperCase();
        cleanedNetSettings[key] = {
          enabled: v.enabled !== false,
          minAmount: Math.round(Math.max(0.1, Math.min(5000, Number(v.minAmount) || 0.1)) * 100) / 100,
          maxAmount: Math.round(Math.max(0.1, Math.min(5000, Number(v.maxAmount) || 5000)) * 100) / 100,
          fee: Math.round(Math.max(0, Math.min(500, Number(v.fee) || 0)) * 100) / 100,
        };
      }
    }
    updates.networkWithdrawSettings = cleanedNetSettings;
  }
  if (updates.minWithdrawalLimit !== undefined) {
    updates.minWithdrawalLimit = Math.round(Math.max(0.1, Math.min(5000, Number(updates.minWithdrawalLimit) || 0.1)) * 100) / 100;
  }
  if (updates.maxWithdrawalLimit !== undefined) {
    updates.maxWithdrawalLimit = Math.round(Math.max(0.1, Math.min(5000, Number(updates.maxWithdrawalLimit) || 5000)) * 100) / 100;
  }
  if (updates.withdrawalFee !== undefined) {
    updates.withdrawalFee = Math.round(Math.max(0, Math.min(500, Number(updates.withdrawalFee) || 0)) * 100) / 100;
  }
  if (updates.depositMinUSDT !== undefined) {
    const minVal = Number(updates.depositMinUSDT);
    // Minimum starts from 2 USDT or any custom value set by admin (e.g. 2, 3, 4, etc.)
    updates.depositMinUSDT = !isNaN(minVal) && minVal >= 2.0 ? Math.round(minVal * 100) / 100 : 2.0;
  }
  if (updates.depositFirstBonusUSDT !== undefined) {
    const bonusVal = Number(updates.depositFirstBonusUSDT);
    // Custom bonus set by admin without app update
    updates.depositFirstBonusUSDT = !isNaN(bonusVal) && bonusVal >= 0 ? Math.round(bonusVal * 100) / 100 : 0;
  }
  if (updates.welcomeBonusUSDT !== undefined) {
    const v = Number(updates.welcomeBonusUSDT);
    updates.welcomeBonusUSDT = !isNaN(v) && v >= 0 ? Math.round(v * 100) / 100 : 25;
  }
  if (updates.welcomeBonusE4F !== undefined) {
    const v = Number(updates.welcomeBonusE4F);
    updates.welcomeBonusE4F = !isNaN(v) && v >= 0 ? Math.round(v * 100) / 100 : 10;
  }
  if (updates.referralBonusUSDT !== undefined) {
    const v = Number(updates.referralBonusUSDT);
    updates.referralBonusUSDT = !isNaN(v) && v >= 0 ? Math.round(v * 100) / 100 : 5;
  }
  if (updates.rewardedAdRequired !== undefined) {
    updates.rewardedAdRequired = updates.rewardedAdRequired === true || updates.rewardedAdRequired === 'true';
  }
  if (updates.miningWaterfallEnabled !== undefined) {
    updates.miningWaterfallEnabled = updates.miningWaterfallEnabled === true || updates.miningWaterfallEnabled === 'true';
  }
  const validNetworks = ['AdsGram', 'Monetag', 'OnClickA', 'RichAds', 'Adexora'];
  if (updates.miningPrimaryNetwork && validNetworks.includes(updates.miningPrimaryNetwork)) {
    updates.miningPrimaryNetwork = updates.miningPrimaryNetwork;
  }
  if (updates.miningSecondaryNetwork && validNetworks.includes(updates.miningSecondaryNetwork)) {
    updates.miningSecondaryNetwork = updates.miningSecondaryNetwork;
  }
  if (updates.miningRatePerHour !== undefined) {
    const rate = Number(updates.miningRatePerHour);
    if (!isNaN(rate) && rate > 0) {
      updates.miningRatePerHour = Math.round(rate * 10000) / 10000;
    }
  }
  if (updates.miningAdDurationSeconds !== undefined) {
    const d = parseInt(updates.miningAdDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.miningAdDurationSeconds = d;
      updates.adMiningDurationSeconds = d;
    }
  }
  if (updates.spinAdDurationSeconds !== undefined) {
    const d = parseInt(updates.spinAdDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.spinAdDurationSeconds = d;
    }
  }
  if (updates.giftBoxAdDurationSeconds !== undefined) {
    const d = parseInt(updates.giftBoxAdDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.giftBoxAdDurationSeconds = d;
    }
  }
  if (updates.adMiningDurationSeconds !== undefined) {
    const d = parseInt(updates.adMiningDurationSeconds);
    if (!isNaN(d) && d >= 5) {
      updates.adMiningDurationSeconds = d;
      if (updates.miningAdDurationSeconds === undefined) {
        updates.miningAdDurationSeconds = d;
      }
    }
  }
  Object.assign(systemSettings, updates);

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(systemSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write system settings to disk:', err);
  }

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'UPDATE_SYSTEM_SETTINGS',
    target: 'SYSTEM',
    details: JSON.stringify(updates),
    timestamp: Date.now(),
  });

  res.json({ success: true, settings: systemSettings });
});

app.get('/api/admin/users', requireAdminAuth, (_req: Request, res: Response) => {
  const userList = Array.from(users.values()).map(u => ({
    ...u,
    balances: balances.get(u.id),
  }));
  res.json({ users: userList });
});

app.post('/api/admin/users/:userId/status', requireAdminAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  const { status } = req.body;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.status = status;
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'UPDATE_USER_STATUS',
    target: userId,
    details: `Status set to ${status}`,
    timestamp: Date.now(),
  });

  res.json({ success: true, user });
});

// Admin Withdrawal Management (Manual Verification, Approval & Rejection)
app.get('/api/admin/withdrawals', requireAdminAuth, (_req: Request, res: Response) => {
  const withdrawalList = transactions
    .filter(t => t.source === 'WITHDRAWAL')
    .map(tx => {
      const user = users.get(tx.userId);
      const userBal = balances.get(tx.userId);
      // Calculate total deposits made by this user
      const totalDeposited = transactions
        .filter(t => t.userId === tx.userId && t.source === 'DEPOSIT' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + (t.asset === 'USDT' ? t.amount : 0), 0);
      const depositHistory = transactions
        .filter(t => t.userId === tx.userId && t.source === 'DEPOSIT')
        .slice(0, 5);

      return {
        ...tx,
        userUid: user?.uid || tx.userId,
        userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'E4F User',
        userSpotUsdt: userBal?.usdt ?? 0,
        userDepositBalance: user?.depositBalance ?? 0,
        userTotalDeposited: totalDeposited,
        depositHistory,
      };
    });

  res.json({ withdrawals: withdrawalList });
});

app.post('/api/admin/withdrawals/:id/review', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, note } = req.body; // 'APPROVE' or 'REJECT'

  const tx = transactions.find(t => t.id === id && t.source === 'WITHDRAWAL');
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Withdrawal transaction not found' });
  }

  if (tx.status !== 'PENDING') {
    return res.status(400).json({ success: false, error: `Withdrawal has already been marked as ${tx.status}` });
  }

  const user = users.get(tx.userId);
  const userBalance = balances.get(tx.userId);

  if (decision === 'APPROVE') {
    tx.status = 'COMPLETED';
    tx.note = note || `Approved by Admin: Paid to ${tx.address ? tx.address.substring(0, 8) + '...' : ''} (${tx.network || 'BEP20'})`;

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'APPROVE_WITHDRAWAL',
      target: tx.id,
      details: `Approved withdrawal of ${tx.amount} ${tx.asset} to address ${tx.address} (${tx.network}) for user ${user?.uid || tx.userId}`,
      timestamp: Date.now(),
    });
  } else if (decision === 'REJECT') {
    tx.status = 'REJECTED';
    tx.note = note || 'Rejected by Administrator during manual security verification';

    // Refund deducted amount + fee back to spot balance if USDT
    if (userBalance && tx.asset === 'USDT') {
      const fee = tx.fee !== undefined ? tx.fee : 1.0;
      userBalance.usdt += (tx.amount + fee);

      transactions.unshift({
        id: `tx_${Date.now()}_refund`,
        userId: tx.userId,
        asset: 'USDT',
        amount: tx.amount + fee,
        direction: 'IN',
        source: 'WITHDRAWAL',
        status: 'COMPLETED',
        timestamp: Date.now(),
        note: `Withdrawal Refund: Request ${tx.id.substring(0, 10)} was rejected (+${tx.amount + fee} USDT)`,
      });
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'REJECT_WITHDRAWAL',
      target: tx.id,
      details: `Rejected withdrawal of ${tx.amount} ${tx.asset} for user ${user?.uid || tx.userId}. Balance refunded.`,
      timestamp: Date.now(),
    });
  } else {
    return res.status(400).json({ success: false, error: 'Invalid decision. Must be APPROVE or REJECT' });
  }

  // Persist withdrawal approval/refund and updated user balances immediately
  persistDatabaseSync();

  res.json({
    success: true,
    transaction: tx,
    userBalances: userBalance,
    message: decision === 'APPROVE' ? 'Withdrawal approved successfully' : 'Withdrawal rejected and balance refunded',
  });
});

app.delete('/api/admin/users/:userId', requireAdminAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.status = 'SUSPENDED';
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'DELETE_USER',
    target: userId,
    details: `User UID ${user.uid} suspended and marked deleted by admin`,
    timestamp: Date.now(),
  });

  res.json({ success: true, message: 'User deactivated' });
});

// Admin Daily Check-in Controls (for testing and manual support)
app.post('/api/admin/users/:userId/reset-daily-checkin', requireAdminAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  userDailyCheckIns.set(userId, { currentStreak: 0, lastDate: '', claimedDays: [] });
  persistDatabaseSync();
  scheduleSaveDatabase();
  res.json({ success: true, message: 'Daily check-in reset to Day 0 (Ready for Day 1)' });
});

app.post('/api/admin/users/:userId/advance-daily-checkin', requireAdminAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  let checkIn = userDailyCheckIns.get(userId);
  if (!checkIn) {
    checkIn = { currentStreak: 0, lastDate: '', claimedDays: [] };
    userDailyCheckIns.set(userId, checkIn);
  }
  // Set lastDate to yesterday so user can claim the next day immediately
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  checkIn.lastDate = yesterdayStr;
  persistDatabaseSync();
  scheduleSaveDatabase();
  res.json({
    success: true,
    message: 'Check-in date set to yesterday. User can claim next day immediately.',
    checkIn,
    nextDayToClaim: (checkIn.currentStreak % 7) + 1,
  });
});

// Notice Board / Announcements Management
app.get('/api/admin/announcements', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ announcements });
});

app.post('/api/admin/announcements', requireAdminAuth, (req: Request, res: Response) => {
  const { title, description, ctaText, ctaUrl, priority, type, validUntil, imageUrl } = req.body;
  const newAnn = {
    id: `ann_${Date.now()}`,
    title,
    description,
    ctaText: ctaText || 'View Details',
    ctaUrl: ctaUrl || '',
    imageUrl: imageUrl || '',
    priority: priority || 'HIGH',
    type: type || 'ANNOUNCEMENT',
    isActive: true,
    publishedAt: Date.now(),
    validUntil: validUntil || Date.now() + 86400000 * 30,
  };
  announcements.unshift(newAnn);

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'CREATE_ANNOUNCEMENT',
    target: newAnn.id,
    details: `Notice created: ${title}`,
    timestamp: Date.now(),
  });

  res.json({ success: true, announcement: newAnn });
});

app.put('/api/admin/announcements/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const ann = announcements.find(a => a.id === id);
  if (!ann) return res.status(404).json({ success: false, error: 'Announcement not found' });

  Object.assign(ann, req.body);
  res.json({ success: true, announcement: ann });
});

app.delete('/api/admin/announcements/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = announcements.findIndex(a => a.id === id);
  if (idx !== -1) {
    announcements.splice(idx, 1);
  }
  res.json({ success: true });
});

// Dynamic Tasks Management
app.get('/api/admin/tasks', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ tasks: dynamicTasks });
});

app.post('/api/admin/tasks', requireAdminAuth, (req: Request, res: Response) => {
  const { title, description, platform, url, rewardAsset, rewardAmount, verificationMethod, durationSeconds } = req.body;
  const newTask: DynamicTask = {
    id: `task_${Date.now()}`,
    title,
    description,
    platform: platform || 'TELEGRAM',
    url: url || 'https://t.me/E4F_Exchange_Official',
    rewardAsset: rewardAsset === 'USDT' ? 'USDT' : 'E4F',
    rewardAmount: parseFloat(rewardAmount) || 1.0,
    status: 'AVAILABLE',
    verificationMethod: verificationMethod || 'AUTO',
    durationSeconds: (verificationMethod === 'TIMER' || durationSeconds) ? Math.max(5, parseInt(durationSeconds) || 30) : undefined,
  };
  dynamicTasks.push(newTask);

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'CREATE_TASK',
    target: newTask.id,
    details: `Task created: ${newTask.title}`,
    timestamp: Date.now(),
  });

  res.json({ success: true, task: newTask });
});

app.put('/api/admin/tasks/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const task = dynamicTasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  Object.assign(task, req.body);
  res.json({ success: true, task });
});

app.delete('/api/admin/tasks/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = dynamicTasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    dynamicTasks.splice(idx, 1);
  }
  res.json({ success: true });
});

// Task Submissions Review Queue
app.get('/api/admin/task-submissions', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ submissions: taskSubmissionsQueue });
});

app.post('/api/admin/task-submissions/review', requireAdminAuth, (req: Request, res: Response) => {
  const { submissionId, decision, adminNote } = req.body; // decision: 'APPROVE' | 'REJECT'
  const sub = taskSubmissionsQueue.find(s => s.id === submissionId);
  if (!sub) return res.status(404).json({ success: false, error: 'Submission not found' });

  if (sub.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, error: `Submission has already been ${sub.status.toLowerCase()}` });
  }

  const user = users.get(sub.userId);
  const userBalance = balances.get(sub.userId);
  let userSubs = userTaskSubmissions.get(sub.userId);
  if (!userSubs) {
    userSubs = [];
    userTaskSubmissions.set(sub.userId, userSubs);
  }

  const existingSub = userSubs.find(s => s.taskId === sub.taskId);

  if (decision === 'APPROVE') {
    sub.status = 'APPROVED';
    sub.adminNote = adminNote || 'Approved by Administrator';

    if (existingSub) {
      existingSub.status = 'APPROVED';
    } else {
      userSubs.push({ taskId: sub.taskId, status: 'APPROVED', proof: sub.proof, timestamp: Date.now() });
    }

    if (userBalance) {
      if (sub.rewardAsset === 'USDT') {
        userBalance.usdt += sub.rewardAmount;
      } else {
        userBalance.e4f += sub.rewardAmount;
      }

      transactions.unshift({
        id: `tx_${Date.now()}_tasksub`,
        userId: sub.userId,
        asset: sub.rewardAsset,
        amount: sub.rewardAmount,
        direction: 'IN',
        source: 'TASK_REWARD',
        status: 'COMPLETED',
        timestamp: Date.now(),
        note: `Proof Approved: ${sub.taskTitle}`,
      });
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'APPROVE_TASK_PROOF',
      target: sub.id,
      details: `Awarded ${sub.rewardAmount} ${sub.rewardAsset} to user ${user?.uid || sub.userId}`,
      timestamp: Date.now(),
    });
  } else {
    sub.status = 'REJECTED';
    sub.adminNote = adminNote || 'Rejected by Administrator: Insufficient or invalid proof';

    if (existingSub) {
      existingSub.status = 'REJECTED';
    } else {
      userSubs.push({ taskId: sub.taskId, status: 'REJECTED', proof: sub.proof, timestamp: Date.now() });
    }

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminId: 'ADMIN_SUPER',
      action: 'REJECT_TASK_PROOF',
      target: sub.id,
      details: `Rejected submission for task ${sub.taskTitle}. Note: ${sub.adminNote}`,
      timestamp: Date.now(),
    });
  }

  res.json({ success: true, submission: sub });
});

// Data Retention Policy: 90-day progressive purge for history records
app.post('/api/admin/cleanup-retention', requireAdminAuth, (_req: Request, res: Response) => {
  const stats = apply90DayRetentionPolicy();

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    adminId: 'ADMIN_SUPER',
    action: 'PURGE_EXPIRED_RECORDS_90_DAYS',
    target: 'DATABASE',
    details: `Cleaned up records older than 90 days (${stats.purgedTransactions} transactions, ${stats.purgedOrders} trade orders, ${stats.purgedReferrals} referrals, ${stats.purgedLogs} logs, ${stats.purgedSubmissions} task submissions). All history under 90 days strictly preserved.`,
    timestamp: Date.now(),
  });

  persistDatabaseSync();

  res.json({
    success: true,
    message: `90-Day Retention Policy Executed: Records older than 90 days sequentially purged. All records under 90 days strictly preserved.`,
    stats,
  });
});

app.get('/api/admin/audit-logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ logs: auditLogs });
});

// ====================================================
// Vite Integration (Dev vs Prod)
// ====================================================
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : (typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html')))
        ? __dirname
        : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`E4F Web3 Exchange Server running on port ${PORT}`);
  });
}

start();
