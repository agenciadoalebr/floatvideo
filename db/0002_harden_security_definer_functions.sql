-- =========================================================================
-- Migration: 0002_harden_security_definer_functions
-- Corrige achados do Supabase Security Advisor rodado após a 0001:
--   1. set_updated_at tinha search_path mutável (WARN).
--   2. is_org_member_of_project / is_org_member_of_widget são helpers
--      internos usados dentro das policies de RLS e não deveriam estar
--      expostos como RPC pública via /rest/v1/rpc/... para anon/authenticated.
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.is_org_member_of_project(uuid) from public;
revoke execute on function public.is_org_member_of_project(uuid) from anon;
revoke execute on function public.is_org_member_of_project(uuid) from authenticated;

revoke execute on function public.is_org_member_of_widget(uuid) from public;
revoke execute on function public.is_org_member_of_widget(uuid) from anon;
revoke execute on function public.is_org_member_of_widget(uuid) from authenticated;
