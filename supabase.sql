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
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_messages_not_self check (sender_id <> receiver_id),
  constraint chat_messages_body_not_empty check (length(btrim(body)) > 0)
);

alter table public.chat_messages
add column if not exists read_at timestamptz;

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
with check (
  auth.uid() = sender_id
  and sender_id <> receiver_id
  and exists (
    select 1
    from public.friendships f
    where
      (f.user_a = sender_id and f.user_b = receiver_id)
      or (f.user_b = sender_id and f.user_a = receiver_id)
  )
);

drop policy if exists "Receivers can mark chat messages as read" on public.chat_messages;
create policy "Receivers can mark chat messages as read"
on public.chat_messages
for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

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

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  category text not null,
  prompt text not null,
  options jsonb not null,
  explanation text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_questions_category_valid check (
    category in (
      'Technical Fundamentals',
      'Lighting Craft',
      'Visual Language',
      'Set & Production Knowledge',
      'Cinematic Reading',
      'Lens & Camera Intuition'
    )
  ),
  constraint assessment_questions_options_array check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

create index if not exists assessment_questions_category_idx
on public.assessment_questions (category, is_active);

alter table public.assessment_questions enable row level security;

drop policy if exists "Authenticated users can read assessment questions" on public.assessment_questions;
create policy "Authenticated users can read assessment questions"
on public.assessment_questions
for select
using (auth.role() = 'authenticated');

drop policy if exists "Owner can insert assessment questions" on public.assessment_questions;
create policy "Owner can insert assessment questions"
on public.assessment_questions
for insert
with check (auth.jwt() ->> 'email' = 'info@tvlmedia.nl');

drop policy if exists "Owner can update assessment questions" on public.assessment_questions;
create policy "Owner can update assessment questions"
on public.assessment_questions
for update
using (auth.jwt() ->> 'email' = 'info@tvlmedia.nl')
with check (auth.jwt() ->> 'email' = 'info@tvlmedia.nl');

drop policy if exists "Owner can delete assessment questions" on public.assessment_questions;
create policy "Owner can delete assessment questions"
on public.assessment_questions
for delete
using (auth.jwt() ->> 'email' = 'info@tvlmedia.nl');

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress',
  total_questions integer not null default 0,
  total_correct integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint assessment_attempts_status_valid check (status in ('in_progress', 'completed')),
  constraint assessment_attempts_total_questions_non_negative check (total_questions >= 0),
  constraint assessment_attempts_total_correct_non_negative check (total_correct >= 0)
);

create unique index if not exists assessment_attempts_single_in_progress_per_user
on public.assessment_attempts (user_id)
where status = 'in_progress';

create index if not exists assessment_attempts_user_started_idx
on public.assessment_attempts (user_id, started_at desc);

alter table public.assessment_attempts enable row level security;

drop policy if exists "Users can read own assessment attempts" on public.assessment_attempts;
create policy "Users can read own assessment attempts"
on public.assessment_attempts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own assessment attempts" on public.assessment_attempts;
create policy "Users can insert own assessment attempts"
on public.assessment_attempts
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own assessment attempts" on public.assessment_attempts;
create policy "Users can update own assessment attempts"
on public.assessment_attempts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own in-progress assessment attempts" on public.assessment_attempts;
create policy "Users can delete own in-progress assessment attempts"
on public.assessment_attempts
for delete
using (auth.uid() = user_id and status = 'in_progress');

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id),
  question_order integer not null,
  options_order jsonb not null,
  selected_option_id text,
  is_correct boolean,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assessment_answers_question_order_positive check (question_order > 0),
  constraint assessment_answers_options_order_array check (jsonb_typeof(options_order) = 'array' and jsonb_array_length(options_order) = 4),
  constraint assessment_answers_attempt_question_unique unique (attempt_id, question_order),
  constraint assessment_answers_attempt_question_id_unique unique (attempt_id, question_id)
);

create index if not exists assessment_answers_attempt_idx
on public.assessment_answers (attempt_id, question_order);

create index if not exists assessment_answers_user_idx
on public.assessment_answers (user_id, created_at desc);

alter table public.assessment_answers enable row level security;

drop policy if exists "Users can read own assessment answers" on public.assessment_answers;
create policy "Users can read own assessment answers"
on public.assessment_answers
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own assessment answers" on public.assessment_answers;
create policy "Users can insert own assessment answers"
on public.assessment_answers
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.assessment_attempts a
    where a.id = attempt_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own assessment answers" on public.assessment_answers;
create policy "Users can update own assessment answers"
on public.assessment_answers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.user_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  category text not null,
  correct_count integer not null,
  question_count integer not null,
  score_band text not null,
  interpretation text,
  created_at timestamptz not null default now(),
  constraint user_assessment_scores_attempt_category_unique unique (attempt_id, category),
  constraint user_assessment_scores_category_valid check (
    category in (
      'Technical Fundamentals',
      'Lighting Craft',
      'Visual Language',
      'Set & Production Knowledge',
      'Cinematic Reading',
      'Lens & Camera Intuition'
    )
  ),
  constraint user_assessment_scores_score_band_valid check (score_band in ('Strong', 'Solid', 'Developing', 'Weak')),
  constraint user_assessment_scores_counts_non_negative check (correct_count >= 0 and question_count > 0)
);

create index if not exists user_assessment_scores_user_idx
on public.user_assessment_scores (user_id, created_at desc);

alter table public.user_assessment_scores enable row level security;

drop policy if exists "Users can read own assessment scores" on public.user_assessment_scores;
create policy "Users can read own assessment scores"
on public.user_assessment_scores
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own assessment scores" on public.user_assessment_scores;
create policy "Users can insert own assessment scores"
on public.user_assessment_scores
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own assessment scores" on public.user_assessment_scores;
create policy "Users can update own assessment scores"
on public.user_assessment_scores
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own assessment scores" on public.user_assessment_scores;
create policy "Users can delete own assessment scores"
on public.user_assessment_scores
for delete
using (auth.uid() = user_id);

