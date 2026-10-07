-- v1.4.31-H — cross-tenant address-uniqueness check (H-DB-3).
--
-- addressUniquenessError runs on the RLS-scoped client, so it only ever sees the
-- caller's own invoices, while the btc_address unique index is global. Result:
-- reusing an address another user holds passes every app check, then fails at the
-- insert. This security-definer function answers "is this address on any
-- non-draft invoice?" so the collision is caught at validation time.
--
-- It does NOT hide that a registered address is discoverable — that is intrinsic
-- to enforcing global uniqueness (rate limiting is the mitigation; see
-- v1.4.26.1-H). It makes the pre-check honest and the error land early.
--
-- First security-definer function in the repo: search_path is pinned (so it
-- cannot be hijacked via objects in schemas ahead of it) and execute is limited
-- to authenticated (not the open internet).
create or replace function public.is_address_registered(addr text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.invoices
     where btc_address = addr
       and status <> 'draft'
  );
$$;

revoke all on function public.is_address_registered(text) from public;
grant execute on function public.is_address_registered(text) to authenticated;
