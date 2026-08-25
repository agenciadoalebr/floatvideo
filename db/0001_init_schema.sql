-- =========================================================================
-- Migration: 0001_init_schema
-- Projeto: video-flutuante (SaaS de widget de vídeo flutuante)
-- Descrição: schema inicial completo — orgs, projetos, vídeos, widgets,
--            CTAs, leads e eventos de analytics. Inclui RLS multi-tenant.
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- organizations / membership
-- -------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_org_members_user on public.organization_members (user_id);
create index idx_org_members_org on public.organization_members (organization_id);

-- -------------------------------------------------------------------------
-- projects (um "site" onde o widget é instalado)
-- -------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  domain text,
  embed_key text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create index idx_projects_org on public.projects (organization_id);
create index idx_projects_embed_key on public.projects (embed_key);

-- -------------------------------------------------------------------------
-- videos
-- -------------------------------------------------------------------------

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_type text not null check (source_type in ('upload', 'youtube')),
  youtube_id text,
  original_file_key text,
  mp4_url text,
  webm_url text,
  thumbnail_url text,
  duration_seconds integer,
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_source_consistency check (
    (source_type = 'youtube' and youtube_id is not null)
    or (source_type = 'upload' and original_file_key is not null)
  )
);

create index idx_videos_project on public.videos (project_id);
create index idx_videos_status on public.videos (status) where status <> 'ready';

-- -------------------------------------------------------------------------
-- widgets (config visual/comportamental; referencia 1 vídeo)
-- -------------------------------------------------------------------------

create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  name text not null default 'Widget',
  shape text not null default 'round' check (shape in ('round', 'rectangular')),
  size text not null default 'md' check (size in ('sm', 'md', 'lg')),
  position text not null default 'bottom-right' check (position in ('bottom-left', 'bottom-right')),
  border_color text not null default '#000000',
  autoplay boolean not null default true,
  muted_start boolean not null default true,
  delay_seconds integer not null default 3 check (delay_seconds >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_widgets_project on public.widgets (project_id);
create index idx_widgets_video on public.widgets (video_id);

-- -------------------------------------------------------------------------
-- widget_ctas (CTA único por widget nesta versão do MVP)
-- -------------------------------------------------------------------------

create table public.widget_ctas (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets (id) on delete cascade,
  type text not null check (type in ('link', 'whatsapp', 'form')),
  label text not null,
  target_url text,
  form_fields jsonb,
  created_at timestamptz not null default now(),
  constraint widget_ctas_target_consistency check (
    (type = 'form' and form_fields is not null)
    or (type in ('link', 'whatsapp') and target_url is not null)
  )
);

create index idx_widget_ctas_widget on public.widget_ctas (widget_id);

-- -------------------------------------------------------------------------
-- leads (capturados via formulário do widget)
-- -------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  page_url text,
  created_at timestamptz not null default now()
);

create index idx_leads_widget on public.leads (widget_id);
create index idx_leads_created_at on public.leads (created_at desc);

-- -------------------------------------------------------------------------
-- widget_events (analytics: impression, play, cta_click, close, complete)
-- -------------------------------------------------------------------------

create table public.widget_events (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.widgets (id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'play', 'cta_click', 'close', 'complete')),
  page_url text,
  session_id text,
  created_at timestamptz not null default now()
);

create index idx_widget_events_widget_created on public.widget_events (widget_id, created_at desc);

-- -------------------------------------------------------------------------
-- updated_at trigger helper
-- -------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

create trigger trg_widgets_updated_at
  before update on public.widgets
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Helper: verifica se o usuário autenticado pertence à organização dona
-- de um dado project_id/widget_id (usado nas policies de RLS abaixo)
-- -------------------------------------------------------------------------

create or replace function public.is_org_member_of_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members m on m.organization_id = p.organization_id
    where p.id = p_project_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_member_of_widget(p_widget_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.widgets w
    join public.projects p on p.id = w.project_id
    join public.organization_members m on m.organization_id = p.organization_id
    where w.id = p_widget_id
      and m.user_id = auth.uid()
  );
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.videos enable row level security;
alter table public.widgets enable row level security;
alter table public.widget_ctas enable row level security;
alter table public.leads enable row level security;
alter table public.widget_events enable row level security;

-- organizations: membros veem/atualizam a própria org
create policy "org members can view their organization"
  on public.organizations for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

create policy "org owners/admins can update their organization"
  on public.organizations for update
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- qualquer usuário autenticado pode criar uma organização (vira dono via app logic)
create policy "authenticated users can create organizations"
  on public.organizations for insert
  to authenticated
  with check (true);

-- organization_members: só membros da mesma org enxergam a lista de membros
create policy "org members can view membership"
  on public.organization_members for select
  using (
    exists (
      select 1 from public.organization_members m2
      where m2.organization_id = organization_members.organization_id
        and m2.user_id = auth.uid()
    )
  );

create policy "org owners/admins can manage membership"
  on public.organization_members for all
  using (
    exists (
      select 1 from public.organization_members m2
      where m2.organization_id = organization_members.organization_id
        and m2.user_id = auth.uid()
        and m2.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m2
      where m2.organization_id = organization_members.organization_id
        and m2.user_id = auth.uid()
        and m2.role in ('owner', 'admin')
    )
  );

-- projects: CRUD restrito a membros da organização dona do projeto
create policy "org members can view projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = projects.organization_id and m.user_id = auth.uid()
    )
  );

create policy "org members can manage projects"
  on public.projects for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = projects.organization_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = projects.organization_id and m.user_id = auth.uid()
    )
  );