insert into public.assessment_questions (key, category, prompt, options, explanation, is_active)
values
(
  'technical-fundamentals-001',
  'Technical Fundamentals',
  'Which statement is most accurate about ISO in digital cinematography?',
  '[{"id": "a", "text": "Raising ISO always makes the sensor physically capture more light", "isCorrect": false}, {"id": "b", "text": "Raising ISO usually changes how the recorded or monitored signal is amplified or interpreted, not how much light enters the lens", "isCorrect": true}, {"id": "c", "text": "Raising ISO reduces rolling shutter", "isCorrect": false}, {"id": "d", "text": "Raising ISO makes depth of field shallower", "isCorrect": false}]'::jsonb,
  'ISO does not physically increase the amount of light entering the camera. It usually affects signal amplification, image interpretation, or exposure placement depending on the camera system.',
  true
),
(
  'technical-fundamentals-002',
  'Technical Fundamentals',
  'Which statement is most accurate about T-stop and f-stop?',
  '[{"id": "a", "text": "f-stop measures actual light transmission, while T-stop is only a mathematical ratio", "isCorrect": false}, {"id": "b", "text": "T-stop and f-stop always produce identical exposure across different lenses", "isCorrect": false}, {"id": "c", "text": "T-stop reflects actual transmitted light, while f-stop is based on a geometric aperture ratio", "isCorrect": true}, {"id": "d", "text": "T-stop only matters on anamorphic lenses", "isCorrect": false}]'::jsonb,
  'f-stop is a mathematical ratio based on focal length and entrance pupil. T-stop accounts for real transmission losses, which makes it more reliable for exposure consistency across lenses.',
  true
),
(
  'technical-fundamentals-003',
  'Technical Fundamentals',
  'A camera is set to 24 fps at a 180° shutter angle. If you switch to 48 fps and keep the shutter angle at 180°, what happens?',
  '[{"id": "a", "text": "Exposure decreases by one stop and motion blur per frame decreases", "isCorrect": true}, {"id": "b", "text": "Exposure stays the same and motion blur stays the same", "isCorrect": false}, {"id": "c", "text": "Exposure increases by one stop and motion blur decreases", "isCorrect": false}, {"id": "d", "text": "Exposure decreases by two stops and motion blur stays the same", "isCorrect": false}]'::jsonb,
  'Doubling the frame rate halves the exposure time per frame at the same shutter angle, so the image gets one stop darker and motion blur per frame becomes tighter.',
  true
),
(
  'technical-fundamentals-004',
  'Technical Fundamentals',
  'A face looks correctly exposed on the monitor, but false color shows skin tones sitting noticeably below the target exposure range. What is the most likely explanation?',
  '[{"id": "a", "text": "The lens is not truly parfocal", "isCorrect": false}, {"id": "b", "text": "The monitor brightness or image preview is misleading", "isCorrect": true}, {"id": "c", "text": "The camera’s shutter angle is too wide", "isCorrect": false}, {"id": "d", "text": "The focal length is compressing the image too much", "isCorrect": false}]'::jsonb,
  'A monitor can look subjectively “fine” even when the signal is technically underexposed. Tools like false color are generally more reliable than judging exposure by monitor brightness alone.',
  true
),
(
  'technical-fundamentals-005',
  'Technical Fundamentals',
  'A lens is set to T2.8. You add a 0.6 ND filter and want to keep the same exposure. What should the lens be set to?',
  '[{"id": "a", "text": "T2", "isCorrect": false}, {"id": "b", "text": "T1.4", "isCorrect": true}, {"id": "c", "text": "T4", "isCorrect": false}, {"id": "d", "text": "T5.6", "isCorrect": false}]'::jsonb,
  'ND 0.6 cuts 2 stops of light. To maintain the same exposure, you need to open the lens by 2 stops: from T2.8 to T1.4.',
  true
),
(
  'technical-fundamentals-006',
  'Technical Fundamentals',
  'Which statement is most accurate about EI/ISO on many digital cinema cameras shooting log?',
  '[{"id": "a", "text": "Changing EI/ISO always physically changes the amount of light reaching the sensor", "isCorrect": false}, {"id": "b", "text": "Changing EI/ISO often changes exposure strategy and monitoring behavior more than the sensor’s actual light capture", "isCorrect": true}, {"id": "c", "text": "Changing EI/ISO automatically changes frame rate", "isCorrect": false}, {"id": "d", "text": "Changing EI/ISO only affects white balance metadata", "isCorrect": false}]'::jsonb,
  'On many digital cinema cameras, EI/ISO is closely tied to how exposure is monitored and placed, especially in log workflows. It does not necessarily mean the sensor is physically receiving more or less light.',
  true
),
(
  'technical-fundamentals-007',
  'Technical Fundamentals',
  'A scene is lit primarily with 3200K tungsten light, while the camera white balance is set to 5600K. How will the recorded image most likely appear?',
  '[{"id": "a", "text": "Cool / blue", "isCorrect": false}, {"id": "b", "text": "Warm / orange", "isCorrect": true}, {"id": "c", "text": "Neutral", "isCorrect": false}, {"id": "d", "text": "Slightly green", "isCorrect": false}]'::jsonb,
  'The camera is balanced for a cooler light source than is actually present. Since the real light is warmer (3200K), the recorded image will appear warm/orange.',
  true
),
(
  'technical-fundamentals-008',
  'Technical Fundamentals',
  'Which statement is most accurate about ND filters in cinematography?',
  '[{"id": "a", "text": "ND filters primarily reduce contrast while keeping exposure unchanged", "isCorrect": false}, {"id": "b", "text": "ND filters increase highlight retention by lowering sensor sensitivity", "isCorrect": false}, {"id": "c", "text": "ND filters are mainly used to reduce motion blur without changing exposure", "isCorrect": false}, {"id": "d", "text": "ND filters reduce the amount of light entering the lens, allowing exposure control without directly changing aperture, ISO or shutter settings", "isCorrect": true}]'::jsonb,
  'ND filters reduce the amount of light entering the lens. This allows the cinematographer to control exposure while keeping other creative choices, such as aperture or shutter angle, where they want them.',
  true
),
(
  'technical-fundamentals-009',
  'Technical Fundamentals',
  'Which statement is most accurate about log recording?',
  '[{"id": "a", "text": "Log recording always produces a final image that needs no grading", "isCorrect": false}, {"id": "b", "text": "Log recording reduces lens distortion by compressing tonal values", "isCorrect": false}, {"id": "c", "text": "Log recording is mainly designed to preserve more usable tonal information for grading", "isCorrect": true}, {"id": "d", "text": "Log recording increases frame rate flexibility in post", "isCorrect": false}]'::jsonb,
  'Log recording is designed to retain more usable tonal information, especially in highlights and shadows, so the image has more flexibility in color grading later.',
  true
),
(
  'technical-fundamentals-010',
  'Technical Fundamentals',
  'Which statement is most accurate about dynamic range?',
  '[{"id": "a", "text": "Dynamic range describes the range between the darkest and brightest values a camera can capture while still retaining usable detail", "isCorrect": true}, {"id": "b", "text": "Dynamic range describes how far shadows can be lifted before the lens starts losing sharpness", "isCorrect": false}, {"id": "c", "text": "Dynamic range describes the maximum contrast a monitor can display from a camera feed", "isCorrect": false}, {"id": "d", "text": "Dynamic range describes how much overexposure a camera can tolerate, without considering shadow detail", "isCorrect": false}]'::jsonb,
  'Dynamic range refers to the range between the darkest and brightest parts of an image that a camera can capture while still retaining usable detail. It is not limited to only highlights, shadows, lens behavior or monitor display.',
  true
),
(
  'technical-fundamentals-011',
  'Technical Fundamentals',
  'Two shots have the same framing on the same sensor. One is shot on 35mm close to the subject, the other on 85mm farther away. What mainly changes?',
  '[{"id": "a", "text": "Perspective", "isCorrect": true}, {"id": "b", "text": "White balance", "isCorrect": false}, {"id": "c", "text": "Frame rate", "isCorrect": false}, {"id": "d", "text": "Sensor size", "isCorrect": false}]'::jsonb,
  'With matched framing, changing focal length also changes camera distance. That changes perspective.',
  true
),
(
  'technical-fundamentals-012',
  'Technical Fundamentals',
  'If you keep the same lens, same camera position, and same T-stop, but switch from Full Frame to Super 35, what changes most directly in the image?',
  '[{"id": "a", "text": "The image becomes wider and depth of field gets shallower", "isCorrect": false}, {"id": "b", "text": "The field of view becomes tighter", "isCorrect": true}, {"id": "c", "text": "Motion blur increases", "isCorrect": false}, {"id": "d", "text": "Perspective changes", "isCorrect": false}]'::jsonb,
  'With the same lens and camera position, a smaller sensor crops the image, so the field of view becomes tighter. Perspective stays the same because the camera position does not change.',
  true
),
(
  'technical-fundamentals-013',
  'Technical Fundamentals',
  'Two cameras are in the same position with the same focal length, but one uses Full Frame and the other Super 35. To match the framing of the Super 35 shot on the Full Frame camera, what is the most likely adjustment?',
  '[{"id": "a", "text": "Use a longer focal length on Full Frame", "isCorrect": false}, {"id": "b", "text": "Move the Full Frame camera farther away", "isCorrect": false}, {"id": "c", "text": "Use a shorter focal length on Full Frame", "isCorrect": true}, {"id": "d", "text": "Close down the aperture on Full Frame", "isCorrect": false}]'::jsonb,
  'Full Frame shows a wider field of view with the same lens. To match the tighter Super 35 framing from the same position, you would use a shorter focal length on the Full Frame camera.',
  true
),
(
  'technical-fundamentals-014',
  'Technical Fundamentals',
  'Which change increases exposure without changing motion blur or depth of field?',
  '[{"id": "a", "text": "Lowering the shutter angle", "isCorrect": false}, {"id": "b", "text": "Opening from T4 to T2.8", "isCorrect": false}, {"id": "c", "text": "Raising ISO", "isCorrect": true}, {"id": "d", "text": "Switching from 50mm to 35mm", "isCorrect": false}]'::jsonb,
  'Raising ISO increases image brightness without directly changing motion blur or depth of field. Opening the lens changes depth of field, and changing shutter affects motion blur.',
  true
),
(
  'technical-fundamentals-015',
  'Technical Fundamentals',
  'Why would a cinematographer use an ND filter instead of simply stopping down the lens to reduce exposure?',
  '[{"id": "a", "text": "Because an ND filter reduces exposure while preserving a wider aperture look", "isCorrect": true}, {"id": "b", "text": "Because an ND filter increases dynamic range", "isCorrect": false}, {"id": "c", "text": "Because an ND filter reduces rolling shutter", "isCorrect": false}, {"id": "d", "text": "Because an ND filter changes the sensor size", "isCorrect": false}]'::jsonb,
  'An ND filter reduces the amount of light entering the lens without forcing you to stop down. That lets you keep choices like a wider aperture, shallower depth of field, or a specific shutter setting.',
  true
),
(
  'technical-fundamentals-016',
  'Technical Fundamentals',
  'A scene is exposed correctly at 24 fps, 180° shutter, T2.8, ISO 800. You change to 48 fps and want to keep the same exposure and depth of field. Which is the most direct adjustment?',
  '[{"id": "a", "text": "Change to 90° shutter", "isCorrect": false}, {"id": "b", "text": "Change to T4", "isCorrect": false}, {"id": "c", "text": "Raise ISO to 1600", "isCorrect": true}, {"id": "d", "text": "Lower white balance", "isCorrect": false}]'::jsonb,
  'Doubling frame rate from 24 to 48 fps loses one stop of exposure at the same shutter angle. Raising ISO from 800 to 1600 restores that stop while keeping depth of field unchanged.',
  true
),
(
  'technical-fundamentals-017',
  'Technical Fundamentals',
  'Which statement is most accurate about overexposing log footage on purpose?',
  '[{"id": "a", "text": "It always increases dynamic range", "isCorrect": false}, {"id": "b", "text": "It can improve shadow cleanliness, but only if highlights remain within recoverable range", "isCorrect": true}, {"id": "c", "text": "It guarantees a more cinematic look in every scene", "isCorrect": false}, {"id": "d", "text": "It removes the need for color grading", "isCorrect": false}]'::jsonb,
  'Some cinematographers expose log footage brighter to improve shadow quality, but this only works if important highlights are not pushed beyond what the camera can retain.',
  true
),
(
  'technical-fundamentals-018',
  'Technical Fundamentals',
  'What is the main visual reason a cinematographer might choose a longer focal length for a close-up instead of moving closer with a wider lens?',
  '[{"id": "a", "text": "To change perspective and background relationship while keeping the subject framed similarly", "isCorrect": true}, {"id": "b", "text": "To get the same perspective, but with less depth of field", "isCorrect": false}, {"id": "c", "text": "To make the subject appear sharper without affecting spatial relationships", "isCorrect": false}, {"id": "d", "text": "To increase highlight latitude in the background", "isCorrect": false}]'::jsonb,
  'A longer focal length from farther away changes perspective and background rendering compared with moving closer on a wider lens, even if the subject is framed similarly.',
  true
),
(
  'lighting-craft-001',
  'Lighting Craft',
  'What is the main visual effect of adding negative fill on the shadow side of a face?',
  '[{"id": "a", "text": "It deepens the shadow side by reducing ambient bounce, increasing perceived contrast and shape", "isCorrect": true}, {"id": "b", "text": "It makes the key light appear harder by shrinking the apparent size of the source", "isCorrect": false}, {"id": "c", "text": "It lowers the overall exposure of the face evenly, without significantly changing the light ratio", "isCorrect": false}, {"id": "d", "text": "It primarily shifts the shadow side toward a cooler color temperature", "isCorrect": false}]'::jsonb,
  'Negative fill reduces ambient bounce on the shadow side, which deepens shadows and increases perceived contrast and facial shape. It does not directly harden the source, evenly lower exposure, or inherently change color temperature.',
  true
),
(
  'lighting-craft-002',
  'Lighting Craft',
  'A face is lit by a large soft source, but the image still feels flat. Which adjustment is most likely to improve facial shape while keeping the light soft?',
  '[{"id": "a", "text": "Move the source more to the side", "isCorrect": true}, {"id": "b", "text": "Move the source farther back while keeping it frontal", "isCorrect": false}, {"id": "c", "text": "Add more fill from camera side", "isCorrect": false}, {"id": "d", "text": "Bring the source closer while keeping it in the same position", "isCorrect": false}]'::jsonb,
  'If the light feels flat, the problem is often direction rather than softness. Moving the source more to the side creates more modelling on the face while keeping the light soft.',
  true
),
(
  'lighting-craft-003',
  'Lighting Craft',
  'What is the most likely result of moving a diffused key light much closer to a face, while keeping its position and exposure matched?',
  '[{"id": "a", "text": "The light usually becomes softer and falloff becomes more pronounced", "isCorrect": true}, {"id": "b", "text": "The light usually becomes harder and more even across the frame", "isCorrect": false}, {"id": "c", "text": "The light usually becomes softer and the background gets relatively brighter", "isCorrect": false}, {"id": "d", "text": "The light usually becomes harder but with less contrast", "isCorrect": false}]'::jsonb,
  'Bringing a diffused source closer increases its apparent size relative to the subject, which makes it softer. It also increases falloff, so brightness drops off faster over distance.',
  true
),
(
  'lighting-craft-004',
  'Lighting Craft',
  'What is the main visual reason a cinematographer might add backlight to a subject?',
  '[{"id": "a", "text": "To reduce depth of field behind the subject", "isCorrect": false}, {"id": "b", "text": "To create separation between the subject and the background", "isCorrect": true}, {"id": "c", "text": "To soften facial features from camera side", "isCorrect": false}, {"id": "d", "text": "To lower overall scene contrast", "isCorrect": false}]'::jsonb,
  'Backlight is often used to create edge definition and separation, helping the subject stand out more clearly from the background.',
  true
),
(
  'lighting-craft-005',
  'Lighting Craft',
  'Which choice most strongly helps a key light feel motivated by a window in the scene?',
  '[{"id": "a", "text": "Placing the key as flat and frontal as possible", "isCorrect": false}, {"id": "b", "text": "Keeping the brightest part of the frame away from the window side", "isCorrect": false}, {"id": "c", "text": "Matching the key only by color, without considering direction", "isCorrect": false}, {"id": "d", "text": "Placing the key so its direction and logic feel consistent with the window position", "isCorrect": true}]'::jsonb,
  'Motivation is not just about color or exposure. The light has to feel like it is actually coming from a believable source in the scene, and direction is a big part of that.',
  true
),
(
  'lighting-craft-006',
  'Lighting Craft',
  'A cinematographer changes a lamp from 5600K to 3200K, while the camera white balance stays the same. What is the most likely result?',
  '[{"id": "a", "text": "The lamp will appear cooler / bluer", "isCorrect": false}, {"id": "b", "text": "The lamp will appear warmer / more orange", "isCorrect": true}, {"id": "c", "text": "The lamp will appear more contrasty, but not warmer", "isCorrect": false}, {"id": "d", "text": "The lamp will appear more neutral because 3200K is lower output", "isCorrect": false}]'::jsonb,
  'If the lamp is changed from 5600K to 3200K and the camera white balance stays the same, the light from that lamp will read warmer / more orange in the image.',
  true
),
(
  'lighting-craft-007',
  'Lighting Craft',
  'Why might a cinematographer choose an HMI over a tungsten fixture for a daylight scene?',
  '[{"id": "a", "text": "Because an HMI usually matches daylight more naturally and delivers stronger output for that use case", "isCorrect": true}, {"id": "b", "text": "Because an HMI always produces softer light than tungsten", "isCorrect": false}, {"id": "c", "text": "Because an HMI automatically creates more depth of field", "isCorrect": false}, {"id": "d", "text": "Because an HMI makes white balance irrelevant", "isCorrect": false}]'::jsonb,
  'HMIs are often chosen for daylight work because their color temperature is closer to daylight and they typically provide strong output, making them useful for simulating or augmenting daylight.',
  true
),
(
  'lighting-craft-008',
  'Lighting Craft',
  'What is a major practical advantage of using an LED fixture over many traditional tungsten or HMI fixtures?',
  '[{"id": "a", "text": "LED fixtures always produce a more cinematic spectrum than any other source", "isCorrect": false}, {"id": "b", "text": "LED fixtures usually allow faster adjustment of intensity and color without changing gels or globes", "isCorrect": true}, {"id": "c", "text": "LED fixtures always have higher output than tungsten and HMI of the same size", "isCorrect": false}, {"id": "d", "text": "LED fixtures automatically make mixed color temperatures disappear", "isCorrect": false}]'::jsonb,
  'A major advantage of many LED fixtures is speed and flexibility: intensity, color temperature, and sometimes tint can often be adjusted directly without swapping bulbs, dimmers, or gels.',
  true
),
(
  'lighting-craft-009',
  'Lighting Craft',
  'What is a common downside of dimming tungsten fixtures without correcting the color?',
  '[{"id": "a", "text": "They usually become cooler / bluer", "isCorrect": false}, {"id": "b", "text": "They usually become warmer / more orange", "isCorrect": true}, {"id": "c", "text": "They lose all contrast in the shadows", "isCorrect": false}, {"id": "d", "text": "They become daylight-balanced", "isCorrect": false}]'::jsonb,
  'As tungsten fixtures are dimmed, they typically shift warmer / more orange. That can be useful or undesirable, depending on the scene.',
  true
),
(
  'lighting-craft-010',
  'Lighting Craft',
  'What is a major lighting advantage of using a fixture with adjustable green-magenta tint control?',
  '[{"id": "a", "text": "It allows you to change focal length without moving the lamp", "isCorrect": false}, {"id": "b", "text": "It helps match the source more precisely to other fixtures or practicals in the scene", "isCorrect": true}, {"id": "c", "text": "It increases dynamic range in the highlights", "isCorrect": false}, {"id": "d", "text": "It automatically improves skin tone contrast", "isCorrect": false}]'::jsonb,
  'Tint control helps fine-tune green/magenta balance so fixtures match each other more cleanly, which is especially useful in mixed-light environments.',
  true
),
(
  'lighting-craft-011',
  'Lighting Craft',
  'Which change is most likely to make a light source feel harder on a subject?',
  '[{"id": "a", "text": "Increasing diffusion while keeping position the same", "isCorrect": false}, {"id": "b", "text": "Making the source physically larger and bringing it closer", "isCorrect": false}, {"id": "c", "text": "Raising the white balance of the lamp", "isCorrect": false}, {"id": "d", "text": "Making the source smaller relative to the subject", "isCorrect": true}]'::jsonb,
  'A source feels harder when its apparent size relative to the subject becomes smaller, which creates sharper shadow edges and less wrap.',
  true
),
(
  'lighting-craft-012',
  'Lighting Craft',
  'Why might a cinematographer still add artificial light to a scene that already has enough daylight exposure?',
  '[{"id": "a", "text": "To make the camera sensor physically more sensitive", "isCorrect": false}, {"id": "b", "text": "To control shape, contrast, direction, or separation in the image", "isCorrect": true}, {"id": "c", "text": "To reduce the focal length of the lens", "isCorrect": false}, {"id": "d", "text": "To make daylight less blue without changing the overall look", "isCorrect": false}]'::jsonb,
  'A cinematographer often uses light not just because more exposure is needed, but to influence the image: shaping faces, controlling contrast, guiding the eye, or creating separation.',
  true
),
(
  'lighting-craft-013',
  'Lighting Craft',
  'What is a common reason a cinematographer might choose to augment daylight coming through a window with an additional source?',
  '[{"id": "a", "text": "To make the daylight physically more natural", "isCorrect": false}, {"id": "b", "text": "To increase sensor crop factor and reduce distortion", "isCorrect": false}, {"id": "c", "text": "To gain more control over consistency, direction, or intensity than the natural daylight alone provides", "isCorrect": true}, {"id": "d", "text": "To make the lens resolve more detail in the highlights", "isCorrect": false}]'::jsonb,
  'Natural daylight can look great, but it can also be inconsistent or insufficiently controlled. Adding a source can help maintain continuity and shape the image more deliberately.',
  true
),
(
  'lighting-craft-014',
  'Lighting Craft',
  'Why might a cinematographer choose tube lights instead of a larger traditional fixture for a tight location?',
  '[{"id": "a", "text": "Because tube lights always produce harder shadows than larger fixtures", "isCorrect": false}, {"id": "b", "text": "Because tube lights are easier to hide in frame or rig in small spaces while still adding controlled light", "isCorrect": true}, {"id": "c", "text": "Because tube lights automatically match any practical in the scene without adjustment", "isCorrect": false}, {"id": "d", "text": "Because tube lights always have more output than larger fixtures", "isCorrect": false}]'::jsonb,
  'Tube lights are often chosen in tight spaces because they are small, versatile, easy to rig, and can be hidden in frame or integrated into practical-looking setups more easily than larger fixtures.',
  true
),
(
  'lighting-craft-015',
  'Lighting Craft',
  'What is the main reason a cinematographer might add a grid to a soft light?',
  '[{"id": "a", "text": "To make the source physically larger and softer", "isCorrect": false}, {"id": "b", "text": "To reduce spill and control the direction of the soft source", "isCorrect": true}, {"id": "c", "text": "To raise the color temperature of the fixture", "isCorrect": false}, {"id": "d", "text": "To increase the fixture’s maximum output", "isCorrect": false}]'::jsonb,
  'A grid helps control spill from a soft source, keeping the light off unwanted areas while maintaining the soft quality of the source itself.',
  true
),
(
  'lighting-craft-016',
  'Lighting Craft',
  'Why might a cinematographer choose to place a diffusion frame in front of a source instead of using the bare fixture directly?',
  '[{"id": "a", "text": "To make the source appear larger and soften shadow transitions", "isCorrect": true}, {"id": "b", "text": "To increase shutter angle without changing exposure", "isCorrect": false}, {"id": "c", "text": "To make the source more daylight-balanced", "isCorrect": false}, {"id": "d", "text": "To reduce the sensor’s highlight clipping point", "isCorrect": false}]'::jsonb,
  'A diffusion frame increases the apparent size of the source and softens the transition between light and shadow.',
  true
),
(
  'lighting-craft-017',
  'Lighting Craft',
  'What is the main effect of adding fill light to the shadow side of a face?',
  '[{"id": "a", "text": "It makes the key light harder", "isCorrect": false}, {"id": "b", "text": "It reduces contrast by lifting the shadow side", "isCorrect": true}, {"id": "c", "text": "It increases backlight separation", "isCorrect": false}, {"id": "d", "text": "It changes the focal length feel of the shot", "isCorrect": false}]'::jsonb,
  'Fill light lifts the shadow side and reduces the contrast ratio between the lit and unlit parts of the face.',
  true
),
(
  'lighting-craft-018',
  'Lighting Craft',
  'Why might a cinematographer choose to bounce a source instead of pointing it directly at the subject?',
  '[{"id": "a", "text": "To create a softer and often broader source with a different direction feel", "isCorrect": true}, {"id": "b", "text": "To increase the frame rate flexibility of the setup", "isCorrect": false}, {"id": "c", "text": "To make the fixture output more efficient than direct use", "isCorrect": false}, {"id": "d", "text": "To remove the need for white balance adjustments", "isCorrect": false}]'::jsonb,
  'Bouncing turns another surface into the effective source, which often makes the light softer, broader, and directionally different than the bare fixture.',
  true
),
(
  'visual-language-001',
  'Visual Language',
  'What is the main visual effect of moving the camera closer to a subject while switching to a wider lens to keep a similar framing?',
  '[{"id": "a", "text": "The background usually feels more compressed", "isCorrect": false}, {"id": "b", "text": "The perspective usually feels more exaggerated", "isCorrect": true}, {"id": "c", "text": "The depth of field always becomes deeper in every practical case", "isCorrect": false}, {"id": "d", "text": "The subject always appears flatter", "isCorrect": false}]'::jsonb,
  'Moving the camera closer changes perspective. Using a wider lens to maintain similar framing often makes spatial relationships feel more exaggerated, especially in faces and foreground-background separation.',
  true
),
(
  'visual-language-002',
  'Visual Language',
  'What is the main visual effect of placing the camera lower and aiming slightly upward at a character?',
  '[{"id": "a", "text": "The character often feels more dominant or imposing", "isCorrect": true}, {"id": "b", "text": "The character often feels more observationally neutral", "isCorrect": false}, {"id": "c", "text": "The character often feels more vulnerable or diminished", "isCorrect": false}, {"id": "d", "text": "The character often feels more detached from the environment", "isCorrect": false}]'::jsonb,
  'A lower camera angle often makes a character feel stronger, larger, or more imposing. The exact effect still depends on context, framing, and performance.',
  true
),
(
  'visual-language-003',
  'Visual Language',
  'Two shots have the same framing of a face on the same sensor. Shot A is made with a wider lens from closer. Shot B is made with a longer lens from farther away. What changes most directly between the two shots?',
  '[{"id": "a", "text": "Perspective rendering", "isCorrect": true}, {"id": "b", "text": "Depth of field", "isCorrect": false}, {"id": "c", "text": "Subject size in frame", "isCorrect": false}, {"id": "d", "text": "Camera height relationship", "isCorrect": false}]'::jsonb,
  'Because the framing is matched, the subject size in frame stays similar. The main visual difference comes from the change in camera distance, which changes perspective rendering. The wider-lens/closer shot exaggerates spatial relationships more than the longer-lens/farther shot.',
  true
),
(
  'visual-language-004',
  'Visual Language',
  'Two shots are framed identically on the same sensor. One is shot on a wider lens from closer, the other on a longer lens from farther away. What changes most directly?',
  '[{"id": "a", "text": "Perspective rendering", "isCorrect": true}, {"id": "b", "text": "Subject scale", "isCorrect": false}, {"id": "c", "text": "Camera height", "isCorrect": false}, {"id": "d", "text": "Screen direction", "isCorrect": false}]'::jsonb,
  'If framing is matched, subject scale stays similar. The main difference comes from camera distance, which changes perspective rendering.',
  true
),
(
  'visual-language-005',
  'Visual Language',
  'If the camera position stays the same and you switch from a 35mm to an 85mm lens on the same sensor, what changes most directly?',
  '[{"id": "a", "text": "Perspective", "isCorrect": false}, {"id": "b", "text": "Subject-to-background spatial relationship", "isCorrect": false}, {"id": "c", "text": "Field of view", "isCorrect": true}, {"id": "d", "text": "Eyeline geometry", "isCorrect": false}]'::jsonb,
  'If the camera does not move, perspective stays the same. The most direct change is a tighter field of view.',
  true
),
(
  'visual-language-006',
  'Visual Language',
  'A close-up feels unusually distorted, with facial features appearing more exaggerated than expected. What is the most likely cause?',
  '[{"id": "a", "text": "The camera is too close with a wider lens", "isCorrect": true}, {"id": "b", "text": "The camera is too far with a longer lens", "isCorrect": false}, {"id": "c", "text": "The aperture is too wide", "isCorrect": false}, {"id": "d", "text": "The sensor is too large", "isCorrect": false}]'::jsonb,
  'That kind of facial exaggeration usually comes from camera distance. A wider lens used very close to the face makes perspective feel more aggressive.',
  true
),
(
  'visual-language-007',
  'Visual Language',
  'If a cinematographer wants the background to feel more present in relation to the subject, which choice is most likely to push the image that way?',
  '[{"id": "a", "text": "Move farther away and use a longer lens", "isCorrect": false}, {"id": "b", "text": "Move closer and use a wider lens", "isCorrect": true}, {"id": "c", "text": "Raise ISO", "isCorrect": false}, {"id": "d", "text": "Lower shutter angle", "isCorrect": false}]'::jsonb,
  'Moving closer with a wider lens tends to exaggerate spatial relationships, making the background feel more active relative to the subject.',
  true
),
(
  'visual-language-008',
  'Visual Language',
  'What is the most direct visual result of raising the camera from eye level to a noticeably higher angle on a character?',
  '[{"id": "a", "text": "The character often feels less dominant", "isCorrect": true}, {"id": "b", "text": "The focal length feels longer", "isCorrect": false}, {"id": "c", "text": "The shot gains more compression", "isCorrect": false}, {"id": "d", "text": "The image becomes more symmetrical by default", "isCorrect": false}]'::jsonb,
  'A higher angle often reduces the character’s visual power or dominance, depending on context.',
  true
),
(
  'visual-language-009',
  'Visual Language',
  'If a character is framed with a large amount of empty space in front of their eyeline, what does that space most commonly do?',
  '[{"id": "a", "text": "It usually makes the image feel flatter", "isCorrect": false}, {"id": "b", "text": "It often suggests direction, attention, or anticipation", "isCorrect": true}, {"id": "c", "text": "It automatically makes the shot more objective", "isCorrect": false}, {"id": "d", "text": "It reduces the need for background detail", "isCorrect": false}]'::jsonb,
  'Lead room or looking room often gives visual direction to a shot and can suggest thought, tension, anticipation, or off-screen presence.',
  true
),
(
  'visual-language-010',
  'Visual Language',
  'What is the most likely visual result of making a shot more symmetrical?',
  '[{"id": "a", "text": "It often feels more formal, controlled, or deliberate", "isCorrect": true}, {"id": "b", "text": "It always feels more naturalistic", "isCorrect": false}, {"id": "c", "text": "It always feels more intimate", "isCorrect": false}, {"id": "d", "text": "It reduces the sense of depth in the image", "isCorrect": false}]'::jsonb,
  'Symmetry often creates a stronger sense of control, design, intention, or stillness, though its emotional meaning depends on context.',
  true
),
(
  'visual-language-011',
  'Visual Language',
  'What is the most direct visual consequence of pushing into a subject during a moment of realization?',
  '[{"id": "a", "text": "It usually makes the background brighter", "isCorrect": false}, {"id": "b", "text": "It often increases emotional focus on the subject", "isCorrect": true}, {"id": "c", "text": "It changes the scene’s white balance", "isCorrect": false}, {"id": "d", "text": "It makes the perspective more neutral", "isCorrect": false}]'::jsonb,
  'A push-in often increases emphasis and emotional focus, making the moment feel more subjectively important.',
  true
),
(
  'visual-language-012',
  'Visual Language',
  'What is the most direct visual consequence of cutting from a wide shot to a tight close-up during an emotional beat?',
  '[{"id": "a", "text": "It often increases emotional intensity and viewer focus", "isCorrect": true}, {"id": "b", "text": "It usually makes the scene feel more geographically clear", "isCorrect": false}, {"id": "c", "text": "It mainly reduces contrast in the frame", "isCorrect": false}, {"id": "d", "text": "It usually neutralizes the character’s emotional state", "isCorrect": false}]'::jsonb,
  'Moving from a wide shot to a close-up often increases emotional intensity by narrowing attention onto the character and reducing environmental distraction.',
  true
),
(
  'visual-language-013',
  'Visual Language',
  'What is the most direct visual consequence of holding on a shot longer than expected after a character finishes speaking?',
  '[{"id": "a", "text": "It often increases tension, discomfort, or unspoken meaning", "isCorrect": true}, {"id": "b", "text": "It usually makes the shot feel wider", "isCorrect": false}, {"id": "c", "text": "It mainly changes the scene’s color contrast", "isCorrect": false}, {"id": "d", "text": "It usually makes the performance feel less subjective", "isCorrect": false}]'::jsonb,
  'Holding longer than expected can shift attention to silence, reaction, and subtext, often increasing tension or discomfort.',
  true
),
(
  'visual-language-014',
  'Visual Language',
  'What is the most direct visual consequence of using a Dutch angle?',
  '[{"id": "a", "text": "It often introduces a sense of imbalance or instability", "isCorrect": true}, {"id": "b", "text": "It usually makes the focal length feel longer", "isCorrect": false}, {"id": "c", "text": "It mainly reduces depth of field", "isCorrect": false}, {"id": "d", "text": "It usually flattens facial features", "isCorrect": false}]'::jsonb,
  'A Dutch angle tilts the horizon and frame lines, which often creates a feeling of imbalance, unease, or instability.',
  true
),
(
  'set-production-knowledge-001',
  'Set & Production Knowledge',
  'Who is primarily responsible for the visual framing and camera placement decisions on set, in collaboration with the director?',
  '[{"id": "a", "text": "Gaffer", "isCorrect": false}, {"id": "b", "text": "1st AC", "isCorrect": false}, {"id": "c", "text": "Director of Photography", "isCorrect": true}, {"id": "d", "text": "DIT", "isCorrect": false}]'::jsonb,
  'The Director of Photography is primarily responsible for the camera’s visual language — including framing, lensing, and camera placement — in collaboration with the director.',
  true
),
(
  'set-production-knowledge-002',
  'Set & Production Knowledge',
  'The Director of Photography wants a stronger edge light, but the fixture is creating unwanted spill on the background. Who would most commonly take the lead in solving that lighting control problem on set?',
  '[{"id": "a", "text": "DIT", "isCorrect": false}, {"id": "b", "text": "Gaffer", "isCorrect": true}, {"id": "c", "text": "1st AD", "isCorrect": false}, {"id": "d", "text": "Script Supervisor", "isCorrect": false}]'::jsonb,
  'The gaffer is typically responsible for executing and refining the lighting setup, including solving practical spill and control problems in collaboration with the DP.',
  true
),
(
  'set-production-knowledge-003',
  'Set & Production Knowledge',
  'Who is most directly responsible for maintaining continuity notes about actions, props, eyelines, and coverage across takes?',
  '[{"id": "a", "text": "1st AC", "isCorrect": false}, {"id": "b", "text": "Script Supervisor", "isCorrect": true}, {"id": "c", "text": "Gaffer", "isCorrect": false}, {"id": "d", "text": "Key Grip", "isCorrect": false}]'::jsonb,
  'The script supervisor tracks continuity and coverage details to help maintain consistency across takes and setups.',
  true
),
(
  'set-production-knowledge-004',
  'Set & Production Knowledge',
  'What is usually the smartest reason to rehearse a camera move with actors before final tweaks to lighting and focus?',
  '[{"id": "a", "text": "It helps reveal practical issues in timing, marks, framing, and light interaction before the crew fine-tunes the setup", "isCorrect": true}, {"id": "b", "text": "It guarantees the shot will need fewer takes once sound starts rolling", "isCorrect": false}, {"id": "c", "text": "It allows the DIT to set the final LUT before the camera team gets involved", "isCorrect": false}, {"id": "d", "text": "It prevents the need for blocking notes from script supervision", "isCorrect": false}]'::jsonb,
  'A rehearsal often reveals real problems in marks, timing, framing, shadows, focus pulls, and practical interactions. That helps the crew refine the setup more intelligently.',
  true
),
(
  'set-production-knowledge-005',
  'Set & Production Knowledge',
  'A scene is running late, and the full planned coverage will likely not fit in the remaining time. What is usually the smartest first move?',
  '[{"id": "a", "text": "Keep shooting exactly as planned and hope later setups go faster", "isCorrect": false}, {"id": "b", "text": "Pause and decide which shots are truly essential for story and edit coverage", "isCorrect": true}, {"id": "c", "text": "Switch every shot to handheld without discussing it", "isCorrect": false}, {"id": "d", "text": "Drop the master shot first, because close-ups are always more important", "isCorrect": false}]'::jsonb,
  'When time gets tight, the smartest move is to reassess priorities: what coverage is essential for story clarity, performance, and edit flexibility.',
  true
),
(
  'set-production-knowledge-006',
  'Set & Production Knowledge',
  'Why is it risky to light a scene too precisely before actor blocking is properly confirmed?',
  '[{"id": "a", "text": "Because the final color temperature of the camera may drift during rehearsal", "isCorrect": false}, {"id": "b", "text": "Because any change in actor position can break the intended lighting and force major reworking", "isCorrect": true}, {"id": "c", "text": "Because the lens choice may become unusable once the gaffer starts dimming fixtures", "isCorrect": false}, {"id": "d", "text": "Because script continuity cannot be tracked until lighting is finished", "isCorrect": false}]'::jsonb,
  'If blocking changes, carefully targeted lighting can stop working immediately. Confirming actor movement first usually makes lighting adjustments far more efficient.',
  true
),
(
  'set-production-knowledge-007',
  'Set & Production Knowledge',
  'What is usually the main reason to shoot a master shot even if the scene will also be covered in singles and inserts?',
  '[{"id": "a", "text": "It gives the editor a full spatial and performance reference for the scene", "isCorrect": true}, {"id": "b", "text": "It automatically makes continuity easier than all other coverage", "isCorrect": false}, {"id": "c", "text": "It guarantees fewer lighting setups later", "isCorrect": false}, {"id": "d", "text": "It always becomes the emotional core of the scene", "isCorrect": false}]'::jsonb,
  'A master shot gives the editor a complete version of the scene in time and space, which can be extremely useful for structure, pacing, and continuity.',
  true
),
(
  'set-production-knowledge-008',
  'Set & Production Knowledge',
  'What is the biggest risk of crossing the 180-degree line without clear intention?',
  '[{"id": "a", "text": "The light direction always becomes flatter", "isCorrect": false}, {"id": "b", "text": "Screen direction and spatial relationships may become confusing", "isCorrect": true}, {"id": "c", "text": "The lens will appear wider than intended", "isCorrect": false}, {"id": "d", "text": "The scene will automatically lose continuity in exposure", "isCorrect": false}]'::jsonb,
  'Crossing the line can flip screen direction and confuse the viewer’s sense of geography unless it is motivated or clearly reset.',
  true
),
(
  'set-production-knowledge-009',
  'Set & Production Knowledge',
  'Why is eyeline consistency important when shooting coverage of a conversation?',
  '[{"id": "a", "text": "It helps preserve believable spatial relationships between characters", "isCorrect": true}, {"id": "b", "text": "It makes the color contrast between setups easier to match", "isCorrect": false}, {"id": "c", "text": "It reduces the need for room tone", "isCorrect": false}, {"id": "d", "text": "It allows wider lenses to feel more neutral", "isCorrect": false}]'::jsonb,
  'Consistent eyelines help maintain the illusion that characters are looking at each other correctly across cuts.',
  true
),
(
  'set-production-knowledge-010',
  'Set & Production Knowledge',
  'What is usually the smartest reason to capture room tone on set?',
  '[{"id": "a", "text": "It helps the colorist balance background texture in post", "isCorrect": false}, {"id": "b", "text": "It gives the editor and sound team clean ambient sound to bridge cuts", "isCorrect": true}, {"id": "c", "text": "It improves focus consistency between takes", "isCorrect": false}, {"id": "d", "text": "It reduces the chance of lens breathing in close-ups", "isCorrect": false}]'::jsonb,
  'Room tone gives post-production a clean ambient bed that helps smooth audio edits and maintain continuity.',
  true
),
(
  'set-production-knowledge-011',
  'Set & Production Knowledge',
  'What is usually the main reason to shoot an insert?',
  '[{"id": "a", "text": "To increase dynamic range in the sequence", "isCorrect": false}, {"id": "b", "text": "To isolate important visual information or action detail", "isCorrect": true}, {"id": "c", "text": "To replace all wider coverage in the edit", "isCorrect": false}, {"id": "d", "text": "To make the scene feel more objective", "isCorrect": false}]'::jsonb,
  'Inserts are often used to show specific details clearly, guide attention, or give the editor useful cut points.',
  true
),
(
  'set-production-knowledge-012',
  'Set & Production Knowledge',
  'What is usually the smartest reason to shoot an over-the-shoulder instead of a straight single in a dialogue scene?',
  '[{"id": "a", "text": "It can preserve spatial relationship and keep the other character present in the frame", "isCorrect": true}, {"id": "b", "text": "It always makes the lens feel longer", "isCorrect": false}, {"id": "c", "text": "It removes the need for eyeline matching", "isCorrect": false}, {"id": "d", "text": "It guarantees better continuity than a single", "isCorrect": false}]'::jsonb,
  'An over-the-shoulder can help preserve geography and keep the scene feeling relational, because the other character remains visually present.',
  true
),
(
  'set-production-knowledge-013',
  'Set & Production Knowledge',
  'What is usually the biggest practical advantage of getting a clean plate on set?',
  '[{"id": "a", "text": "It gives the editor a version of the scene with better performance continuity", "isCorrect": false}, {"id": "b", "text": "It can help VFX or cleanup work by providing a frame without actors or moving elements", "isCorrect": true}, {"id": "c", "text": "It automatically improves dynamic range in post", "isCorrect": false}, {"id": "d", "text": "It makes focus pulls easier to match across coverage", "isCorrect": false}]'::jsonb,
  'A clean plate is often useful for VFX, object removal, or cleanup work because it gives post-production a version of the frame without unwanted elements.',
  true
),
(
  'cinematic-reading-001',
  'Cinematic Reading',
  'A scene is shot mostly in static wide frames with characters kept small inside the environment. What does that most commonly emphasize?',
  '[{"id": "a", "text": "Emotional intimacy and facial nuance above all else", "isCorrect": false}, {"id": "b", "text": "The relationship between the characters and their surroundings", "isCorrect": true}, {"id": "c", "text": "Shallow depth of field as the primary storytelling tool", "isCorrect": false}, {"id": "d", "text": "A highly subjective point of view from one character", "isCorrect": false}]'::jsonb,
  'Static wide framing often emphasizes space, environment, distance, and the relationship between characters and the world around them.',
  true
),
(
  'cinematic-reading-002',
  'Cinematic Reading',
  'A scene is covered mostly in tight close-ups with very little environmental context. What does that most commonly emphasize?',
  '[{"id": "a", "text": "Geography and spatial clarity", "isCorrect": false}, {"id": "b", "text": "Emotional detail and subjectivity", "isCorrect": true}, {"id": "c", "text": "Production design and world-building", "isCorrect": false}, {"id": "d", "text": "Neutral observation", "isCorrect": false}]'::jsonb,
  'Tight close-ups reduce environmental information and push attention toward expression, emotion, and subjectivity.',
  true
),
(
  'cinematic-reading-003',
  'Cinematic Reading',
  'A dialogue scene is shot with very symmetrical framing and carefully controlled composition. What quality does that most commonly add?',
  '[{"id": "a", "text": "A sense of formal control or deliberateness", "isCorrect": true}, {"id": "b", "text": "A more documentary-like feeling", "isCorrect": false}, {"id": "c", "text": "A more chaotic and unstable feeling", "isCorrect": false}, {"id": "d", "text": "A more handheld and immediate feeling", "isCorrect": false}]'::jsonb,
  'Symmetry often creates a feeling of control, design, precision, or intentional stillness.',
  true
),
(
  'cinematic-reading-004',
  'Cinematic Reading',
  'A character is filmed from far away with a long lens, isolated against a soft background. What does that most commonly do to the viewer’s reading of the image?',
  '[{"id": "a", "text": "It usually makes the moment feel more spatially open and casual", "isCorrect": false}, {"id": "b", "text": "It usually makes the character feel more embedded in the environment", "isCorrect": false}, {"id": "c", "text": "It often creates emotional distance while visually isolating the character", "isCorrect": true}, {"id": "d", "text": "It mainly makes the lighting feel harder", "isCorrect": false}]'::jsonb,
  'A distant long-lens shot often separates the character from the environment visually and can create a feeling of isolation or emotional distance.',
  true
),
(
  'cinematic-reading-005',
  'Cinematic Reading',
  'A scene is shot mostly with handheld camera movement that subtly reacts to the actors. What does that most commonly add?',
  '[{"id": "a", "text": "A sense of immediacy and instability", "isCorrect": true}, {"id": "b", "text": "A stronger feeling of formal distance", "isCorrect": false}, {"id": "c", "text": "A more diagrammatic understanding of space", "isCorrect": false}, {"id": "d", "text": "A more neutral, invisible viewpoint", "isCorrect": false}]'::jsonb,
  'Reactive handheld movement often makes a scene feel more immediate, present, and slightly unstable.',
  true
),
(
  'cinematic-reading-006',
  'Cinematic Reading',
  'A character is framed with a large amount of empty space around them in a quiet moment. What does that most commonly emphasize?',
  '[{"id": "a", "text": "Physical comedy", "isCorrect": false}, {"id": "b", "text": "Isolation or emotional distance", "isCorrect": true}, {"id": "c", "text": "Faster pacing", "isCorrect": false}, {"id": "d", "text": "A more objective color contrast", "isCorrect": false}]'::jsonb,
  'Large negative space often emphasizes loneliness, distance, or emotional separation.',
  true
),
(
  'cinematic-reading-007',
  'Cinematic Reading',
  'A scene suddenly cuts from smooth, controlled compositions to a much more chaotic visual style. What does that most commonly signal?',
  '[{"id": "a", "text": "A shift in emotional or psychological state", "isCorrect": true}, {"id": "b", "text": "A change in sensor size", "isCorrect": false}, {"id": "c", "text": "A change in white balance workflow", "isCorrect": false}, {"id": "d", "text": "A correction of screen direction", "isCorrect": false}]'::jsonb,
  'A sudden change in visual control often signals a shift in emotional intensity, instability, or subjective experience.',
  true
),
(
  'cinematic-reading-008',
  'Cinematic Reading',
  'If a character is repeatedly framed behind foreground objects, what does that most commonly add to the image?',
  '[{"id": "a", "text": "A cleaner sense of visual neutrality", "isCorrect": false}, {"id": "b", "text": "A flatter relationship to the environment", "isCorrect": false}, {"id": "c", "text": "A feeling of obstruction, voyeurism, or emotional distance", "isCorrect": true}, {"id": "d", "text": "A stronger sense of symmetrical balance", "isCorrect": false}]'::jsonb,
  'Foreground obstruction often makes the viewer feel separated from the subject, or suggests surveillance, tension, or emotional distance.',
  true
),
(
  'cinematic-reading-009',
  'Cinematic Reading',
  'A scene is played in a single unbroken take instead of being cut into coverage. What does that most commonly emphasize?',
  '[{"id": "a", "text": "Temporal continuity and sustained performance", "isCorrect": true}, {"id": "b", "text": "Faster pacing through compression", "isCorrect": false}, {"id": "c", "text": "Greater visual neutrality in every case", "isCorrect": false}, {"id": "d", "text": "More editorial control over eyelines", "isCorrect": false}]'::jsonb,
  'A long unbroken take often emphasizes real-time continuity, performance flow, and sustained tension or immersion.',
  true
),
(
  'lens-camera-intuition-001',
  'Lens & Camera Intuition',
  'Why might a cinematographer choose a wider lens for a close-up instead of a longer lens with similar framing?',
  '[{"id": "a", "text": "To make the image more color accurate", "isCorrect": false}, {"id": "b", "text": "To increase the sense of spatial tension and proximity", "isCorrect": true}, {"id": "c", "text": "To reduce depth of field without changing distance", "isCorrect": false}, {"id": "d", "text": "To make the background more compressed", "isCorrect": false}]'::jsonb,
  'A wider lens used closer to the subject can increase the feeling of proximity and spatial tension, even if the framing is similar.',
  true
),
(
  'lens-camera-intuition-002',
  'Lens & Camera Intuition',
  'What is the most direct visual consequence of switching from a spherical lens to an anamorphic lens while keeping a similar horizontal framing?',
  '[{"id": "a", "text": "The image usually gains shallower depth of field only because the stop changes", "isCorrect": false}, {"id": "b", "text": "The image usually feels taller and more compressed vertically", "isCorrect": false}, {"id": "c", "text": "The image often gains a wider horizontal feel and different optical character", "isCorrect": true}, {"id": "d", "text": "The image automatically becomes more neutral and less stylized", "isCorrect": false}]'::jsonb,
  'Anamorphic lenses often create a wider horizontal impression and bring their own optical character, such as different bokeh, flares, and rendering.',
  true
),
(
  'lens-camera-intuition-003',
  'Lens & Camera Intuition',
  'Why might a cinematographer choose a 25mm over a 50mm for a moving shot in a tight interior?',
  '[{"id": "a", "text": "To make the space feel larger and keep more of the environment present", "isCorrect": true}, {"id": "b", "text": "To reduce perspective change during movement", "isCorrect": false}, {"id": "c", "text": "To make the background feel more compressed", "isCorrect": false}, {"id": "d", "text": "To make focus pulling less necessary in every case", "isCorrect": false}]'::jsonb,
  'A wider lens can help include more of the space and often makes movement through a tight interior feel more spatially alive.',
  true
),
(
  'lens-camera-intuition-004',
  'Lens & Camera Intuition',
  'What is the most likely reason a cinematographer might avoid an extremely long lens for an emotional dialogue scene?',
  '[{"id": "a", "text": "It always makes the lighting flatter", "isCorrect": false}, {"id": "b", "text": "It can create too much distance from the actors and reduce the desired intimacy", "isCorrect": true}, {"id": "c", "text": "It automatically makes skin tones less accurate", "isCorrect": false}, {"id": "d", "text": "It prevents selective focus", "isCorrect": false}]'::jsonb,
  'A very long lens can feel emotionally distant or observational if the scene would benefit more from presence or intimacy.',
  true
),
(
  'lens-camera-intuition-005',
  'Lens & Camera Intuition',
  'What usually changes most when a cinematographer chooses to shoot the same framing on a larger sensor with a longer focal length?',
  '[{"id": "a", "text": "The white balance response", "isCorrect": false}, {"id": "b", "text": "The shutter relationship", "isCorrect": false}, {"id": "c", "text": "The depth rendering and field-of-view relationship", "isCorrect": true}, {"id": "d", "text": "The frame rate flexibility", "isCorrect": false}]'::jsonb,
  'Sensor size and focal length choices affect field of view and depth rendering, which can noticeably change how the image feels.',
  true
),
(
  'lens-camera-intuition-006',
  'Lens & Camera Intuition',
  'Why might a cinematographer deliberately choose a lens with more flare character instead of a cleaner modern lens?',
  '[{"id": "a", "text": "To increase sensor latitude in highlights", "isCorrect": false}, {"id": "b", "text": "To add a stronger optical personality to the image", "isCorrect": true}, {"id": "c", "text": "To make the frame rate feel smoother", "isCorrect": false}, {"id": "d", "text": "To reduce the need for negative fill", "isCorrect": false}]'::jsonb,
  'A lens with more flare character can add texture, mood, and a more distinctive optical personality to the image.',
  true
),
(
  'lens-camera-intuition-007',
  'Lens & Camera Intuition',
  'Why might a cinematographer choose a longer lens for a close-up instead of moving closer with a wider lens?',
  '[{"id": "a", "text": "To make the subject feel more isolated from the background", "isCorrect": true}, {"id": "b", "text": "To increase the sensor’s dynamic range", "isCorrect": false}, {"id": "c", "text": "To make motion blur more noticeable", "isCorrect": false}, {"id": "d", "text": "To reduce the need for exposure control", "isCorrect": false}]'::jsonb,
  'A longer lens from farther away often isolates the subject differently and changes the subject-background relationship compared with a closer wider-lens shot.',
  true
),
(
  'lens-camera-intuition-008',
  'Lens & Camera Intuition',
  'What is the most likely visual consequence of using a very wide lens too close to a face?',
  '[{"id": "a", "text": "The image usually feels flatter and more compressed", "isCorrect": false}, {"id": "b", "text": "Facial proportions can start to feel exaggerated", "isCorrect": true}, {"id": "c", "text": "The background always becomes softer", "isCorrect": false}, {"id": "d", "text": "The shot becomes more symmetrical", "isCorrect": false}]'::jsonb,
  'A very wide lens used close to a face can exaggerate spatial relationships and make facial features feel more distorted or aggressive.',
  true
),
(
  'lens-camera-intuition-009',
  'Lens & Camera Intuition',
  'Why might a cinematographer choose a clean modern lens over a more characterful vintage lens?',
  '[{"id": "a", "text": "To increase the camera’s frame rate options", "isCorrect": false}, {"id": "b", "text": "To get more neutral rendering and consistency across the image", "isCorrect": true}, {"id": "c", "text": "To make the field of view wider at the same focal length", "isCorrect": false}, {"id": "d", "text": "To reduce the sensor crop factor", "isCorrect": false}]'::jsonb,
  'A clean modern lens is often chosen for its consistency, lower optical character, and more neutral rendering.',
  true
),
(
  'lens-camera-intuition-010',
  'Lens & Camera Intuition',
  'What is the most direct visual consequence of choosing a lens with heavier focus falloff?',
  '[{"id": "a", "text": "The in-focus plane feels more selective and the image can feel more dimensional", "isCorrect": true}, {"id": "b", "text": "The frame always becomes lower contrast", "isCorrect": false}, {"id": "c", "text": "The image automatically becomes warmer", "isCorrect": false}, {"id": "d", "text": "The perspective becomes more compressed", "isCorrect": false}]'::jsonb,
  'Stronger focus falloff can make the in-focus area feel more selective and create a stronger sense of separation or dimensionality.',
  true
),
(
  'lens-camera-intuition-011',
  'Lens & Camera Intuition',
  'Why might a cinematographer choose a wider lens even when a longer lens could achieve the same framing?',
  '[{"id": "a", "text": "To reduce highlight clipping in the background", "isCorrect": false}, {"id": "b", "text": "To make camera movement feel more pronounced and spatial", "isCorrect": true}, {"id": "c", "text": "To make skin tones more neutral", "isCorrect": false}, {"id": "d", "text": "To make the image less dependent on blocking", "isCorrect": false}]'::jsonb,
  'A wider lens often makes movement feel more active and spatially expressive, even if the framing could also be achieved with a longer lens from farther away.',
  true
)
on conflict (key) do update
set
  category = excluded.category,
  prompt = excluded.prompt,
  options = excluded.options,
  explanation = excluded.explanation,
  is_active = excluded.is_active,
  updated_at = now();

