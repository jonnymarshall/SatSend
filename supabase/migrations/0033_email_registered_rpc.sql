-- v1.5.14 (roadmap v1.5.1.4-H) — separate "Log in" and "Create account".
--
-- The sign-up page must tell someone who already has an account to log in
-- instead, before any email is sent. Accounts live in auth.users, which no app
-- role can read, so this security-definer function answers only "is this email
-- registered?" (unconfirmed sign-ups count: they log in to confirm).
--
-- Only the server calls it (POST /api/auth/signup-check, admin client), behind a
-- Vercel firewall rate limit of 5 an hour per IP: the answer reveals whether an
-- email has an account (accepted trade-off, see the roadmap). So EXECUTE is for
-- service_role only. Revoking from public is not enough (0031): Supabase's
-- default privileges grant new public functions to anon and authenticated, so
-- both are revoked by name.
--
-- GoTrue stores emails lower-cased, so the comparison is on the normalised input
-- and can use auth.users' email index.
create or replace function public.is_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users
     where email = lower(btrim(p_email))
       and deleted_at is null
  );
$$;

revoke all on function public.is_email_registered(text) from public, anon, authenticated;
grant execute on function public.is_email_registered(text) to service_role;
