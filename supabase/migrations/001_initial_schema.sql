-- ============================================================
-- AI Job Application Automation — Initial Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  full_name       text,
  email           text,
  phone           text,
  headline        text,
  summary         text,
  education       jsonb default '[]'::jsonb,
  employment      jsonb default '[]'::jsonb,
  skills          jsonb default '[]'::jsonb,
  projects        jsonb default '[]'::jsonb,
  publications    jsonb default '[]'::jsonb,
  achievements    jsonb default '[]'::jsonb,
  certifications  jsonb default '[]'::jsonb,
  github_url      text,
  linkedin_url    text,
  portfolio_url   text,
  preferred_titles       jsonb default '[]'::jsonb,
  preferred_arrangements jsonb default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_user_id_unique unique (user_id)
);

alter table public.profiles enable row level security;

create policy "Owner only" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists profiles_user_id_idx on public.profiles(user_id);

-- ─── cv_documents ─────────────────────────────────────────────
create table if not exists public.cv_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  filename        text not null,
  file_path       text not null,
  extracted_text  text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.cv_documents enable row level security;

create policy "Owner only" on public.cv_documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists cv_documents_user_id_idx on public.cv_documents(user_id);

-- ─── job_applications ─────────────────────────────────────────
create table if not exists public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'processing'
                    check (status in (
                      'processing','draft_ready','awaiting_approval',
                      'approved','sending','sent','failed','cancelled'
                    )),
  source_type     text check (source_type in ('file','url','text')),
  source_url      text,
  raw_text        text,
  extracted_info  jsonb,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.job_applications enable row level security;

create policy "Owner only" on public.job_applications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists job_applications_user_id_idx on public.job_applications(user_id);
create index if not exists job_applications_status_idx on public.job_applications(status);

-- ─── application_drafts ───────────────────────────────────────
create table if not exists public.application_drafts (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.job_applications(id) on delete cascade,
  recipient_email  text,
  cc_email         text,
  subject          text,
  body             text,
  cover_letter     text,
  cv_document_id   uuid references public.cv_documents(id),
  draft_version    integer not null default 1,
  content_hash     text not null,
  ai_model_used    text,
  cv_match_summary text,
  missing_info     jsonb default '[]'::jsonb,
  concerns         jsonb default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.application_drafts enable row level security;

-- Access via join to job_applications
create policy "Owner only via application" on public.application_drafts
  for all to authenticated
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = application_drafts.application_id
        and ja.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.job_applications ja
      where ja.id = application_drafts.application_id
        and ja.user_id = (select auth.uid())
    )
  );

create index if not exists drafts_application_id_idx on public.application_drafts(application_id);

-- ─── application_approvals ────────────────────────────────────
create table if not exists public.application_approvals (
  id              uuid primary key default gen_random_uuid(),
  draft_id        uuid not null references public.application_drafts(id) on delete cascade,
  application_id  uuid not null references public.job_applications(id) on delete cascade,
  draft_version   integer not null,
  content_hash    text not null,
  approved_by     uuid not null references auth.users(id),
  approved_at     timestamptz not null default now(),
  -- Unique constraint: one approval per (draft, version, hash)
  constraint approvals_unique unique (draft_id, draft_version, content_hash)
);

alter table public.application_approvals enable row level security;

create policy "Owner only via application" on public.application_approvals
  for all to authenticated
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = application_approvals.application_id
        and ja.user_id = (select auth.uid())
    )
  );

create index if not exists approvals_draft_id_idx on public.application_approvals(draft_id);

-- ─── email_send_operations ────────────────────────────────────
create table if not exists public.email_send_operations (
  id                uuid primary key default gen_random_uuid(),
  approval_id       uuid not null references public.application_approvals(id),
  draft_id          uuid not null references public.application_drafts(id),
  application_id    uuid not null references public.job_applications(id) on delete cascade,
  idempotency_key   text not null,
  status            text not null default 'pending'
                      check (status in ('pending','sending','sent','failed')),
  recipient_email   text,
  gmail_message_id  text,
  sent_at           timestamptz,
  error_detail      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint send_ops_idempotency_key_unique unique (idempotency_key)
);

alter table public.email_send_operations enable row level security;

create policy "Owner only via application" on public.email_send_operations
  for all to authenticated
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = email_send_operations.application_id
        and ja.user_id = (select auth.uid())
    )
  );

create index if not exists send_ops_application_id_idx on public.email_send_operations(application_id);
create index if not exists send_ops_idempotency_key_idx on public.email_send_operations(idempotency_key);

-- ─── gmail_tokens ─────────────────────────────────────────────
-- NOTE: This table must NOT be accessible via the Data API.
-- Tokens are only accessed from the Python backend via service-role key.
create table if not exists public.gmail_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  token_data  text not null, -- JSON-encoded, stored server-side only
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint gmail_tokens_user_id_unique unique (user_id)
);

-- Completely deny frontend access to gmail_tokens
alter table public.gmail_tokens enable row level security;
-- No policies — backend accesses via service_role which bypasses RLS
-- This means no anon/authenticated role can ever read tokens

-- ─── Automatic updated_at triggers ───────────────────────────
create or replace function public.update_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger cv_documents_updated_at before update on public.cv_documents
  for each row execute function public.update_updated_at();

create trigger job_applications_updated_at before update on public.job_applications
  for each row execute function public.update_updated_at();

create trigger application_drafts_updated_at before update on public.application_drafts
  for each row execute function public.update_updated_at();

create trigger email_send_ops_updated_at before update on public.email_send_operations
  for each row execute function public.update_updated_at();

create trigger gmail_tokens_updated_at before update on public.gmail_tokens
  for each row execute function public.update_updated_at();