-- Social layer extension: collaboration-ready profile metadata and friend graph indexes
alter table public.profiles
add column if not exists open_to_collaborate boolean not null default false;

alter table public.profiles
add column if not exists collaboration_note text not null default '';

create index if not exists profiles_role_focus_idx
on public.profiles (role_focus);

create index if not exists profiles_experience_level_idx
on public.profiles (experience_level);

create index if not exists friendships_user_a_idx
on public.friendships (user_a);

create index if not exists friendships_user_b_idx
on public.friendships (user_b);

-- ============================================================================
-- Daily Practice / XP / Streak v1
-- ============================================================================

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'daily',
  status text not null default 'in_progress',
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  xp_earned integer not null default 0,
  goal_target_xp integer not null default 50,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint practice_sessions_status_check check (status in ('in_progress', 'completed', 'abandoned')),
  constraint practice_sessions_counts_check check (
    total_questions >= 0 and correct_count >= 0 and correct_count <= total_questions and xp_earned >= 0
  )
);

create index if not exists practice_sessions_user_status_idx
on public.practice_sessions (user_id, status, started_at desc);

create table if not exists public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  question_order integer not null,
  selected_option_id text,
  options_order jsonb not null,
  is_correct boolean,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint practice_answers_unique_question_order unique (session_id, question_order)
);

