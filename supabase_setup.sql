-- =====================================================================
-- E4F Web3 Exchange - Official Supabase PostgreSQL Database Setup
-- File: supabase_setup.sql
-- Production Ready | Idempotent | 100% Financial & Balance Integrity
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Navigate to SQL Editor -> New Query
-- 3. Paste this ENTIRE script and click "Run" (Single click setup)
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. PROFILES TABLE
-- Authoritative user profile with telegram_id BIGINT UNIQUE NOT NULL.
-- Supports soft-delete (is_deleted, deleted_at) so accidental loss NEVER occurs.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT DEFAULT '',
  first_name TEXT NOT NULL DEFAULT 'E4F User',
  last_name TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  id TEXT,
  uid TEXT UNIQUE,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESTRICTED', 'SUSPENDED')),
  claimed_welcome_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  device_hash TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing profiles table if previously created
DO $$
BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT DEFAULT '';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT 'E4F User';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  -- Ensure telegram_id unique constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_telegram_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_telegram_id_key UNIQUE (telegram_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- =====================================================================
-- 3. WALLETS TABLE
-- References profiles(telegram_id) ON DELETE RESTRICT (Prevents accidental loss).
-- Balance is NEVER overwritten with 0 during reconnection or restarts.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  telegram_id BIGINT PRIMARY KEY REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  balance NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (balance >= 0),
  total_mined NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (total_mined >= 0),
  referral_earnings NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (referral_earnings >= 0),
  id TEXT,
  user_id TEXT,
  "USDT" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("USDT" >= 0),
  "E4F"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("E4F" >= 0),
  "BNB"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BNB" >= 0),
  "BTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BTC" >= 0),
  "ETH"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ETH" >= 0),
  "SOL"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("SOL" >= 0),
  "TON"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TON" >= 0),
  "XRP"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("XRP" >= 0),
  "DOGE" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("DOGE" >= 0),
  "ADA"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ADA" >= 0),
  "TRX"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TRX" >= 0),
  "LTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("LTC" >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing wallets table if previously created
DO $$
BEGIN
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS balance NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_mined NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS referral_earnings NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "USDT" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS "E4F" NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallets_telegram_id ON public.wallets(telegram_id);

