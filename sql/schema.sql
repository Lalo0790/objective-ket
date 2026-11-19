-- Objective KET schema (separate "ket_" prefix; does not touch the objective-ielts tables)
create table if not exists public.ket_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','teacher')),
  display_name text not null,
  created_at timestamptz default now()
);

create or replace function public.ket_is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from ket_profiles where id = auth.uid() and role = 'teacher');
$$;
create or replace function public.ket_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from ket_profiles where id = auth.uid());
$$;

create table if not exists public.ket_settings (
  id int primary key default 1 check (id = 1),
  student_id uuid references auth.users(id),
  start_date date not null default date '2026-11-30',
  exam_date date not null default date '2027-05-01',
  exam_tentative boolean not null default true,
  study_days int[] not null default '{1,3,4}',
  exam_kind text not null default 'schools' check (exam_kind in ('schools','standard')),
  updated_at timestamptz default now()
);

create table if not exists public.ket_submissions (
  id bigserial primary key,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  task_id text not null,
  skill text not null,
  title text,
  kind text,
  answers jsonb,
  auto_score numeric,
  auto_max numeric,
  text_answer text,
  audio_path text,
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_id, task_id)
);

create table if not exists public.ket_item_feedback (
  submission_id bigint primary key references public.ket_submissions(id) on delete cascade,
  comment text,
  grade numeric(3,1),
  updated_at timestamptz default now()
);

create table if not exists public.ket_weekly_reviews (
  id bigserial primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  grade_reading numeric(3,1),
  grade_listening numeric(3,1),
  grade_writing numeric(3,1),
  grade_speaking numeric(3,1),
  comment_reading text,
  comment_listening text,
  comment_writing text,
  comment_speaking text,
  summary text,
  published boolean default true,
  updated_at timestamptz default now(),
  unique (student_id, week_start)
);

alter table ket_profiles enable row level security;
alter table ket_settings enable row level security;
alter table ket_submissions enable row level security;
alter table ket_item_feedback enable row level security;
alter table ket_weekly_reviews enable row level security;

drop policy if exists ket_p_profiles_read on ket_profiles;
create policy ket_p_profiles_read on ket_profiles for select to authenticated using (id = auth.uid() or ket_is_teacher());

drop policy if exists ket_p_settings_read on ket_settings;
create policy ket_p_settings_read on ket_settings for select to authenticated using (ket_is_member());
drop policy if exists ket_p_settings_write on ket_settings;
create policy ket_p_settings_write on ket_settings for update to authenticated using (ket_is_teacher()) with check (ket_is_teacher());

drop policy if exists ket_p_sub_read on ket_submissions;
create policy ket_p_sub_read on ket_submissions for select to authenticated using (student_id = auth.uid() or ket_is_teacher());
drop policy if exists ket_p_sub_ins on ket_submissions;
create policy ket_p_sub_ins on ket_submissions for insert to authenticated with check (student_id = auth.uid() and ket_is_member());
drop policy if exists ket_p_sub_upd on ket_submissions;
create policy ket_p_sub_upd on ket_submissions for update to authenticated using (student_id = auth.uid() and ket_is_member()) with check (student_id = auth.uid());

drop policy if exists ket_p_fb_read on ket_item_feedback;
create policy ket_p_fb_read on ket_item_feedback for select to authenticated using (
  ket_is_teacher() or exists(select 1 from ket_submissions s where s.id = submission_id and s.student_id = auth.uid()));
drop policy if exists ket_p_fb_write on ket_item_feedback;
create policy ket_p_fb_write on ket_item_feedback for all to authenticated using (ket_is_teacher()) with check (ket_is_teacher());

drop policy if exists ket_p_wr_read on ket_weekly_reviews;
create policy ket_p_wr_read on ket_weekly_reviews for select to authenticated using (ket_is_teacher() or (student_id = auth.uid() and published));
drop policy if exists ket_p_wr_write on ket_weekly_reviews;
create policy ket_p_wr_write on ket_weekly_reviews for all to authenticated using (ket_is_teacher()) with check (ket_is_teacher());

-- storage for speaking recordings (own bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ket-speaking','ket-speaking', false, 15728640, array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/aac','audio/x-m4a'])
on conflict (id) do nothing;

drop policy if exists ket_p_audio_ins on storage.objects;
create policy ket_p_audio_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'ket-speaking' and public.ket_is_member() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists ket_p_audio_upd on storage.objects;
create policy ket_p_audio_upd on storage.objects for update to authenticated
  using (bucket_id = 'ket-speaking' and public.ket_is_member() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists ket_p_audio_read on storage.objects;
create policy ket_p_audio_read on storage.objects for select to authenticated
  using (bucket_id = 'ket-speaking' and ((storage.foldername(name))[1] = auth.uid()::text or public.ket_is_teacher()));

insert into ket_settings (id) values (1) on conflict do nothing;
