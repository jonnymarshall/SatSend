-- v1.5.15 (roadmap v1.5.1.5-H) — Create account's email check: 5 an hour per connection.
--
-- POST /api/auth/signup-check reveals whether an email has an account (v1.5.14),
-- so it must not be usable to test lists of addresses. The Vercel firewall can't
-- do this on Hobby (one rate-limit rule, already used at 30/min across the public
-- invoice routes, which now include this path as an outer layer). So the server
-- counts checks itself.
--
-- client_key is an HMAC of the caller's IP made by the server (never the raw IP);
-- rows only live for the window. Counting and recording happen in one locked
-- step per key, so two quick requests can't both slip under the limit. A refused
-- attempt is not recorded, so retrying doesn't push the wait further out.
create table public.signup_check_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);

create index signup_check_attempts_key_time on public.signup_check_attempts (client_key, created_at);
create index signup_check_attempts_time on public.signup_check_attempts (created_at);

-- RLS on with no policies: no app role can read or write it; only the server
-- (service_role) and the function below touch it.
alter table public.signup_check_attempts enable row level security;
revoke all on table public.signup_check_attempts from public, anon, authenticated;

create or replace function public.take_signup_check(p_client_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('signup_check:' || p_client_key, 0));

  delete from public.signup_check_attempts
   where created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into recent
    from public.signup_check_attempts
   where client_key = p_client_key;

  if recent >= p_limit then
    return false;
  end if;

  insert into public.signup_check_attempts (client_key) values (p_client_key);
  return true;
end;
$$;

-- As 0031/0033: Supabase's default privileges grant new public functions to anon
-- and authenticated, so both are revoked by name.
revoke all on function public.take_signup_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_signup_check(text, integer, integer) to service_role;