create index if not exists practice_answers_session_idx
on public.practice_answers (session_id, question_order);

create index if not exists practice_answers_user_idx
on public.practice_answers (user_id, session_id);

create table if not exists public.user_daily_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  xp_earned integer not null default 0,
  sessions_completed integer not null default 0,
  current_streak integer not null default 0,
  goal_target_xp integer not null default 50,
  goal_met boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_daily_progress_unique_day unique (user_id, day_date),
  constraint user_daily_progress_non_negative check (
    xp_earned >= 0 and sessions_completed >= 0 and current_streak >= 0 and goal_target_xp > 0
  )
);

create index if not exists user_daily_progress_user_day_idx
on public.user_daily_progress (user_id, day_date desc);

create table if not exists public.user_discipline_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  xp_earned integer not null default 0,
  total_answered integer not null default 0,
  total_correct integer not null default 0,
  mastery_status text not null default 'Emerging',
  last_practiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_discipline_progress_unique unique (user_id, category),
  constraint user_discipline_progress_counts_check check (
    xp_earned >= 0 and total_answered >= 0 and total_correct >= 0 and total_correct <= total_answered
  ),
  constraint user_discipline_progress_mastery_check check (
    mastery_status in ('Emerging', 'Developing', 'Proficient', 'Mastered')
  )
);