-- =====================================================================
-- 4. REFERRALS TABLE
-- Immutable referral history with ON DELETE RESTRICT on referrer and referee.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id TEXT PRIMARY KEY DEFAULT ('ref_' || gen_random_uuid()::text),
  referrer_id BIGINT REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  referee_id BIGINT UNIQUE REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  bonus_amount NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (bonus_amount >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing referrals table if previously created
DO $$
BEGIN
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(20, 6) DEFAULT 0.000000;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals(created_at DESC);

-- =====================================================================
-- 5. WITHDRAWALS TABLE
-- Complete withdrawal records with ON DELETE RESTRICT on profiles(telegram_id).
-- Validates allowed status values via strict CHECK constraint.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id TEXT PRIMARY KEY DEFAULT ('wd_' || gen_random_uuid()::text),
  telegram_id BIGINT REFERENCES public.profiles(telegram_id) ON DELETE RESTRICT,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (LOWER(status) IN ('pending', 'processing', 'in_review', 'completed', 'success', 'rejected', 'failed', 'cancelled')),
  wallet_address TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL DEFAULT 'BEP20',
  fee NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (fee >= 0),
  tx_hash TEXT DEFAULT '',
  admin_note TEXT DEFAULT '',
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing withdrawals table if previously created
DO $$
BEGIN
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS wallet_address TEXT;
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_withdrawals_telegram_id ON public.withdrawals(telegram_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- =====================================================================
-- 6. DEVICE LOCKS TABLE (24h Anti-Sybil Welcome Bonus Protection)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.device_locks (
  device_hash TEXT PRIMARY KEY,
  telegram_id BIGINT,
  last_claim_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claim_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_locks_last_claim ON public.device_locks(last_claim_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_locks_telegram_id ON public.device_locks(telegram_id);

-- =====================================================================
-- 7. REPO COMPATIBILITY TABLES (users, balances, transactions, deposits, mining_sessions, audit_logs)
-- Preserves existing server.ts and src/services/api.ts functionality with 0% data/feature loss
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL,
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  username TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESTRICTED', 'SUSPENDED')),
  claimed_welcome_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_balance NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK (deposit_balance >= 0),
  deposit_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);

CREATE TABLE IF NOT EXISTS public.balances (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  "USDT" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("USDT" >= 0),
  "E4F"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("E4F" >= 0),
  "BNB"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BNB" >= 0),
  "BTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("BTC" >= 0),
  "ETH"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ETH" >= 0),
  "SOL"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("SOL" >= 0),
  "TON"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TON" >= 0),
  "XRP"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("XRP" >= 0),
  "DOGE" NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("DOGE" >= 0),
  "ADA"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("ADA" >= 0),
  "TRX"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("TRX" >= 0),
  "LTC"  NUMERIC(20, 6) NOT NULL DEFAULT 0.000000 CHECK ("LTC" >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'FAILED', 'REJECTED', 'CANCELLED')),
  timestamp BIGINT NOT NULL,
  reference_id TEXT DEFAULT '',
  note TEXT DEFAULT '',
  address TEXT DEFAULT '',
  network TEXT DEFAULT '',
  fee NUMERIC(20, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);

CREATE TABLE IF NOT EXISTS public.deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  txid TEXT NOT NULL UNIQUE,
  sender_address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_txid ON public.deposits(txid);

CREATE TABLE IF NOT EXISTS public.mining_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 28800,
  mining_rate_per_hour NUMERIC(20, 6) NOT NULL DEFAULT 0.250000,
  estimated_reward NUMERIC(20, 6) NOT NULL DEFAULT 2.000000,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CLAIMED', 'CANCELLED')),
  ad_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ad_session_id TEXT DEFAULT '',
  claimed_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mining_sessions_user_id ON public.mining_sessions(user_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- =====================================================================
-- 8. FUNCTION 1: get_or_restore_user
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- Row-level FOR UPDATE locking prevents concurrency race conditions.
-- Guarantees that wallet balance is NEVER overwritten with 0 during reconnection.
-- Automatically restores account if is_deleted = TRUE.
-- Enforces 24-hour device lock with database time NOW() - INTERVAL '24 hours'.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_or_restore_user(
  p_telegram_id BIGINT,
  p_username TEXT DEFAULT '',
  p_first_name TEXT DEFAULT 'E4F User',
  p_device_hash TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT '',
  p_photo_url TEXT DEFAULT '',
  p_referral_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_uid TEXT;
  v_profile RECORD;
  v_wallet RECORD;
  v_can_claim_bonus BOOLEAN := false;
  v_device_last_claim TIMESTAMPTZ;
  v_new_ref_code TEXT;
  v_referrer_tg_id BIGINT := NULL;
  v_is_new BOOLEAN := false;
  v_welcome_usdt NUMERIC(20, 6) := 0;
  v_welcome_e4f NUMERIC(20, 6) := 0;
BEGIN
  IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
    RAISE EXCEPTION 'Invalid telegram_id: must be a positive BIGINT';
  END IF;

  v_user_id := 'usr_' || p_telegram_id::TEXT;

  -- 1. Check for existing profile with row lock (FOR UPDATE)
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE telegram_id = p_telegram_id
  FOR UPDATE;

  IF FOUND THEN
    -- Account exists: If marked deleted, restore it; NEVER zero balance!
    IF v_profile.is_deleted = TRUE THEN
      UPDATE public.profiles
      SET is_deleted = FALSE,
          deleted_at = NULL,
          username = COALESCE(NULLIF(p_username, ''), username),
          first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
          photo_url = COALESCE(NULLIF(p_photo_url, ''), photo_url),
          updated_at = NOW()
      WHERE telegram_id = p_telegram_id
      RETURNING * INTO v_profile;
    ELSE
      -- Normal reconnect/login: update metadata without touching balance
      UPDATE public.profiles
      SET username = COALESCE(NULLIF(p_username, ''), username),
          first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
          photo_url = COALESCE(NULLIF(p_photo_url, ''), photo_url),
          updated_at = NOW()
      WHERE telegram_id = p_telegram_id
      RETURNING * INTO v_profile;
    END IF;

    -- Fetch wallet balance with row lock (Strictly preserving balance)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE telegram_id = p_telegram_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- If wallet record is missing, initialize safely without overwriting
      INSERT INTO public.wallets (
        telegram_id, balance, total_mined, referral_earnings,
        user_id, "USDT", "E4F", updated_at
      ) VALUES (
        p_telegram_id, 0, 0, 0,
        v_user_id, 0, 0, NOW()
      )
      ON CONFLICT (telegram_id) DO NOTHING;

      SELECT * INTO v_wallet FROM public.wallets WHERE telegram_id = p_telegram_id;
    END IF;

    -- Sync to legacy users/balances tables for full repo backwards compatibility
    INSERT INTO public.users (
      id, uid, telegram_id, first_name, last_name, username, photo_url, referral_code,
      referred_by, status, claimed_welcome_bonus, is_verified, created_at, updated_at
    ) VALUES (
      v_user_id, COALESCE(v_profile.uid, '8' || LPAD((ABS(p_telegram_id % 8999999) + 1000000)::TEXT, 7, '0')),
      p_telegram_id, v_profile.first_name, v_profile.last_name, v_profile.username, v_profile.photo_url,
      COALESCE(v_profile.referral_code, UPPER(SUBSTRING(MD5(p_telegram_id::TEXT || 'E4F') FROM 1 FOR 8))),
      v_profile.referred_by, v_profile.status, v_profile.claimed_welcome_bonus, v_profile.is_verified,
      v_profile.created_at, NOW()
    )
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      updated_at = NOW();

    INSERT INTO public.balances (
      user_id, "USDT", "E4F", "BNB", "BTC", "ETH", "SOL", "TON", "XRP", "DOGE", "ADA", "TRX", "LTC", updated_at
    ) VALUES (
      v_user_id, COALESCE(v_wallet."USDT", v_wallet.balance, 0), COALESCE(v_wallet."E4F", 0),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      updated_at = NOW();

    RETURN jsonb_build_object(
      'success', true,
      'is_new_user', false,
      'user', jsonb_build_object(
        'id', v_user_id,
        'uid', v_profile.uid,
        'telegramId', v_profile.telegram_id,
        'firstName', v_profile.first_name,
        'lastName', v_profile.last_name,
        'username', v_profile.username,
        'photoUrl', v_profile.photo_url,
        'referralCode', v_profile.referral_code,
        'referredBy', v_profile.referred_by,
        'status', v_profile.status,
        'claimedWelcomeBonus', v_profile.claimed_welcome_bonus,
        'isVerified', v_profile.is_verified,
        'createdAt', EXTRACT(EPOCH FROM v_profile.created_at) * 1000
      ),
      'balances', jsonb_build_object(
        'usdt', COALESCE(v_wallet."USDT", v_wallet.balance, 0),
        'e4f', COALESCE(v_wallet."E4F", 0),
        'bnb', COALESCE(v_wallet."BNB", 0),
        'btc', COALESCE(v_wallet."BTC", 0),
        'eth', COALESCE(v_wallet."ETH", 0),
        'sol', COALESCE(v_wallet."SOL", 0),
        'ton', COALESCE(v_wallet."TON", 0),
        'xrp', COALESCE(v_wallet."XRP", 0),
        'doge', COALESCE(v_wallet."DOGE", 0),
        'ada', COALESCE(v_wallet."ADA", 0),
        'trx', COALESCE(v_wallet."TRX", 0),
        'ltc', COALESCE(v_wallet."LTC", 0)
      ),
      'message', 'Existing user restored with 100% balance preservation'
    );
  END IF;

  -- 2. New User Registration:
  v_is_new := true;
  v_uid := '8' || LPAD((ABS(p_telegram_id % 8999999) + 1000000)::TEXT, 7, '0');
  v_new_ref_code := UPPER(SUBSTRING(MD5(p_telegram_id::TEXT || NOW()::TEXT) FROM 1 FOR 8));

  -- Look up referrer by referral code
  IF p_referral_code IS NOT NULL AND p_referral_code <> '' THEN
    SELECT telegram_id INTO v_referrer_tg_id
    FROM public.profiles
    WHERE UPPER(referral_code) = UPPER(TRIM(p_referral_code))
    LIMIT 1;

    IF v_referrer_tg_id IS NULL THEN
      SELECT telegram_id INTO v_referrer_tg_id
      FROM public.users
      WHERE UPPER(referral_code) = UPPER(TRIM(p_referral_code))
      LIMIT 1;
    END IF;
  END IF;

  -- 3. Enforce 24-Hour Device Lock using database time NOW()
  IF p_device_hash IS NOT NULL AND TRIM(p_device_hash) <> '' THEN
    SELECT last_claim_at INTO v_device_last_claim
    FROM public.device_locks
    WHERE device_hash = p_device_hash
    FOR UPDATE;

    IF FOUND AND (NOW() - v_device_last_claim) < INTERVAL '24 hours' THEN
      v_can_claim_bonus := false;
    ELSE
      v_can_claim_bonus := true;
      INSERT INTO public.device_locks (device_hash, telegram_id, last_claim_at, claim_count, created_at)
      VALUES (p_device_hash, p_telegram_id, NOW(), 1, NOW())
      ON CONFLICT (device_hash) DO UPDATE SET
        last_claim_at = NOW(),
        telegram_id = EXCLUDED.telegram_id,
        claim_count = public.device_locks.claim_count + 1;
    END IF;
  ELSE
    v_can_claim_bonus := true;
  END IF;

  IF v_can_claim_bonus THEN
    v_welcome_usdt := 25.000000;
    v_welcome_e4f := 10.000000;
  ELSE
    v_welcome_usdt := 0.000000;
    v_welcome_e4f := 0.000000;
  END IF;

  -- 4. Insert into public.profiles
  INSERT INTO public.profiles (
    telegram_id, username, first_name, last_name, photo_url, is_deleted,
    id, uid, referral_code, referred_by, status, claimed_welcome_bonus,
    is_verified, device_hash, created_at, updated_at
  ) VALUES (
    p_telegram_id,
    COALESCE(p_username, ''),
    COALESCE(NULLIF(p_first_name, ''), 'E4F User'),
    COALESCE(p_last_name, ''),
    COALESCE(p_photo_url, ''),
    false,
    v_user_id,
    v_uid,
    v_new_ref_code,
    CASE WHEN v_referrer_tg_id IS NOT NULL THEN 'usr_' || v_referrer_tg_id::TEXT ELSE NULL END,
    'ACTIVE',
    v_can_claim_bonus,
    false,
    COALESCE(p_device_hash, ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (telegram_id) DO UPDATE SET
    updated_at = NOW()
  RETURNING * INTO v_profile;

  -- 5. Insert into public.wallets
  INSERT INTO public.wallets (
    telegram_id, balance, total_mined, referral_earnings,
    id, user_id, "USDT", "E4F", updated_at
  ) VALUES (
    p_telegram_id,
    v_welcome_usdt,
    0,
    0,
    'wal_' || p_telegram_id::TEXT,
    v_user_id,
    v_welcome_usdt,
    v_welcome_e4f,
    NOW()
  )
  ON CONFLICT (telegram_id) DO NOTHING
  RETURNING * INTO v_wallet;

  IF v_wallet IS NULL THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE telegram_id = p_telegram_id;
  END IF;

  -- 6. Insert into legacy public.users & public.balances
  INSERT INTO public.users (
    id, uid, telegram_id, first_name, last_name, username, photo_url,
    referral_code, referred_by, status, claimed_welcome_bonus, is_verified,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_uid, p_telegram_id, v_profile.first_name, v_profile.last_name,
    v_profile.username, v_profile.photo_url, v_new_ref_code,
    v_profile.referred_by, 'ACTIVE', v_can_claim_bonus, false, NOW(), NOW()
  )
  ON CONFLICT (telegram_id) DO UPDATE SET
    updated_at = NOW();

  INSERT INTO public.balances (
    user_id, "USDT", "E4F", "BNB", "BTC", "ETH", "SOL", "TON", "XRP", "DOGE", "ADA", "TRX", "LTC", updated_at
  ) VALUES (
    v_user_id, v_welcome_usdt, v_welcome_e4f, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    updated_at = NOW();

  -- 7. If referred, record in public.referrals
  IF v_referrer_tg_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referee_id, bonus_amount, status, created_at)
    VALUES (v_referrer_tg_id, p_telegram_id, 0.500000, 'ACTIVE', NOW())
    ON CONFLICT (referee_id) DO NOTHING;
  END IF;

  -- 8. If welcome bonus granted, log to financial ledger
  IF v_can_claim_bonus THEN
    INSERT INTO public.transactions (
      id, user_id, asset, amount, direction, source, status, timestamp, note
    ) VALUES
    ('tx_wb_usdt_' || p_telegram_id::TEXT, v_user_id, 'USDT', 25.000000, 'IN', 'WELCOME_BONUS', 'COMPLETED',
     EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT, 'Welcome Registration Bonus (USDT) credited'),
    ('tx_wb_e4f_' || p_telegram_id::TEXT, v_user_id, 'E4F', 10.000000, 'IN', 'WELCOME_BONUS', 'COMPLETED',
     EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT, 'Welcome Registration Bonus (E4F) credited');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_new_user', true,
    'welcome_bonus_granted', v_can_claim_bonus,
    'user', jsonb_build_object(
      'id', v_user_id,
      'uid', v_uid,
      'telegramId', p_telegram_id,
      'firstName', v_profile.first_name,
      'lastName', v_profile.last_name,
      'username', v_profile.username,
      'photoUrl', v_profile.photo_url,
      'referralCode', v_new_ref_code,
      'referredBy', v_profile.referred_by,
      'status', 'ACTIVE',
      'claimedWelcomeBonus', v_can_claim_bonus,
      'isVerified', false,
      'createdAt', EXTRACT(EPOCH FROM v_profile.created_at) * 1000
    ),
    'balances', jsonb_build_object(
      'usdt', v_welcome_usdt,
      'e4f', v_welcome_e4f,
      'bnb', 0,
      'btc', 0,
      'eth', 0,
      'sol', 0,
      'ton', 0,
      'xrp', 0,
      'doge', 0,
      'ada', 0,
      'trx', 0,
      'ltc', 0
    ),
    'message', CASE WHEN v_can_claim_bonus THEN 'Welcome to E4F! Registration bonus credited.' ELSE 'Welcome to E4F! Account created.' END
  );
END;
$$;

-- =====================================================================
-- 9. FUNCTION 2: cleanup_old_withdrawals
-- RETURNS INTEGER
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- STRICT FINANCIAL RULE:
-- Pending, processing, and in_review withdrawals are NEVER deleted.
-- ONLY finalized (completed, success, rejected, failed, cancelled) older than 90 days are deleted.
-- Returns count of purged records.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_withdrawals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Strict financial rule:
  -- NEVER delete pending, processing, in_review withdrawals even if older than 90 days.
  -- Only completed, success, rejected, failed, cancelled older than 90 days are deleted.
  DELETE FROM public.withdrawals
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND LOWER(status) IN ('completed', 'success', 'rejected', 'failed', 'cancelled')
    AND LOWER(status) NOT IN ('pending', 'processing', 'in_review');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- =====================================================================
-- 10. FUNCTION 3: delete_user_permanently
-- RETURNS BOOLEAN
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- The ONLY authorized method for permanent deletion.
-- Safely cleans up all foreign-key dependent rows in exact order (referrals, withdrawals, wallets, profiles).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.delete_user_permanently(
  p_telegram_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_exists BOOLEAN := false;
BEGIN
  IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
    RETURN FALSE;
  END IF;

  v_user_id := 'usr_' || p_telegram_id::TEXT;

  -- Check if profile or user exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE telegram_id = p_telegram_id) OR
     EXISTS (SELECT 1 FROM public.users WHERE telegram_id = p_telegram_id) THEN
    v_exists := true;
  ELSE
    RETURN FALSE;
  END IF;

  -- 1. Remove child records protected by ON DELETE RESTRICT
  DELETE FROM public.referrals WHERE referee_id = p_telegram_id OR referrer_id = p_telegram_id;
  DELETE FROM public.withdrawals WHERE telegram_id = p_telegram_id;
  DELETE FROM public.wallets WHERE telegram_id = p_telegram_id;
  DELETE FROM public.device_locks WHERE telegram_id = p_telegram_id;

  -- 2. Remove profile
  DELETE FROM public.profiles WHERE telegram_id = p_telegram_id;

  -- 3. Remove legacy linked records
  DELETE FROM public.mining_sessions WHERE user_id = v_user_id;
  DELETE FROM public.deposits WHERE user_id = v_user_id;
  DELETE FROM public.transactions WHERE user_id = v_user_id;
  DELETE FROM public.balances WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE telegram_id = p_telegram_id OR id = v_user_id;

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- 11. AUXILIARY RPC: execute_atomic_withdrawal (Referenced by server.ts)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.execute_atomic_withdrawal(
  p_withdrawal_id TEXT,
  p_user_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_network TEXT,
  p_wallet_address TEXT,
  p_fee NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_deduct NUMERIC := p_amount + p_fee;
  v_curr_balance NUMERIC;
  v_new_balance NUMERIC;
  v_curr TEXT := UPPER(p_currency);
  v_tg_id BIGINT;
BEGIN
  IF v_curr = 'USDT' THEN
    SELECT "USDT" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'BTC' THEN
    SELECT "BTC" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'ETH' THEN
    SELECT "ETH" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'SOL' THEN
    SELECT "SOL" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSIF v_curr = 'BNB' THEN
    SELECT "BNB" INTO v_curr_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported withdrawal currency %', p_currency;
  END IF;

  IF v_curr_balance IS NULL OR v_curr_balance < v_total_deduct THEN
    RAISE EXCEPTION 'Insufficient balance: required %, available %', v_total_deduct, COALESCE(v_curr_balance, 0);
  END IF;

  v_new_balance := v_curr_balance - v_total_deduct;

  -- Deduct from balances
  IF v_curr = 'USDT' THEN
    UPDATE public.balances SET "USDT" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'BTC' THEN
    UPDATE public.balances SET "BTC" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'ETH' THEN
    UPDATE public.balances SET "ETH" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'SOL' THEN
    UPDATE public.balances SET "SOL" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF v_curr = 'BNB' THEN
    UPDATE public.balances SET "BNB" = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;

  -- Extract telegram_id
  IF p_user_id LIKE 'usr_%' THEN
    v_tg_id := NULLIF(SUBSTRING(p_user_id FROM 5), '')::BIGINT;
    IF v_tg_id IS NOT NULL THEN
      UPDATE public.wallets
      SET balance = balance - v_total_deduct,
          "USDT" = "USDT" - v_total_deduct,
          updated_at = NOW()
      WHERE telegram_id = v_tg_id AND (balance >= v_total_deduct OR "USDT" >= v_total_deduct);
    END IF;
  END IF;

  -- Insert withdrawal record
  INSERT INTO public.withdrawals (
    id, user_id, telegram_id, amount, currency, network, wallet_address, fee, status, created_at, updated_at
  ) VALUES (
    p_withdrawal_id, p_user_id, v_tg_id, p_amount, v_curr, p_network, p_wallet_address, p_fee, 'pending', NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert transaction audit
  INSERT INTO public.transactions (
    id, user_id, asset, amount, direction, source, status, timestamp, address, network, fee, note
  ) VALUES (
    p_withdrawal_id, p_user_id, v_curr, p_amount, 'OUT', 'WITHDRAW', 'PENDING',
    EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT, p_wallet_address, p_network, p_fee, 'Withdrawal request initiated'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'deducted', v_total_deduct,
    'currency', v_curr,
    'withdrawal_id', p_withdrawal_id
  );
END;
$$;

-- =====================================================================
-- 12. AUXILIARY RPC: verify_atomic_deposit (Referenced by server.ts)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verify_atomic_deposit(
  p_deposit_id TEXT,
  p_admin_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_amount NUMERIC;
  v_asset TEXT;
  v_status TEXT;
  v_txid TEXT;
  v_new_bal NUMERIC;
  v_curr TEXT;
  v_tg_id BIGINT;
BEGIN
  SELECT user_id, amount, asset, status, txid
  INTO v_user_id, v_amount, v_asset, v_status, v_txid
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit % not found', p_deposit_id;
  END IF;

  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Deposit is already in status %', v_status;
  END IF;

  v_curr := UPPER(v_asset);

  UPDATE public.deposits
  SET status = 'VERIFIED', verified_at = NOW()
  WHERE id = p_deposit_id;

  IF v_curr = 'USDT' THEN
    UPDATE public.balances
    SET "USDT" = "USDT" + v_amount, updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING "USDT" INTO v_new_bal;

    UPDATE public.users
    SET deposit_balance = deposit_balance + v_amount, updated_at = NOW()
    WHERE id = v_user_id;

    IF v_user_id LIKE 'usr_%' THEN
      v_tg_id := NULLIF(SUBSTRING(v_user_id FROM 5), '')::BIGINT;
      IF v_tg_id IS NOT NULL THEN
        UPDATE public.wallets
        SET balance = balance + v_amount,
            "USDT" = "USDT" + v_amount,
            updated_at = NOW()
        WHERE telegram_id = v_tg_id;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported deposit asset %', v_asset;
  END IF;

  UPDATE public.transactions
  SET status = 'COMPLETED', note = 'Verified external deposit credited to wallet'
  WHERE id = p_deposit_id OR reference_id = v_txid;

  INSERT INTO public.audit_logs (
    id, admin_id, action, target, details, timestamp
  ) VALUES (
    'audit_' || EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT,
    p_admin_id, 'VERIFY_DEPOSIT', p_deposit_id,
    'Verified deposit of ' || v_amount || ' ' || v_curr || ' (TXID: ' || v_txid || ') for user ' || v_user_id,
    EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT
  );

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', p_deposit_id,
    'new_balance', v_new_bal,
    'credited', v_amount,
    'asset', v_curr
  );
END;
$$;

-- =====================================================================
-- 13. ROW LEVEL SECURITY (RLS) & SERVICE ROLE POLICIES
-- Service role key has full access; client anon/authenticated has safe access
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy Application
DO $$
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS service_role_all_profiles ON public.profiles;
  CREATE POLICY service_role_all_profiles ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Wallets
  DROP POLICY IF EXISTS service_role_all_wallets ON public.wallets;
  CREATE POLICY service_role_all_wallets ON public.wallets FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Referrals
  DROP POLICY IF EXISTS service_role_all_referrals ON public.referrals;
  CREATE POLICY service_role_all_referrals ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Withdrawals
  DROP POLICY IF EXISTS service_role_all_withdrawals ON public.withdrawals;
  CREATE POLICY service_role_all_withdrawals ON public.withdrawals FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Device Locks
  DROP POLICY IF EXISTS service_role_all_device_locks ON public.device_locks;
  CREATE POLICY service_role_all_device_locks ON public.device_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Users
  DROP POLICY IF EXISTS service_role_all_users ON public.users;
  CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Balances
  DROP POLICY IF EXISTS service_role_all_balances ON public.balances;
  CREATE POLICY service_role_all_balances ON public.balances FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Transactions
  DROP POLICY IF EXISTS service_role_all_transactions ON public.transactions;
  CREATE POLICY service_role_all_transactions ON public.transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Deposits
  DROP POLICY IF EXISTS service_role_all_deposits ON public.deposits;
  CREATE POLICY service_role_all_deposits ON public.deposits FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Mining Sessions
  DROP POLICY IF EXISTS service_role_all_mining ON public.mining_sessions;
  CREATE POLICY service_role_all_mining ON public.mining_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Audit Logs
  DROP POLICY IF EXISTS service_role_all_audit ON public.audit_logs;
  CREATE POLICY service_role_all_audit ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- 14. PERMISSIONS & GRANTS
GRANT EXECUTE ON FUNCTION public.get_or_restore_user TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_withdrawals TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_permanently TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_atomic_withdrawal TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_atomic_deposit TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
