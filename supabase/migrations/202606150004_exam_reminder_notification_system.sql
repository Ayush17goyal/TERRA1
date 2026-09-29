-- Production exam reminders, delivery metadata, and user-specific calendar linkage.

alter table public.exams
  add column if not exists clerk_user_id text,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists subject_name text,
  add column if not exists exam_time time,
  add column if not exists reminder_type text,
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists reminder_trigger_at timestamp with time zone,
  add column if not exists reminder_sent_at timestamp with time zone,
  add column if not exists timezone text not null default 'Asia/Kolkata';

update public.exams
set
  subject_name = coalesce(subject_name, subject),
  exam_time = coalesce(exam_time, exam_date::time),
  reminder_enabled = coalesce(reminder_enabled, email_reminder_enabled, false),
  reminder_type = coalesce(reminder_type, email_reminder_minutes::text || '_minutes'),
  reminder_trigger_at = coalesce(
    reminder_trigger_at,
    exam_date - make_interval(mins => coalesce(email_reminder_minutes, 1440))
  )
where subject_name is null
   or exam_time is null
   or reminder_type is null
   or reminder_trigger_at is null;

alter table public.notifications
  add column if not exists email_sent boolean not null default false,
  add column if not exists delivery_channel text not null default 'all',
  add column if not exists priority text not null default 'normal',
  add column if not exists exam_id uuid references public.exams(id) on delete cascade,
  add column if not exists clerk_user_id text,
  add column if not exists email_subject text,
  add column if not exists email_body text,
  add column if not exists delivered_at timestamp with time zone,
  add column if not exists failed_at timestamp with time zone,
  add column if not exists delivery_error text;

alter table public.google_oauth_tokens
  add column if not exists clerk_user_id text unique;

create index if not exists idx_exams_clerk_user_date
  on public.exams(clerk_user_id, exam_date);

create index if not exists idx_exams_reminder_due
  on public.exams(reminder_trigger_at)
  where reminder_enabled = true and reminder_sent_at is null;

create index if not exists idx_notifications_pending_delivery
  on public.notifications(trigger_time)
  where email_sent = false;

create unique index if not exists idx_notifications_exam_reminder_once
  on public.notifications(exam_id, type)
  where type = 'exam_reminder';

notify pgrst, 'reload schema';
