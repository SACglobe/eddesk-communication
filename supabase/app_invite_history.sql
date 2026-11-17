-- App invitations sent from the Communication site (/invite). One row per WhatsApp message.
-- Run once in the Supabase SQL editor.
create table if not exists public.app_invite_history (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  schoolkey     text not null,
  user_id       uuid,
  sender_email  text,
  studentname   text,
  mobile        text not null,          -- 10 digits, no country code (same as report_card_history)
  classsec      text,
  message       text,
  sid           text,                   -- Twilio message SID (the status webhook looks rows up by it)
  status        text not null default 'sent',
  error_code    text,
  error_message text
);

create index if not exists app_invite_history_school_created on public.app_invite_history (schoolkey, created_at desc);
create index if not exists app_invite_history_sid on public.app_invite_history (sid);

alter table public.app_invite_history enable row level security;

-- A signed-in user sees and adds rows for their own school only (the school comes from whatsappusers).
drop policy if exists app_invite_history_select on public.app_invite_history;
create policy app_invite_history_select on public.app_invite_history for select to authenticated
using (schoolkey in (
  select w.schoolkey::text from public.whatsappusers w
  where w.authuserid::text = auth.uid()::text or lower(w.email) = lower(auth.jwt() ->> 'email')
));

drop policy if exists app_invite_history_insert on public.app_invite_history;
create policy app_invite_history_insert on public.app_invite_history for insert to authenticated
with check (schoolkey in (
  select w.schoolkey::text from public.whatsappusers w
  where w.authuserid::text = auth.uid()::text or lower(w.email) = lower(auth.jwt() ->> 'email')
));
-- Status updates come from the Twilio webhook, which uses the service role key (it bypasses these policies).