create index if not exists user_discipline_progress_user_idx
on public.user_discipline_progress (user_id);

create index if not exists user_discipline_progress_user_category_idx
on public.user_discipline_progress (user_id, category);

alter table public.practice_sessions enable row level security;
alter table public.practice_answers enable row level security;
alter table public.user_daily_progress enable row level security;
alter table public.user_discipline_progress enable row level security;

drop policy if exists "Users can view own practice sessions" on public.practice_sessions;
drop policy if exists "Users can insert own practice sessions" on public.practice_sessions;
drop policy if exists "Users can update own practice sessions" on public.practice_sessions;

create policy "Users can view own practice sessions"
on public.practice_sessions
for select
using (auth.uid() = user_id);

create policy "Users can insert own practice sessions"
on public.practice_sessions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own practice sessions"
on public.practice_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view own practice answers" on public.practice_answers;
drop policy if exists "Users can insert own practice answers" on public.practice_answers;
drop policy if exists "Users can update own practice answers" on public.practice_answers;

create policy "Users can view own practice answers"
on public.practice_answers
for select
using (auth.uid() = user_id);

create policy "Users can insert own practice answers"
on public.practice_answers
for insert
with check (auth.uid() = user_id);

create policy "Users can update own practice answers"
on public.practice_answers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view own daily progress" on public.user_daily_progress;
drop policy if exists "Users can insert own daily progress" on public.user_daily_progress;
drop policy if exists "Users can update own daily progress" on public.user_daily_progress;

