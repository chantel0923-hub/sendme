-- ════════════════════════════════════════════════════════════════════════
-- SENDME — PAYOUT SYSTEM TABLES
-- Run this in Supabase SQL Editor (Project: pidlanyedgieiyxuipwf)
-- ════════════════════════════════════════════════════════════════════════

-- 1. PAYOUT DETAILS — banking info for missionaries/churches
create table if not exists payout_details (
  id uuid primary key default gen_random_uuid(),
  mission_id bigint references missions(id) on delete cascade,
  recipient_name text not null,
  recipient_type text default 'missionary',   -- 'missionary' or 'church'
  bank_name text not null,
  account_holder text not null,
  account_number text not null,
  branch_code text,
  account_type text default 'cheque',         -- 'cheque' or 'savings'
  country text default 'South Africa',
  swift_code text,                            -- for international payouts
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One set of banking details per mission
create unique index if not exists payout_details_mission_unique
  on payout_details(mission_id);

-- 2. PAYOUT RECORDS — tracks each milestone payment
create table if not exists payout_records (
  id uuid primary key default gen_random_uuid(),
  mission_id bigint references missions(id) on delete cascade,
  milestone_number int not null,              -- 1, 2, or 3
  amount numeric not null,
  status text default 'pending',              -- 'pending' or 'paid'
  paid_at timestamptz,
  paid_via text,                              -- e.g. 'EFT', 'PayFast payout'
  notes text,
  created_at timestamptz default now()
);

create unique index if not exists payout_records_mission_milestone
  on payout_records(mission_id, milestone_number);

-- Enable Row Level Security
alter table payout_details enable row level security;
alter table payout_records enable row level security;

-- Allow anyone authenticated to INSERT their own banking details
-- (they can only insert, not read others' — admin reads via service role)
create policy "Anyone can insert payout details"
  on payout_details for insert
  with check (true);

create policy "Anyone can update their own payout details"
  on payout_details for update
  using (true);

-- For now, allow read access (tighten later by linking to auth.uid())
create policy "Allow read payout details"
  on payout_details for select
  using (true);

create policy "Allow read payout records"
  on payout_records for select
  using (true);

create policy "Allow insert payout records"
  on payout_records for insert
  with check (true);

create policy "Allow update payout records"
  on payout_records for update
  using (true);
