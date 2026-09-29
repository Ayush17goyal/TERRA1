alter table if exists public.user_settings_profiles
  add column if not exists ai_provider_onboarding_completed boolean not null default false;

alter table if exists public.user_settings_profiles
  add column if not exists ai_provider_onboarding_completed_at timestamptz;
