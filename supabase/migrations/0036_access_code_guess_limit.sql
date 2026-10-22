-- v1.5.26 (roadmap v1.5.2.12-H) — limit wrong access-code guesses:
-- 5 per 15 minutes, per connection, per invoice.
--
-- Nothing limited wrong guesses at an invoice's access code, so someone with the
-- link could keep trying. The app now asks this function before checking a code.
-- Same pattern as 0034 (sign-up check): client_key is an HMAC of the caller's IP
-- made by the server (never the raw IP); rows only live for the window; counting
-- and recording happen in one locked step per (invoice, key), so two quick
-- requests can't both slip under the limit.
--
-- Only wrong guesses are recorded. Once the limit is reached every guess is
-- refused, the right one included, until old rows age out: otherwise "refused"
-- versus "let in" would still tell a guesser which code is right.
-- Deliberately no cap per invoice across all connections (Jonny, 2026-10-22):
-- codes are at least 6 characters, and such a cap would let a stranger lock the
-- real client out.
create table public.access_code_attempts (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  client_key text not null,
  created_at timestamptz not null default now()
);

create index access_code_attempts_invoice_key_time on public.access_code_attempts (invoice_id, client_key, created_at);
create index access_code_attempts_time on public.access_code_attempts (created_at);

-- RLS on with no policies: no app role can read or write it; only the server
-- (service_role) and the function below touch it.
alter table public.access_code_attempts enable row level security;
revoke all on table public.access_code_attempts from public, anon, authenticated;

-- Returns true if this guess may be checked (and records it when p_wrong), false
-- if the connection has used up its wrong guesses for this invoice.
create or replace function public.take_access_code_guess(
  p_invoice_id uuid,
  p_client_key text,
  p_wrong boolean,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('access_code:' || p_invoice_id::text || ':' || p_client_key, 0));

  delete from public.access_code_attempts
   where created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into recent
    from public.access_code_attempts
   where invoice_id = p_invoice_id
     and client_key = p_client_key;

  if recent >= p_limit then
    return false;
  end if;

  if p_wrong then
    insert into public.access_code_attempts (invoice_id, client_key) values (p_invoice_id, p_client_key);
  end if;
  return true;
end;
$$;

-- As 0031/0033/0034: Supabase's default privileges grant new public functions to
-- anon and authenticated, so both are revoked by name.
revoke all on function public.take_access_code_guess(uuid, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.take_access_code_guess(uuid, text, boolean, integer, integer) to service_role;