create policy "Users can view own daily progress"
on public.user_daily_progress
for select
using (auth.uid() = user_id);

create policy "Users can insert own daily progress"
on public.user_daily_progress
for insert
with check (auth.uid() = user_id);

create policy "Users can update own daily progress"
on public.user_daily_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view own discipline progress" on public.user_discipline_progress;
drop policy if exists "Users can insert own discipline progress" on public.user_discipline_progress;
drop policy if exists "Users can update own discipline progress" on public.user_discipline_progress;

create policy "Users can view own discipline progress"
on public.user_discipline_progress
for select
using (auth.uid() = user_id);

create policy "Users can insert own discipline progress"
on public.user_discipline_progress
for insert
with check (auth.uid() = user_id);

create policy "Users can update own discipline progress"
on public.user_discipline_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================================
-- Review Mistakes tracker
-- ============================================================================

create table if not exists public.user_missed_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  miss_count integer not null default 0,
  correct_review_count integer not null default 0,
  status text not null default 'open',
  first_missed_at timestamptz,
  last_missed_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_missed_questions_unique unique (user_id, question_id),
  constraint user_missed_questions_counts_check check (miss_count >= 0 and correct_review_count >= 0),
  constraint user_missed_questions_status_check check (status in ('open', 'mastered'))
);

