-- v1.4.31.1-H — is_address_registered must not be executable by anon.
--
-- 0030 revoked EXECUTE from PUBLIC and granted it to authenticated, but Supabase
-- runs ALTER DEFAULT PRIVILEGES granting EXECUTE on new public functions to
-- anon (and authenticated), so the create auto-granted anon. This revokes it
-- explicitly. Caught by the v1.4.31.1-H integration harness (the mocked tests
-- could never see it).
revoke all on function public.is_address_registered(text) from public, anon;
grant execute on function public.is_address_registered(text) to authenticated;
