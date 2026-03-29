create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique,
  full_name text,
  phone text,
  avatar_url text,
  instagram_url text,
  bio text default '',
  role_focus text default '',
  experience_level text default '',
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists phone text;

alter table public.profiles
add column if not exists email text;

alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists instagram_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_email_unique'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_email_unique unique (email);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_phone_format
    check (phone is null or phone ~ '^\+\d{5,15}$');
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
on public.profiles
for select
using (auth.role() = 'authenticated');

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, full_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)),
    nullif(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update
  set username = excluded.username,
      email = excluded.email,
      full_name = excluded.full_name,
      phone = excluded.phone;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or btrim(p.email) = '');

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public can view avatars" on storage.objects;
create policy "Public can view avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatars" on storage.objects;
create policy "Users can upload own avatars"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_sender_receiver_unique unique (sender_id, receiver_id),
  constraint friend_requests_not_self check (sender_id <> receiver_id),
  constraint friend_requests_status_valid check (status in ('pending', 'accepted', 'declined'))
);

alter table public.friend_requests enable row level security;

drop policy if exists "Users can read own friend requests" on public.friend_requests;
create policy "Users can read own friend requests"
on public.friend_requests
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
on public.friend_requests
for insert
with check (
  auth.uid() = sender_id
  and sender_id <> receiver_id
  and status = 'pending'
);

drop policy if exists "Senders can update own friend requests" on public.friend_requests;
create policy "Senders can update own friend requests"
on public.friend_requests
for update
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

drop policy if exists "Receivers can update incoming friend requests" on public.friend_requests;
create policy "Receivers can update incoming friend requests"
on public.friend_requests
for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "Senders can cancel pending friend requests" on public.friend_requests;
create policy "Senders can cancel pending friend requests"
on public.friend_requests
for delete
using (auth.uid() = sender_id and status = 'pending');

create table if not exists public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_pk primary key (user_a, user_b),
  constraint friendships_ordered_pair check (user_a < user_b)
);

alter table public.friendships enable row level security;

drop policy if exists "Users can read own friendships" on public.friendships;
create policy "Users can read own friendships"
on public.friendships
for select
using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Users can create friendships they belong to" on public.friendships;
create policy "Users can create friendships they belong to"
on public.friendships
for insert
with check (
  (auth.uid() = user_a or auth.uid() = user_b)
  and user_a < user_b
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_not_self check (sender_id <> receiver_id),
  constraint chat_messages_body_not_empty check (length(btrim(body)) > 0)
);

create index if not exists chat_messages_sender_receiver_created_idx
on public.chat_messages (sender_id, receiver_id, created_at);

create index if not exists chat_messages_receiver_sender_created_idx
on public.chat_messages (receiver_id, sender_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Users can read own chat messages" on public.chat_messages;
create policy "Users can read own chat messages"
on public.chat_messages
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send own chat messages" on public.chat_messages;
create policy "Users can send own chat messages"
on public.chat_messages
for insert
with check (auth.uid() = sender_id and sender_id <> receiver_id);

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

drop policy if exists "Users can insert reports" on public.reports;
create policy "Users can insert reports"
on public.reports
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports"
on public.reports
for select
using (auth.uid() = user_id);