create index if not exists user_missed_questions_user_status_idx
on public.user_missed_questions (user_id, status, last_missed_at desc);

alter table public.user_missed_questions enable row level security;

drop policy if exists "Users can view own missed questions" on public.user_missed_questions;
drop policy if exists "Users can insert own missed questions" on public.user_missed_questions;
drop policy if exists "Users can update own missed questions" on public.user_missed_questions;

create policy "Users can view own missed questions"
on public.user_missed_questions
for select
using (auth.uid() = user_id);

create policy "Users can insert own missed questions"
on public.user_missed_questions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own missed questions"
on public.user_missed_questions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================================
-- Adaptive learning profile + question metadata (v1)
-- ============================================================================

alter table public.assessment_questions
add column if not exists subtopic text;

alter table public.assessment_questions
add column if not exists difficulty text;

alter table public.assessment_questions
add column if not exists question_type text;

alter table public.assessment_questions
add column if not exists role_relevance text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assessment_questions_difficulty_valid'
      and conrelid = 'public.assessment_questions'::regclass
  ) then
    alter table public.assessment_questions
    add constraint assessment_questions_difficulty_valid
    check (difficulty is null or difficulty in ('foundation', 'core', 'advanced'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assessment_questions_type_valid'
      and conrelid = 'public.assessment_questions'::regclass
  ) then
    alter table public.assessment_questions
    add constraint assessment_questions_type_valid
    check (question_type is null or question_type in ('technical', 'interpretive'));
  end if;
end $$;

update public.assessment_questions
set
  difficulty = coalesce(
    difficulty,
    case
      when lower(prompt) like '%most accurate%' then 'core'
      when lower(prompt) like '%most likely%' then 'core'
      when lower(prompt) like '%why might%' then 'advanced'
      else 'foundation'
    end
  ),
  question_type = coalesce(
    question_type,
    case
      when category in ('Cinematic Reading', 'Visual Language') then 'interpretive'
      else 'technical'
    end
  ),
  role_relevance = coalesce(role_relevance, array['dop','director','gaffer']),
  subtopic = coalesce(
    nullif(subtopic, ''),
    case
      when category = 'Technical Fundamentals' then 'Camera Fundamentals'
      when category = 'Lighting Craft' then 'Lighting Decisions'
      when category = 'Visual Language' then 'Visual Grammar'
      when category = 'Set & Production Knowledge' then 'Set Workflow'
      when category = 'Cinematic Reading' then 'Visual Interpretation'
      when category = 'Lens & Camera Intuition' then 'Lens Intuition'
      else 'General'
    end
  );

create index if not exists assessment_questions_category_subtopic_idx
on public.assessment_questions (category, subtopic);

create index if not exists assessment_questions_category_difficulty_idx
on public.assessment_questions (category, difficulty);

create table if not exists public.user_learning_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role_focus_snapshot text not null default '',
  weakest_disciplines text[] not null default '{}',
  strongest_disciplines text[] not null default '{}',
  weak_subtopics text[] not null default '{}',
  total_xp integer not null default 0,
  weekly_xp integer not null default 0,
  current_streak integer not null default 0,
  recent_accuracy numeric not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_learning_profiles_non_negative check (
    total_xp >= 0 and weekly_xp >= 0 and current_streak >= 0 and recent_accuracy >= 0
  )
);

create index if not exists user_learning_profiles_updated_idx
on public.user_learning_profiles (updated_at desc);

alter table public.user_learning_profiles enable row level security;

drop policy if exists "Users can view own learning profile" on public.user_learning_profiles;
drop policy if exists "Users can insert own learning profile" on public.user_learning_profiles;
drop policy if exists "Users can update own learning profile" on public.user_learning_profiles;

create policy "Users can view own learning profile"
on public.user_learning_profiles
for select
using (auth.uid() = user_id);

create policy "Users can insert own learning profile"
on public.user_learning_profiles
for insert
with check (auth.uid() = user_id);

create policy "Users can update own learning profile"
on public.user_learning_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.practice_sessions
add column if not exists lesson_date date not null default current_date;

alter table public.practice_sessions
add column if not exists lesson_plan jsonb;

alter table public.practice_sessions
add column if not exists generator_version text;

alter table public.practice_sessions
add column if not exists strongest_discipline text;

alter table public.practice_sessions
add column if not exists weakest_discipline text;

alter table public.practice_sessions
add column if not exists coach_summary text;

alter table public.practice_sessions
add column if not exists coach_next_focus text;

create index if not exists practice_sessions_user_lesson_date_idx
on public.practice_sessions (user_id, lesson_date desc);