-- videos: restrito a membros da org dona do projeto
create policy "org members can view videos"
  on public.videos for select
  using (public.is_org_member_of_project(project_id));

create policy "org members can manage videos"
  on public.videos for all
  using (public.is_org_member_of_project(project_id))
  with check (public.is_org_member_of_project(project_id));

-- widgets: idem
create policy "org members can view widgets"
  on public.widgets for select
  using (public.is_org_member_of_project(project_id));

create policy "org members can manage widgets"
  on public.widgets for all
  using (public.is_org_member_of_project(project_id))
  with check (public.is_org_member_of_project(project_id));

-- widget_ctas
create policy "org members can view widget ctas"
  on public.widget_ctas for select
  using (public.is_org_member_of_widget(widget_id));

create policy "org members can manage widget ctas"
  on public.widget_ctas for all
  using (public.is_org_member_of_widget(widget_id))
  with check (public.is_org_member_of_widget(widget_id));

-- leads: só o dono (dashboard) lê; inserção é feita pelo endpoint público
-- via service_role (o backend valida o embed_key antes de gravar), então
-- não liberamos insert para anon/authenticated diretamente.
create policy "org members can view leads"
  on public.leads for select
  using (public.is_org_member_of_widget(widget_id));

create policy "org members can delete leads"
  on public.leads for delete
  using (public.is_org_member_of_widget(widget_id));

-- widget_events: mesma lógica — leitura só pra dono, escrita via service_role
create policy "org members can view widget events"
  on public.widget_events for select
  using (public.is_org_member_of_widget(widget_id));

-- -------------------------------------------------------------------------
-- Acesso público (embed.js no site do cliente): DELIBERADAMENTE não damos
-- ao anon nenhuma policy de select direta nas tabelas acima. Expor
-- `projects`/`widgets`/`videos` por RLS "using (true)" vazaria colunas
-- sensíveis (organization_id, domain, error_message etc.) para qualquer
-- chamada com a anon key.
--
-- Em vez disso, os três endpoints públicos do widget:
--   GET  /v1/widget-config?key=EMBED_KEY   (embed.js)
--   POST /v1/events                        (analytics)
--   POST /v1/leads                         (captura de formulário)
-- são servidos pelo backend (Next/NestJS) usando a service_role key
-- (nunca exposta ao browser), que ignora RLS por padrão no Supabase.
-- O backend valida o embed_key/widget_id manualmente antes de responder.
--
-- Para permitir isso sem expor a service_role key em lugar nenhum do
-- client, criamos uma RPC SECURITY DEFINER que devolve só o JSON
-- necessário — é essa função que o endpoint /v1/widget-config chama
-- (pode usar a anon key com segurança, pois a função controla o retorno).
-- -------------------------------------------------------------------------

create or replace function public.get_widget_config(p_embed_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_project record;
  v_widget record;
  v_video record;
  v_cta record;
  v_result jsonb;
begin
  select id into v_project
  from public.projects
  where embed_key = p_embed_key;

  if v_project is null then
    return null;
  end if;

  select w.* into v_widget
  from public.widgets w
  where w.project_id = v_project.id
    and w.is_active = true
  order by w.created_at desc
  limit 1;

  if v_widget is null then
    return null;
  end if;

  select vd.* into v_video
  from public.videos vd
  where vd.id = v_widget.video_id
    and vd.status = 'ready';

  select c.* into v_cta
  from public.widget_ctas c
  where c.widget_id = v_widget.id
  order by c.created_at desc
  limit 1;

  v_result := jsonb_build_object(
    'widget_id', v_widget.id,
    'shape', v_widget.shape,
    'size', v_widget.size,
    'position', v_widget.position,
    'border_color', v_widget.border_color,
    'autoplay', v_widget.autoplay,
    'muted_start', v_widget.muted_start,
    'delay_seconds', v_widget.delay_seconds,
    'is_active', v_widget.is_active,
    'video', case when v_video is null then null else jsonb_build_object(
      'source_type', v_video.source_type,
      'youtube_id', v_video.youtube_id,
      'mp4_url', v_video.mp4_url,
      'webm_url', v_video.webm_url,
      'thumbnail_url', v_video.thumbnail_url
    ) end,
    'cta', case when v_cta is null then null else jsonb_build_object(
      'type', v_cta.type,
      'label', v_cta.label,
      'target_url', v_cta.target_url,
      'form_fields', v_cta.form_fields
    ) end
  );

  return v_result;
end;
$$;

-- Permite que qualquer visitante do site do cliente (anon) chame só esta
-- função — nunca as tabelas diretamente.
grant execute on function public.get_widget_config(text) to anon;

-- RPC equivalente para ingestão de eventos de analytics vindos do browser
-- final (sem necessidade de autenticação), validando widget_id existente.
create or replace function public.record_widget_event(
  p_widget_id uuid,
  p_event_type text,
  p_page_url text,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.widgets where id = p_widget_id) then
    return;
  end if;

  insert into public.widget_events (widget_id, event_type, page_url, session_id)
  values (p_widget_id, p_event_type, p_page_url, p_session_id);
end;
$$;

grant execute on function public.record_widget_event(uuid, text, text, text) to anon;

-- RPC equivalente para captura de lead vinda do formulário do widget.
create or replace function public.record_widget_lead(
  p_widget_id uuid,
  p_data jsonb,
  p_page_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.widgets where id = p_widget_id) then
    return;
  end if;

  insert into public.leads (widget_id, data, page_url)
  values (p_widget_id, p_data, p_page_url);
end;
$$;

grant execute on function public.record_widget_lead(uuid, jsonb, text) to anon;
