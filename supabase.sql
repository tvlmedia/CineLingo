create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  bio text default '',
  role_focus text default '',
  experience_level text default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  question_id text,
  result_id text,
  reason text not null,
  details text default '',
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Users can insert reports"
on public.reports
for insert
with check (auth.uid() = user_id);

create policy "Users can view own reports"
on public.reports
for select
using (auth.uid() = user_id);
