-- =========================================================================
-- Migration: 0004_auto_onboarding_trigger
-- Ao criar um usuário novo (signup via Supabase Auth), cria automaticamente
-- uma organização e o torna 'owner' dela — elimina a necessidade de uma
-- tela de "criar organização" no onboarding do MVP.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)) || ' — Org')
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
