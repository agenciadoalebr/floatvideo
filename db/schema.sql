--
-- PostgreSQL database dump
--

\restrict CtZjDtoKPSi9O8SWgdxzBu5Cf6VgEtRZUOu6XHyiphEHHFAilQdET5xdAbDb4dJ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: assinatura_bloqueia(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assinatura_bloqueia(p_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    coalesce(
      (select o.bloqueio_manual from public.organizations o
        where o.id = p_organization_id),
      false
    )
    or exists (
      select 1 from public.subscriptions s
      where s.organization_id = p_organization_id
        and (
          s.status = 'suspended'
          or (s.status = 'canceled'
              and s.current_period_end is not null
              and s.current_period_end < now())
        )
    );
$$;


--
-- Name: avisar_fim_do_teste(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.avisar_fim_do_teste() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
declare
  v_conta record;
  v_enviados int := 0;
begin
  for v_conta in
    select s.organization_id, s.trial_ends_at, s.plan,
           o.name as conta,
           p.preco_centavos,
           (select pf.email
              from public.organization_members m
              join public.profiles pf on pf.id = m.user_id
             where m.organization_id = s.organization_id and m.role = 'owner'
             order by m.created_at limit 1) as email
    from public.subscriptions s
    join public.organizations o on o.id = s.organization_id
    left join public.plans p on p.id = s.plan
    where s.status = 'trialing'
      and s.trial_ends_at is not null
      and s.trial_ends_at::date = current_date + 2
      and s.aviso_fim_teste_em is null
  loop
    perform public.enviar_email(
      v_conta.email,
      'Seu teste do FloatVideo termina em 2 dias',
      '<p>Olá!</p><p>O teste grátis da conta <strong>' ||
      coalesce(v_conta.conta, '') || '</strong> termina em <strong>' ||
      to_char(v_conta.trial_ends_at::date, 'DD/MM/YYYY') || '</strong>.</p>' ||
      '<p>A partir daí a cobrança de <strong>R$ ' ||
      public.reais(v_conta.preco_centavos) ||
      ' por mês</strong> começa a valer, por Pix, boleto ou cartão.</p>' ||
      '<p>Se o vídeo está fazendo efeito no seu site, não precisa fazer nada.</p>' ||
      public.email_botao('https://floatvideo.com.br/dashboard/conta', 'Ver minha conta') ||
      '<p style="color:#666;font-size:13px">Quer parar? Cancele pelo painel ' ||
      'antes dessa data e não haverá cobrança nenhuma.</p>'
    );

    update public.subscriptions
    set aviso_fim_teste_em = current_date
    where organization_id = v_conta.organization_id;

    v_enviados := v_enviados + 1;
  end loop;

  return v_enviados;
end;
$_$;


--
-- Name: checar_limite_de_projetos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checar_limite_de_projetos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_limite integer;
  v_atual integer;
begin
  -- A excecao da organizacao vence o plano; sem excecao, vale o plano.
  select coalesce(o.max_projects, p.max_projects) into v_limite
  from public.organizations o
  left join public.plans p on p.id = o.plan
  where o.id = new.organization_id;

  if v_limite is null then
    return new;
  end if;

  select count(*) into v_atual
  from public.projects where organization_id = new.organization_id;

  if v_atual >= v_limite then
    raise exception 'esta conta pode cadastrar % site(s)', v_limite
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;


--
-- Name: contar_eventos_do_site(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.contar_eventos_do_site(p_project_id uuid) RETURNS TABLE(video_id uuid, event_type text, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select e.video_id, e.event_type, count(*)
  from public.widget_events e
  join public.widgets w on w.id = e.widget_id
  join public.projects p on p.id = w.project_id
  where p.id = p_project_id
    -- A mesma regra de acesso das outras telas: só o que é da sua conta.
    and p.organization_id in (
      select m.organization_id
      from public.organization_members m
      where m.user_id = auth.uid()
    )
  group by e.video_id, e.event_type;
$$;


--
-- Name: convite_por_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convite_por_token(p_token text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'email', i.email,
    'papel', i.role,
    'conta', o.name,
    'aceito', i.accepted_at is not null,
    'vencido', i.expires_at < now()
  )
  from public.invites i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;


--
-- Name: criar_widget_do_projeto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.criar_widget_do_projeto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.widgets (project_id) values (new.id);
  return new;
end;
$$;


--
-- Name: definir_plano(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.definir_plano(p_org uuid, p_plano text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.e_admin_da_plataforma() then
    raise exception 'somente a administracao da plataforma altera o plano'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.plans where id = p_plano) then
    raise exception 'plano inexistente';
  end if;

  update public.organizations set plan = p_plano where id = p_org;
end;
$$;


--
-- Name: e_admin_da_plataforma(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.e_admin_da_plataforma() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;


--
-- Name: email_botao(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_botao(p_url text, p_texto text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select '<p style="margin:24px 0"><a href="' || p_url ||
         '" style="display:inline-block;padding:12px 22px;background:#007fff;' ||
         'color:#fff;border-radius:8px;text-decoration:none;font-weight:600">' ||
         p_texto || '</a></p>';
$$;


--
-- Name: email_de_assinatura(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_de_assinatura() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_email text;
  v_conta text;
  v_plano text;
  v_preco int;
  v_dias int;
  v_cobranca date;
  v_corpo text;
begin
  select pf.email into v_email
  from public.organization_members m
  join public.profiles pf on pf.id = m.user_id
  where m.organization_id = new.organization_id and m.role = 'owner'
  order by m.created_at limit 1;

  select o.name into v_conta
  from public.organizations o where o.id = new.organization_id;

  select p.nome, p.preco_centavos into v_plano, v_preco
  from public.plans p where p.id = new.plan;

  v_cobranca := coalesce(new.trial_ends_at::date, current_date);
  v_dias := greatest(0, v_cobranca - current_date);

  v_corpo :=
    '<p>Olá!</p>' ||
    '<p>Sua assinatura do FloatVideo está criada para a conta <strong>' ||
    coalesce(v_conta, '') || '</strong>.</p>' ||
    '<table style="border-collapse:collapse;margin:20px 0">' ||
    '<tr><td style="padding:4px 16px 4px 0;color:#666">Plano</td><td><strong>' ||
    coalesce(v_plano, new.plan) || '</strong></td></tr>' ||
    '<tr><td style="padding:4px 16px 4px 0;color:#666">Valor</td><td><strong>R$ ' ||
    public.reais(v_preco) || ' por mês</strong></td></tr>' ||
    case when v_dias > 0 then
      '<tr><td style="padding:4px 16px 4px 0;color:#666">Teste grátis</td><td><strong>' ||
      v_dias || ' dias</strong></td></tr>'
    else '' end ||
    '<tr><td style="padding:4px 16px 4px 0;color:#666">Primeira cobrança</td><td><strong>' ||
    to_char(v_cobranca, 'DD/MM/YYYY') || '</strong></td></tr>' ||
    '</table>' ||
    case when v_dias > 0 then
      '<p>Até lá o acesso é completo. Se você cancelar antes de ' ||
      to_char(v_cobranca, 'DD/MM/YYYY') || ', <strong>não pagará nada</strong>.</p>'
    else
      '<p>Seu acesso já está liberado.</p>'
    end ||
    public.email_botao('https://floatvideo.com.br/dashboard', 'Ir para o painel') ||
    '<p style="color:#666;font-size:13px">Para cancelar, é no próprio painel, ' ||
    'em Minha conta — sem multa e sem precisar falar com ninguém.</p>';

  perform public.enviar_email(
    v_email,
    'Sua assinatura do FloatVideo está criada',
    v_corpo
  );

  return new;
end;
$_$;


--
-- Name: email_de_convite(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_de_convite() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_conta text;
  v_quem text;
begin
  select o.name into v_conta
  from public.organizations o where o.id = new.organization_id;

  select pf.email into v_quem
  from public.profiles pf where pf.id = new.invited_by;

  perform public.enviar_email(
    new.email,
    coalesce(v_conta, 'Alguém') || ' convidou você para o FloatVideo',
    '<p>Olá!</p><p>' ||
    case when v_quem is null then 'Você foi convidado'
         else '<strong>' || v_quem || '</strong> convidou você' end ||
    ' para trabalhar na conta <strong>' || coalesce(v_conta, '') ||
    '</strong> no FloatVideo.</p>' ||
    '<p>Clique no botão abaixo para escolher a sua senha. ' ||
    'Depois disso você já entra direto no painel.</p>' ||
    public.email_botao(
      'https://floatvideo.com.br/convite/' || new.token,
      'Criar minha senha'
    ) ||
    '<p style="color:#666;font-size:13px">O link vale por 7 dias. ' ||
    'Se você não esperava este convite, é só ignorar este e-mail.</p>'
  );

  return new;
end;
$$;


--
-- Name: email_de_equipe(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_de_equipe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text;
  v_conta text;
begin
  select pf.email into v_email
  from public.profiles pf where pf.id = new.user_id;

  select o.name into v_conta
  from public.organizations o where o.id = new.organization_id;

  perform public.enviar_email(
    v_email,
    'Você entrou no FloatVideo',
    '<p>Olá!</p><p>Você agora faz parte da conta <strong>' ||
    coalesce(v_conta, '') || '</strong> no FloatVideo, onde pode subir ' ||
    'vídeos, configurar o balão e acompanhar os leads.</p>' ||
    public.email_botao('https://floatvideo.com.br/dashboard', 'Abrir o painel') ||
    '<p style="color:#666;font-size:13px">Nada de cobrança para você: ' ||
    'a assinatura é de quem administra a conta.</p>'
  );

  return new;
end;
$$;


--
-- Name: enviar_email(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enviar_email(p_para text, p_assunto text, p_html text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_resend text;
  v_remetente text;
begin
  if coalesce(trim(p_para), '') = '' then
    return;
  end if;

  select decrypted_secret into v_resend
  from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;

  if v_resend is null then
    return;
  end if;

  select remetente into v_remetente from public.cobranca_config where id;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_resend
    ),
    body := jsonb_build_object(
      'from', coalesce(v_remetente, 'FloatVideo <cobranca@floatvideo.com.br>'),
      'to', jsonb_build_array(p_para),
      'subject', p_assunto,
      'html',
        '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;' ||
        'font-size:15px;line-height:1.6;color:#1a1a2e;max-width:560px">' ||
        p_html ||
        '<hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">' ||
        '<p style="color:#888;font-size:12px">FloatVideo — vídeo flutuante ' ||
        'que vende no seu site.<br>' ||
        '<a href="https://floatvideo.com.br" style="color:#888">floatvideo.com.br</a>' ||
        '</p></div>'
    )
  );
end;
$$;


--
-- Name: forcar_papel_editor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forcar_papel_editor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.e_admin_da_plataforma() then
    new.role := 'editor';
  end if;
  return new;
end;
$$;


--
-- Name: gerar_invite_codes(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_invite_codes(p_quantidade integer, p_lote text) RETURNS SETOF text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_codigo text;
  i int;
begin
  if not public.e_admin_da_plataforma() then
    raise exception 'apenas administradores da plataforma podem gerar convites';
  end if;

  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 500 then
    raise exception 'quantidade deve estar entre 1 e 500';
  end if;

  for i in 1..p_quantidade loop
    loop
      v_codigo := 'FV-' ||
        upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4)) || '-' ||
        upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4));
      exit when not exists (select 1 from public.invite_codes where code = v_codigo);
    end loop;

    insert into public.invite_codes (code, batch, created_by)
    values (v_codigo, coalesce(nullif(trim(p_lote), ''), 'Sem nome'), auth.uid());

    return next v_codigo;
  end loop;
end;
$$;


--
-- Name: get_widget_config(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_widget_config(p_embed_key text, p_origin text DEFAULT NULL::text, p_page_url text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_project record;
  v_widget record;
  v_video record;
  v_cta record;
  v_host text;
  v_domain text;
  v_video_id uuid;
  v_exibir_marca boolean;
begin
  select p.id, p.name, p.domain, p.organization_id into v_project
  from public.projects p
  where p.embed_key = p_embed_key;

  if v_project is null then
    return null;
  end if;

  if public.assinatura_bloqueia(v_project.organization_id) then
    return null;
  end if;

  select o.exibir_marca into v_exibir_marca
  from public.organizations o
  where o.id = v_project.organization_id;

  v_domain := nullif(trim(v_project.domain), '');
  if v_domain is not null then
    v_domain := regexp_replace(lower(v_domain), '^www\.', '');
    v_host := lower(coalesce(p_origin, ''));
    v_host := regexp_replace(v_host, '^[a-z]+://', '');
    v_host := split_part(v_host, '/', 1);
    v_host := split_part(v_host, ':', 1);
    v_host := regexp_replace(v_host, '^www\.', '');

    if v_host is null or v_host = '' then
      return null;
    end if;

    if not (v_host = v_domain or v_host like '%.' || v_domain) then
      return null;
    end if;
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

  v_video_id := public.resolve_widget_video(v_widget.id, p_page_url);

  select vd.* into v_video
  from public.videos vd
  where vd.id = v_video_id
    and vd.status = 'ready';

  select c.* into v_cta
  from public.widget_ctas c
  where c.widget_id = v_widget.id
  order by c.created_at desc
  limit 1;

  return jsonb_build_object(
    'widget_id', v_widget.id,
    'project_name', v_project.name,
    'shape', v_widget.shape,
    'size', v_widget.size,
    'position', v_widget.position,
    'border_color', v_widget.border_color,
    'cta_color', v_widget.cta_color,
    'offset_x', v_widget.offset_x,
    'offset_y', v_widget.offset_y,
    'mobile', jsonb_build_object(
      'size', v_widget.mobile_size,
      'position', v_widget.mobile_position,
      'offset_x', v_widget.mobile_offset_x,
      'offset_y', v_widget.mobile_offset_y
    ),
    'autoplay', v_widget.autoplay,
    'muted_start', v_widget.muted_start,
    'delay_seconds', v_widget.delay_seconds,
    'trigger_mode', v_widget.trigger_mode,
    'trigger_scroll', v_widget.trigger_scroll,
    'reappear_hours', v_widget.reappear_hours,
    'analytics_mode', v_widget.analytics_mode,
    'conversoes_otimizadas', v_widget.conversoes_otimizadas,
    'is_active', v_widget.is_active,
    'exibir_marca', coalesce(v_exibir_marca, true),
    'video', case when v_video is null then null else jsonb_build_object(
      'id', v_video.id,
      'source_type', v_video.source_type,
      'youtube_id', v_video.youtube_id,
      'mp4_url', v_video.mp4_url,
      'webm_url', v_video.webm_url,
      'preview_url', v_video.preview_url,
      'thumbnail_url', v_video.thumbnail_url,
      'focal_x', v_video.focal_x,
      'focal_y', v_video.focal_y
    ) end,
    'cta', case when v_cta is null then null else jsonb_build_object(
      'type', v_cta.type,
      'label', v_cta.label,
      'sublabel', v_cta.sublabel,
      'button_style', v_cta.button_style,
      'target_url', v_cta.target_url,
      'form_fields', v_cta.form_fields,
      'buy_platform', v_cta.buy_platform,
      'buy_selector', v_cta.buy_selector
    ) end
  );
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_invite record;
  v_codigo text;
  v_usados int;
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  select * into v_invite
  from public.invites
  where id = nullif(new.raw_user_meta_data->>'invite_id', '')::uuid
    and accepted_at is null;

  if v_invite.id is null then
    select * into v_invite
    from public.invites
    where email = lower(new.email) and accepted_at is null
    order by created_at desc
    limit 1;
  end if;

  if v_invite.id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_invite.organization_id, new.id, v_invite.role);

    update public.invites set accepted_at = now() where id = v_invite.id;
    return new;
  end if;

  if not exists (select 1 from public.organizations) then
    insert into public.organizations (name)
    values (coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)) || ' — Org')
    returning id into v_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, new.id, 'owner');
    return new;
  end if;

  v_codigo := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));

  if v_codigo = '' then
    return new;
  end if;

  update public.invite_codes
  set used_by = new.id, used_email = new.email, used_at = now()
  where code = v_codigo and used_at is null;

  get diagnostics v_usados = row_count;

  if v_usados = 0 then
    raise exception 'codigo de convite invalido ou ja utilizado'
      using errcode = 'check_violation';
  end if;

  insert into public.organizations (name)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)))
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;


--
-- Name: has_pending_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_pending_invite(p_email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.invites
    where email = lower(p_email) and accepted_at is null
  );
$$;


--
-- Name: impedir_troca_de_papel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.impedir_troca_de_papel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.role is distinct from old.role and not public.e_admin_da_plataforma() then
    raise exception 'somente a administracao da plataforma muda o papel de um usuario'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;


--
-- Name: impedir_troca_de_plano(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.impedir_troca_de_plano() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if public.e_admin_da_plataforma() then
    return new;
  end if;

  if new.plan is distinct from old.plan
     or new.max_projects is distinct from old.max_projects then
    raise exception 'somente a administracao da plataforma altera o plano'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;


--
-- Name: invite_code_disponivel(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_code_disponivel(p_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.invite_codes
    where code = upper(trim(coalesce(p_code, '')))
      and used_at is null
  )
$$;


--
-- Name: is_member_of_org(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member_of_org(p_organization_id uuid, p_roles text[] DEFAULT NULL::text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any(p_roles))
  );
$$;


--
-- Name: is_org_member_of_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member_of_project(p_project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members m on m.organization_id = p.organization_id
    where p.id = p_project_id
      and m.user_id = auth.uid()
  );
$$;


--
-- Name: is_org_member_of_widget(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member_of_widget(p_widget_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.widgets w
    join public.projects p on p.id = w.project_id
    join public.organization_members m on m.organization_id = p.organization_id
    where w.id = p_widget_id
      and m.user_id = auth.uid()
  );
$$;


--
-- Name: listar_contas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_contas() RETURNS TABLE(id uuid, nome text, plano text, plano_nome text, excecao_sites integer, limite_sites integer, sites bigint, pessoas bigint, dono text, criada_em timestamp with time zone, situacao text, titular text, cpf_cnpj text, vence_em timestamp with time zone, atrasada_desde timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    o.id,
    o.name,
    o.plan,
    p.nome,
    o.max_projects,
    coalesce(o.max_projects, p.max_projects),
    (select count(*) from public.projects pr where pr.organization_id = o.id),
    (select count(*) from public.organization_members m where m.organization_id = o.id),
    (select pf.email
       from public.organization_members m
       join public.profiles pf on pf.id = m.user_id
      where m.organization_id = o.id and m.role = 'owner'
      order by m.created_at limit 1),
    o.created_at,
    -- Sem assinatura é situação de verdade, não ausência de dado: são as
    -- contas internas e as cortesias, que não passam pelo Asaas.
    coalesce(s.status, 'sem_assinatura'),
    s.titular,
    s.cpf_cnpj,
    -- No teste a data que importa é o fim do teste; depois, a do período.
    case when s.status = 'trialing' then s.trial_ends_at else s.current_period_end end,
    s.overdue_since
  from public.organizations o
  join public.plans p on p.id = o.plan
  left join public.subscriptions s on s.organization_id = o.id
  where public.e_admin_da_plataforma()
  order by o.created_at desc;
$$;


--
-- Name: metricas_do_site(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metricas_do_site(p_project_id uuid, p_dias integer DEFAULT 30, p_video_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_dias int := greatest(1, least(coalesce(p_dias, 30), 365));
  v_inicio timestamptz := now() - (v_dias || ' days')::interval;
  v_inicio_anterior timestamptz := now() - (v_dias * 2 || ' days')::interval;
  v_widgets uuid[];
  v_totais jsonb;
  v_anterior jsonb;
  v_paginas jsonb;
  v_leads int;
  v_leads_antes int;
begin
  -- A mesma regra de acesso das outras telas: só o que é da sua conta.
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.organization_id in (
        select m.organization_id from public.organization_members m
        where m.user_id = auth.uid()
      )
  ) then
    return null;
  end if;

  -- Video de outro site nao serve: sem esta checagem, quem tem acesso a
  -- um projeto conseguiria ler os numeros de um video alheio passando o
  -- id na chamada.
  if p_video_id is not null and not exists (
    select 1 from public.videos v
    where v.id = p_video_id and v.project_id = p_project_id
  ) then
    return null;
  end if;

  select array_agg(w.id) into v_widgets
  from public.widgets w where w.project_id = p_project_id;

  if v_widgets is null then
    return jsonb_build_object('totais', '{}'::jsonb, 'anterior', '{}'::jsonb,
                              'paginas', '[]'::jsonb, 'leads', 0, 'leads_anterior', 0,
                              'dias', v_dias);
  end if;

  select coalesce(jsonb_object_agg(t.event_type, t.n), '{}'::jsonb) into v_totais
  from (
    select e.event_type, count(*) as n
    from public.widget_events e
    where e.widget_id = any(v_widgets) and e.created_at >= v_inicio
      and (p_video_id is null or e.video_id = p_video_id)
    group by e.event_type
  ) t;

  select coalesce(jsonb_object_agg(t.event_type, t.n), '{}'::jsonb) into v_anterior
  from (
    select e.event_type, count(*) as n
    from public.widget_events e
    where e.widget_id = any(v_widgets)
      and e.created_at >= v_inicio_anterior and e.created_at < v_inicio
      and (p_video_id is null or e.video_id = p_video_id)
    group by e.event_type
  ) t;

  select count(*) into v_leads from public.leads l
  where l.widget_id = any(v_widgets) and l.created_at >= v_inicio
    and (p_video_id is null or l.video_id = p_video_id);

  select count(*) into v_leads_antes from public.leads l
  where l.widget_id = any(v_widgets)
    and l.created_at >= v_inicio_anterior and l.created_at < v_inicio
    and (p_video_id is null or l.video_id = p_video_id);

  -- Páginas: a URL sem o protocolo e sem a query, senão a mesma página
  -- com utm diferente vira dez linhas distintas na tabela.
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_paginas
  from (
    select jsonb_build_object(
      'pagina', pagina,
      'impressoes', impressoes,
      'aberturas', aberturas,
      'cliques', cliques
    ) as x
    from (
      select
        regexp_replace(split_part(split_part(e.page_url, '#', 1), '?', 1),
                       '^[a-z]+://', '') as pagina,
        count(*) filter (where e.event_type = 'impression') as impressoes,
        count(*) filter (where e.event_type = 'expand') as aberturas,
        count(*) filter (where e.event_type = 'cta_click') as cliques
      from public.widget_events e
      where e.widget_id = any(v_widgets)
        and e.created_at >= v_inicio
        and coalesce(e.page_url, '') <> ''
        and (p_video_id is null or e.video_id = p_video_id)
      group by 1
      order by impressoes desc
      limit 20
    ) p
  ) y;

  return jsonb_build_object(
    'dias', v_dias,
    'totais', v_totais,
    'anterior', v_anterior,
    'leads', v_leads,
    'leads_anterior', v_leads_antes,
    'paginas', v_paginas,
    'video_id', p_video_id
  );
end;
$$;


--
-- Name: needs_initial_setup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.needs_initial_setup() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select not exists (select 1 from public.organizations);
$$;


--
-- Name: normalizar_padrao_url(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalizar_padrao_url(p_padrao text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               split_part(split_part(lower(trim(coalesce(p_padrao, ''))), '#', 1), '?', 1),
               '^[a-z]+://', ''),
             '^www\.', ''),
           '/$', '')
$_$;


--
-- Name: notify_new_lead(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_lead() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_widget record;
  v_tipo_cta text;
  v_video text;
  v_corpo jsonb;
  v_resend text;
  v_linhas text := '';
  v_chave text;
  v_valor text;
begin
  select w.*, p.name as projeto_nome, p.domain as projeto_dominio
    into v_widget
  from public.widgets w
  join public.projects p on p.id = w.project_id
  where w.id = new.widget_id;

  if v_widget is null then
    return new;
  end if;

  select c.type into v_tipo_cta
  from public.widget_ctas c
  where c.widget_id = v_widget.id
  order by c.created_at desc
  limit 1;

  -- So formulario avisa.
  if v_tipo_cta is null or v_tipo_cta not in ('form', 'whatsapp_form') then
    return new;
  end if;

  select coalesce(v.name, 'video') into v_video
  from public.videos v where v.id = new.video_id;

  v_corpo := jsonb_build_object(
    'evento', 'lead.novo',
    'lead_id', new.id,
    'criado_em', new.created_at,
    'projeto', v_widget.projeto_nome,
    'dominio', v_widget.projeto_dominio,
    'video', v_video,
    'pagina', new.page_url,
    'dados', new.data
  );

  if nullif(trim(coalesce(v_widget.notify_webhook_url, '')), '') is not null then
    perform net.http_post(
      url := v_widget.notify_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := v_corpo
    );
  end if;

  if nullif(trim(coalesce(v_widget.notify_email, '')), '') is not null then
    select decrypted_secret into v_resend
    from vault.decrypted_secrets
    where name = 'RESEND_API_KEY'
    limit 1;

    if v_resend is not null then
      for v_chave, v_valor in
        select key, value from jsonb_each_text(new.data)
      loop
        v_linhas := v_linhas || '<p><strong>' || v_chave || ':</strong> ' || v_valor || '</p>';
      end loop;

      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_resend
        ),
        body := jsonb_build_object(
          'from', 'FloatVideo <leads@floatvideo.com.br>',
          'to', jsonb_build_array(v_widget.notify_email),
          'subject', 'Novo lead — ' || v_widget.projeto_nome,
          'html',
            '<h2>Novo lead em ' || v_widget.projeto_nome || '</h2>' ||
            v_linhas ||
            '<p style="color:#666">Página: ' || coalesce(new.page_url, '-') || '<br>' ||
            'Vídeo: ' || coalesce(v_video, '-') || '</p>'
        )
      );
    end if;
  end if;

  return new;
exception when others then
  -- Notificacao nunca pode derrubar a gravacao do lead.
  return new;
end;
$$;


--
-- Name: processar_cobrancas_atrasadas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_cobrancas_atrasadas() RETURNS TABLE(avisados integer, bloqueados integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_tolerancia int;
  v_remetente text;
  v_resend text;
  v_conta record;
  v_dias int;
  v_avisados int := 0;
  v_bloqueados int := 0;
  v_assunto text;
  v_corpo text;
  v_botao text;
begin
  select dias_de_tolerancia, remetente into v_tolerancia, v_remetente
  from public.cobranca_config where id;

  select decrypted_secret into v_resend
  from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;

  for v_conta in
    select s.organization_id, s.overdue_since, s.invoice_url, s.status,
           o.name as conta,
           (select pf.email
              from public.organization_members m
              join public.profiles pf on pf.id = m.user_id
             where m.organization_id = s.organization_id and m.role = 'owner'
             order by m.created_at limit 1) as email
    from public.subscriptions s
    join public.organizations o on o.id = s.organization_id
    where s.status in ('overdue', 'suspended')
      and s.overdue_since is not null
      and (s.ultimo_aviso_em is null or s.ultimo_aviso_em < current_date)
  loop
    v_dias := (current_date - v_conta.overdue_since::date);

    -- Passou da tolerância: bloqueia e avisa uma vez.
    if v_dias > v_tolerancia then
      if v_conta.status <> 'suspended' then
        update public.subscriptions
        set status = 'suspended', updated_at = now()
        where organization_id = v_conta.organization_id;

        v_bloqueados := v_bloqueados + 1;

        v_assunto := 'Seu FloatVideo foi pausado';
        v_corpo :=
          '<p>Olá!</p><p>O pagamento do FloatVideo da conta <strong>' ||
          coalesce(v_conta.conta, '') ||
          '</strong> segue em aberto há mais de ' || v_tolerancia ||
          ' dias, e o vídeo deixou de aparecer no seu site.</p>' ||
          '<p><strong>Nada foi apagado.</strong> Assim que o pagamento for ' ||
          'confirmado, tudo volta no mesmo lugar — vídeos, métricas e leads.</p>';
      else
        -- Já bloqueado: segue avisando, sem repetir a contagem.
        v_assunto := 'Pagamento em aberto — seu FloatVideo está pausado';
        v_corpo :=
          '<p>Olá!</p><p>O FloatVideo da conta <strong>' ||
          coalesce(v_conta.conta, '') ||
          '</strong> continua pausado por pagamento em aberto.</p>';
      end if;
    else
      v_assunto := 'Pagamento do FloatVideo em aberto';
      v_corpo :=
        '<p>Olá!</p><p>Não identificamos o pagamento do FloatVideo da conta <strong>' ||
        coalesce(v_conta.conta, '') || '</strong>.</p>' ||
        '<p>O vídeo continua no ar. Você tem até <strong>' ||
        to_char(v_conta.overdue_since::date + v_tolerancia, 'DD/MM/YYYY') ||
        '</strong> para regularizar; depois disso ele é pausado.</p>';
      v_avisados := v_avisados + 1;
    end if;

    v_botao := case
      when nullif(v_conta.invoice_url, '') is not null then
        '<p><a href="' || v_conta.invoice_url ||
        '" style="display:inline-block;padding:12px 20px;background:#007fff;' ||
        'color:#fff;border-radius:8px;text-decoration:none;font-weight:600">' ||
        'Pagar agora (Pix, boleto ou cartão)</a></p>'
      else
        '<p>Acesse o painel em https://floatvideo.com.br para regularizar.</p>'
    end;

    if v_resend is not null and v_conta.email is not null then
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_resend
        ),
        body := jsonb_build_object(
          'from', v_remetente,
          'to', jsonb_build_array(v_conta.email),
          'subject', v_assunto,
          'html', v_corpo || v_botao ||
            '<p style="color:#666;font-size:12px">Se você já pagou, pode ignorar: ' ||
            'a confirmação costuma levar alguns minutos.</p>'
        )
      );
    end if;

    update public.subscriptions
    set ultimo_aviso_em = current_date
    where organization_id = v_conta.organization_id;
  end loop;

  return query select v_avisados, v_bloqueados;
end;
$$;


--
-- Name: reais(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reais(p_centavos integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select to_char(coalesce(p_centavos, 0) / 100, 'FM999G999')
         || ',' || lpad((coalesce(p_centavos, 0) % 100)::text, 2, '0');
$$;


--
-- Name: record_widget_event(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_widget_event(p_widget_id uuid, p_event_type text, p_page_url text, p_session_id text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_video_id uuid;
begin
  if not exists (select 1 from public.widgets where id = p_widget_id) then
    return;
  end if;

  v_video_id := public.resolve_widget_video(p_widget_id, p_page_url);

  insert into public.widget_events (widget_id, event_type, page_url, session_id, video_id)
  values (p_widget_id, p_event_type, p_page_url, p_session_id, v_video_id);
end;
$$;


--
-- Name: record_widget_lead(uuid, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_widget_lead(p_widget_id uuid, p_data jsonb, p_page_url text, p_session_id text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_recent_count int;
  v_video_id uuid;
begin
  if not exists (select 1 from public.widgets where id = p_widget_id) then
    return;
  end if;

  if p_session_id is not null then
    select count(*) into v_recent_count
    from public.leads
    where widget_id = p_widget_id
      and session_id = p_session_id
      and created_at > now() - interval '24 hours';

    if v_recent_count >= 3 then
      return;
    end if;
  end if;

  v_video_id := public.resolve_widget_video(p_widget_id, p_page_url);

  insert into public.leads (widget_id, data, page_url, session_id, video_id)
  values (p_widget_id, p_data, p_page_url, p_session_id, v_video_id);
end;
$$;


--
-- Name: resolve_widget_video(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_widget_video(p_widget_id uuid, p_page_url text) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_url text;
  v_video uuid;
begin
  v_url := lower(coalesce(p_page_url, ''));
  v_url := regexp_replace(v_url, '^[a-z]+://', '');
  v_url := regexp_replace(v_url, '^www\.', '');
  v_url := split_part(v_url, '#', 1);
  v_url := split_part(v_url, '?', 1);
  v_url := regexp_replace(v_url, '/$', '');

  -- 1) Regra exata vence sempre.
  if v_url <> '' then
    select r.video_id into v_video
    from public.widget_page_rules r
    join public.videos v on v.id = r.video_id and v.status = 'ready' and v.ativo
    where r.widget_id = p_widget_id
      and r.match_type = 'exact'
      and public.normalizar_padrao_url(r.pattern) = v_url
      and not public.video_excluido_na_pagina(r.video_id, v_url)
    limit 1;

    if v_video is not null then
      return v_video;
    end if;

    -- 2) Entre as "contem", vence o padrao mais longo — o mais
    -- especifico. strpos e nao LIKE, pra "%" digitado valer como texto.
    select r.video_id into v_video
    from public.widget_page_rules r
    join public.videos v on v.id = r.video_id and v.status = 'ready' and v.ativo
    where r.widget_id = p_widget_id
      and r.match_type = 'contains'
      and public.normalizar_padrao_url(r.pattern) <> ''
      and strpos(v_url, public.normalizar_padrao_url(r.pattern)) > 0
      and not public.video_excluido_na_pagina(r.video_id, v_url)
    order by length(public.normalizar_padrao_url(r.pattern)) desc
    limit 1;

    if v_video is not null then
      return v_video;
    end if;
  end if;

  -- 3) "Todas as paginas" e a menos especifica: so vale se nenhuma regra
  -- de pagina especifica serviu. Um video que so tem excecoes entra aqui
  -- tambem: quem escreve apenas "nao contem /checkout" quer dizer "em
  -- todo lugar, menos ali".
  select r.video_id into v_video
  from public.widget_page_rules r
  join public.videos v on v.id = r.video_id and v.status = 'ready' and v.ativo
  where r.widget_id = p_widget_id
    and (
      r.match_type = 'all'
      or (
        r.match_type = 'not_contains'
        and not exists (
          select 1 from public.widget_page_rules o
          where o.video_id = r.video_id
            and o.match_type in ('exact', 'contains')
        )
      )
    )
    and not public.video_excluido_na_pagina(r.video_id, v_url)
  order by v.created_at desc
  limit 1;

  -- Sem regra nenhuma servindo, o widget nao aparece nesta pagina.
  return v_video;
end;
$_$;


--
-- Name: resumo_dos_sites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resumo_dos_sites() RETURNS TABLE(id uuid, nome text, dominio text, criado_em timestamp with time zone, videos bigint, videos_prontos bigint, widget_ativo boolean, video_principal text, miniatura text, impressoes bigint, cliques_cta bigint, leads bigint, ultima_atividade timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with meus as (
    select p.*
    from public.projects p
    where p.organization_id in (
      select m.organization_id
      from public.organization_members m
      where m.user_id = auth.uid()
    )
  ),
  w as (
    select distinct on (wd.project_id)
      wd.project_id, wd.id, wd.is_active
    from public.widgets wd
    join meus on meus.id = wd.project_id
    order by wd.project_id, wd.is_active desc, wd.created_at desc
  ),
  -- O vídeo que representa o site no cartão é o mais recente que está
  -- pronto: é o que a pessoa acabou de mexer, e o que ela espera ver.
  v as (
    select distinct on (vd.project_id)
      vd.project_id, vd.name, vd.thumbnail_url
    from public.videos vd
    join meus on meus.id = vd.project_id
    where vd.status = 'ready'
    order by vd.project_id, vd.created_at desc
  ),
  -- Trinta dias: período curto o bastante para o número responder ao que
  -- a pessoa mudou ontem, e longo o bastante para não zerar num fim de
  -- semana parado.
  ev as (
    select w.project_id,
      count(*) filter (where e.event_type = 'impression') as impressoes,
      count(*) filter (where e.event_type = 'cta_click') as cliques,
      max(e.created_at) as ultimo
    from public.widget_events e
    join w on w.id = e.widget_id
    where e.created_at > now() - interval '30 days'
    group by w.project_id
  ),
  ld as (
    select w.project_id, count(*) as total, max(l.created_at) as ultimo
    from public.leads l
    join w on w.id = l.widget_id
    where l.created_at > now() - interval '30 days'
    group by w.project_id
  )
  select
    meus.id,
    meus.name,
    meus.domain,
    meus.created_at,
    (select count(*) from public.videos x where x.project_id = meus.id),
    (select count(*) from public.videos x where x.project_id = meus.id and x.status = 'ready'),
    -- "Ativo" quer dizer que há widget ligado E vídeo pronto para servir.
    -- Widget ligado sem vídeo não mostra nada no site do cliente, e
    -- chamar isso de ativo seria mentir na cara dele.
    coalesce(w.is_active, false)
      and exists (
        select 1 from public.videos x
        where x.project_id = meus.id and x.status = 'ready'
      ),
    v.name,
    v.thumbnail_url,
    coalesce(ev.impressoes, 0),
    coalesce(ev.cliques, 0),
    coalesce(ld.total, 0),
    greatest(ev.ultimo, ld.ultimo)
  from meus
  left join w on w.project_id = meus.id
  left join v on v.project_id = meus.id
  left join ev on ev.project_id = meus.id
  left join ld on ld.project_id = meus.id
  order by meus.created_at desc;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: usar_codigo_de_convite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.usar_codigo_de_convite(p_code text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_nome text;
  v_invite record;
  v_codigo text;
  v_usados int;
  v_org_id uuid;
begin
  if v_user is null then
    raise exception 'e preciso estar autenticado';
  end if;

  -- Já tem conta: não faz nada e não gasta o código de ninguém.
  if exists (select 1 from public.organization_members where user_id = v_user) then
    return 'ja_tinha_conta';
  end if;

  select u.email, coalesce(
           nullif(trim(u.raw_user_meta_data->>'name'), ''),
           nullif(trim(u.raw_user_meta_data->>'full_name'), '')
         )
    into v_email, v_nome
  from auth.users u where u.id = v_user;

  -- Convite por e-mail tem precedência: quem foi chamado para a conta de
  -- outra pessoa entra nela, e não abre uma conta própria.
  select * into v_invite
  from public.invites
  where email = lower(v_email) and accepted_at is null
  order by created_at desc
  limit 1;

  if v_invite.id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_invite.organization_id, v_user, v_invite.role);
    update public.invites set accepted_at = now() where id = v_invite.id;
    return 'entrou_por_convite';
  end if;

  v_codigo := upper(trim(coalesce(p_code, '')));

  if v_codigo = '' then
    raise exception 'e preciso um codigo de convite'
      using errcode = 'check_violation';
  end if;

  update public.invite_codes
  set used_by = v_user, used_email = v_email, used_at = now()
  where code = v_codigo and used_at is null;

  get diagnostics v_usados = row_count;

  if v_usados = 0 then
    raise exception 'codigo de convite invalido ou ja utilizado'
      using errcode = 'check_violation';
  end if;

  insert into public.organizations (name)
  values (coalesce(v_nome, split_part(v_email, '@', 1)))
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user, 'owner');

  return 'conta_criada';
end;
$$;


--
-- Name: video_excluido_na_pagina(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.video_excluido_na_pagina(p_video_id uuid, p_url_normalizada text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.widget_page_rules r
    where r.video_id = p_video_id
      and r.match_type = 'not_contains'
      and public.normalizar_padrao_url(r.pattern) <> ''
      and strpos(coalesce(p_url_normalizada, ''), public.normalizar_padrao_url(r.pattern)) > 0
  )
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ator uuid,
    ator_email text NOT NULL,
    acao text NOT NULL,
    organization_id uuid,
    conta_nome text,
    detalhe text,
    ip text,
    navegador text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arquivos_do_celular; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arquivos_do_celular (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sessao_id uuid NOT NULL,
    nome text NOT NULL,
    chave text NOT NULL,
    url text NOT NULL,
    tamanho bigint,
    tipo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE arquivos_do_celular; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.arquivos_do_celular IS 'Arquivos que chegaram pelo celular e ainda esperam virar video no painel.';


--
-- Name: cobranca_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cobranca_config (
    id boolean DEFAULT true NOT NULL,
    dias_de_tolerancia integer DEFAULT 5 NOT NULL,
    remetente text DEFAULT 'FloatVideo <cobranca@floatvideo.com.br>'::text NOT NULL,
    CONSTRAINT cobranca_config_id_check CHECK (id)
);


--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    batch text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_by uuid,
    used_email text,
    used_at timestamp with time zone
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    CONSTRAINT invites_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    widget_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    page_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id text,
    video_id uuid
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    plan text DEFAULT 'essencial'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    max_projects integer DEFAULT 1,
    observacoes_internas text,
    bloqueio_manual boolean DEFAULT false NOT NULL,
    exibir_marca boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN organizations.max_projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.max_projects IS 'Exceção negociada. Nulo = vale o limite do plano.';


--
-- Name: COLUMN organizations.observacoes_internas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.observacoes_internas IS 'Anotacoes da equipe sobre a conta. Nunca aparece para o cliente.';


--
-- Name: COLUMN organizations.bloqueio_manual; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.bloqueio_manual IS 'Corte de acesso decidido pela administracao, independente do pagamento.';


--
-- Name: COLUMN organizations.exibir_marca; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.exibir_marca IS 'Mostra a assinatura Float Video no video aberto. Desligado caso a caso pela administracao.';


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id text NOT NULL,
    nome text NOT NULL,
    preco_centavos integer DEFAULT 0 NOT NULL,
    max_projects integer,
    max_videos integer,
    max_views integer,
    descricao text,
    publico boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_dias integer DEFAULT 0 NOT NULL,
    trial_dias_convite integer DEFAULT 30 NOT NULL
);


--
-- Name: COLUMN plans.trial_dias_convite; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plans.trial_dias_convite IS 'Dias de teste para quem chega com codigo de convite. O trial_dias vale para quem chega sozinho.';


--
-- Name: platform_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admins (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    domain text,
    embed_key text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessoes_de_envio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessoes_de_envio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(18), 'hex'::text) NOT NULL,
    project_id uuid NOT NULL,
    criado_por uuid NOT NULL,
    expira_em timestamp with time zone DEFAULT (now() + '01:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE sessoes_de_envio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sessoes_de_envio IS 'Sessao de envio pelo celular, aberta pelo painel e valida por uma hora.';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    organization_id uuid NOT NULL,
    plan text NOT NULL,
    status text DEFAULT 'trialing'::text NOT NULL,
    asaas_customer_id text,
    asaas_subscription_id text,
    trial_ends_at timestamp with time zone,
    current_period_end timestamp with time zone,
    ultimo_evento text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    overdue_since timestamp with time zone,
    invoice_url text,
    ultimo_aviso_em date,
    cpf_cnpj text,
    titular text,
    telefone text,
    aviso_fim_teste_em date,
    plano_agendado text,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'overdue'::text, 'suspended'::text, 'canceled'::text])))
);


--
-- Name: COLUMN subscriptions.plano_agendado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.plano_agendado IS 'Plano menor escolhido pelo cliente, que passa a valer na proxima renovacao. Subir de plano vale na hora, com cobranca proporcional da diferenca.';


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    source_type text NOT NULL,
    youtube_id text,
    original_file_key text,
    mp4_url text,
    webm_url text,
    thumbnail_url text,
    duration_seconds integer,
    status text DEFAULT 'processing'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    focal_x smallint DEFAULT 50 NOT NULL,
    focal_y smallint DEFAULT 50 NOT NULL,
    preview_url text,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT videos_focal_x_check CHECK (((focal_x >= 0) AND (focal_x <= 100))),
    CONSTRAINT videos_focal_y_check CHECK (((focal_y >= 0) AND (focal_y <= 100))),
    CONSTRAINT videos_source_consistency CHECK ((((source_type = 'youtube'::text) AND (youtube_id IS NOT NULL)) OR ((source_type = 'upload'::text) AND (original_file_key IS NOT NULL)))),
    CONSTRAINT videos_source_type_check CHECK ((source_type = ANY (ARRAY['upload'::text, 'youtube'::text]))),
    CONSTRAINT videos_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'ready'::text, 'error'::text])))
);


--
-- Name: COLUMN videos.ativo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.videos.ativo IS 'Desligado pelo cliente na tela de videos. As regras de pagina continuam gravadas; o video apenas deixa de ser servido.';


--
-- Name: widget_ctas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widget_ctas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    widget_id uuid NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    target_url text,
    form_fields jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    buy_platform text,
    buy_selector text,
    sublabel text,
    button_style text DEFAULT 'card'::text NOT NULL,
    CONSTRAINT widget_ctas_button_style_check CHECK ((button_style = ANY (ARRAY['solid'::text, 'card'::text]))),
    CONSTRAINT widget_ctas_buy_platform_check CHECK (((buy_platform IS NULL) OR (buy_platform = ANY (ARRAY['auto'::text, 'vtex'::text, 'loja_integrada'::text, 'nuvemshop'::text, 'woocommerce'::text, 'shopify'::text, 'wix'::text, 'tray'::text, 'custom'::text])))),
    CONSTRAINT widget_ctas_buy_selector_check CHECK (((buy_platform IS DISTINCT FROM 'custom'::text) OR (NULLIF(TRIM(BOTH FROM buy_selector), ''::text) IS NOT NULL))),
    CONSTRAINT widget_ctas_target_consistency CHECK ((((type = ANY (ARRAY['whatsapp'::text, 'whatsapp_form'::text, 'link'::text])) AND (target_url IS NOT NULL)) OR (type = ANY (ARRAY['form'::text, 'none'::text, 'buy'::text])))),
    CONSTRAINT widget_ctas_type_check CHECK ((type = ANY (ARRAY['whatsapp'::text, 'whatsapp_form'::text, 'form'::text, 'buy'::text, 'none'::text, 'link'::text])))
);


--
-- Name: widget_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widget_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    widget_id uuid NOT NULL,
    event_type text NOT NULL,
    page_url text,
    session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    video_id uuid,
    CONSTRAINT widget_events_event_type_check CHECK ((event_type = ANY (ARRAY['impression'::text, 'expand'::text, 'play'::text, 'progress_3s'::text, 'progress_25'::text, 'progress_50'::text, 'progress_75'::text, 'complete'::text, 'cta_click'::text, 'close'::text])))
);


--
-- Name: widget_page_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widget_page_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    widget_id uuid NOT NULL,
    video_id uuid NOT NULL,
    match_type text NOT NULL,
    pattern text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT widget_page_rules_match_type_check CHECK ((match_type = ANY (ARRAY['contains'::text, 'exact'::text, 'all'::text, 'not_contains'::text]))),
    CONSTRAINT widget_page_rules_pattern_check CHECK ((length(TRIM(BOTH FROM pattern)) > 0))
);


--
-- Name: widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    video_id uuid,
    name text DEFAULT 'Widget'::text NOT NULL,
    shape text DEFAULT 'round'::text NOT NULL,
    size text DEFAULT 'md'::text NOT NULL,
    "position" text DEFAULT 'bottom-right'::text NOT NULL,
    border_color text DEFAULT '#000000'::text NOT NULL,
    autoplay boolean DEFAULT true NOT NULL,
    muted_start boolean DEFAULT true NOT NULL,
    delay_seconds integer DEFAULT 3 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    offset_x integer DEFAULT 24 NOT NULL,
    offset_y integer DEFAULT 24 NOT NULL,
    mobile_size text,
    mobile_position text,
    mobile_offset_x integer,
    mobile_offset_y integer,
    notify_webhook_url text,
    notify_email text,
    reappear_hours integer DEFAULT 1 NOT NULL,
    cta_color text DEFAULT '#25d366'::text NOT NULL,
    analytics_mode text DEFAULT 'auto'::text NOT NULL,
    trigger_mode text DEFAULT 'time'::text NOT NULL,
    trigger_scroll integer DEFAULT 50 NOT NULL,
    conversoes_otimizadas boolean DEFAULT true NOT NULL,
    CONSTRAINT widgets_analytics_mode_check CHECK ((analytics_mode = ANY (ARRAY['auto'::text, 'gtm'::text, 'gtag'::text, 'none'::text]))),
    CONSTRAINT widgets_delay_seconds_check CHECK ((delay_seconds >= 0)),
    CONSTRAINT widgets_mobile_position_check CHECK ((mobile_position = ANY (ARRAY['bottom-left'::text, 'bottom-right'::text]))),
    CONSTRAINT widgets_mobile_size_check CHECK ((mobile_size = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text]))),
    CONSTRAINT widgets_position_check CHECK (("position" = ANY (ARRAY['bottom-left'::text, 'bottom-right'::text]))),
    CONSTRAINT widgets_reappear_hours_check CHECK (((reappear_hours >= 1) AND (reappear_hours <= 720))),
    CONSTRAINT widgets_shape_check CHECK ((shape = ANY (ARRAY['round'::text, 'rectangular'::text, 'vertical'::text]))),
    CONSTRAINT widgets_size_check CHECK ((size = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text]))),
    CONSTRAINT widgets_trigger_mode_check CHECK ((trigger_mode = ANY (ARRAY['time'::text, 'scroll'::text, 'exit'::text, 'any'::text]))),
    CONSTRAINT widgets_trigger_scroll_check CHECK (((trigger_scroll >= 1) AND (trigger_scroll <= 100)))
);


--
-- Name: COLUMN widgets.conversoes_otimizadas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.widgets.conversoes_otimizadas IS 'Envia e-mail e telefone do lead com hash SHA-256 no dataLayer, para as conversoes otimizadas do Google Ads.';


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: arquivos_do_celular arquivos_do_celular_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos_do_celular
    ADD CONSTRAINT arquivos_do_celular_pkey PRIMARY KEY (id);


--
-- Name: cobranca_config cobranca_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca_config
    ADD CONSTRAINT cobranca_config_pkey PRIMARY KEY (id);


--
-- Name: invite_codes invite_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_code_key UNIQUE (code);


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (id);


--
-- Name: invites invites_organization_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_organization_id_email_key UNIQUE (organization_id, email);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: platform_admins platform_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_embed_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_embed_key_key UNIQUE (embed_key);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: sessoes_de_envio sessoes_de_envio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessoes_de_envio
    ADD CONSTRAINT sessoes_de_envio_pkey PRIMARY KEY (id);


--
-- Name: sessoes_de_envio sessoes_de_envio_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessoes_de_envio
    ADD CONSTRAINT sessoes_de_envio_token_key UNIQUE (token);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (organization_id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: widget_ctas widget_ctas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_ctas
    ADD CONSTRAINT widget_ctas_pkey PRIMARY KEY (id);


--
-- Name: widget_events widget_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_events
    ADD CONSTRAINT widget_events_pkey PRIMARY KEY (id);


--
-- Name: widget_page_rules widget_page_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_page_rules
    ADD CONSTRAINT widget_page_rules_pkey PRIMARY KEY (id);


--
-- Name: widgets widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widgets
    ADD CONSTRAINT widgets_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log_conta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_conta_idx ON public.admin_audit_log USING btree (organization_id, created_at DESC);


--
-- Name: arquivos_do_celular_sessao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX arquivos_do_celular_sessao_idx ON public.arquivos_do_celular USING btree (sessao_id, created_at);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_widget; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_widget ON public.leads USING btree (widget_id);


--
-- Name: idx_org_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org ON public.organization_members USING btree (organization_id);


--
-- Name: idx_org_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user ON public.organization_members USING btree (user_id);


--
-- Name: idx_projects_embed_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_embed_key ON public.projects USING btree (embed_key);


--
-- Name: idx_projects_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_org ON public.projects USING btree (organization_id);


--
-- Name: idx_videos_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_project ON public.videos USING btree (project_id);


--
-- Name: idx_videos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_status ON public.videos USING btree (status) WHERE (status <> 'ready'::text);


--
-- Name: idx_widget_ctas_widget; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_widget_ctas_widget ON public.widget_ctas USING btree (widget_id);


--
-- Name: idx_widget_events_widget_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_widget_events_widget_created ON public.widget_events USING btree (widget_id, created_at DESC);


--
-- Name: idx_widgets_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_widgets_project ON public.widgets USING btree (project_id);


--
-- Name: idx_widgets_video; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_widgets_video ON public.widgets USING btree (video_id);


--
-- Name: invite_codes_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_codes_batch_idx ON public.invite_codes USING btree (batch);


--
-- Name: invite_codes_used_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_codes_used_idx ON public.invite_codes USING btree (used_at);


--
-- Name: invites_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invites_token_key ON public.invites USING btree (token);


--
-- Name: leads_video_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_video_id_idx ON public.leads USING btree (video_id);


--
-- Name: subscriptions_asaas_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_asaas_idx ON public.subscriptions USING btree (asaas_subscription_id);


--
-- Name: widget_events_video_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX widget_events_video_id_idx ON public.widget_events USING btree (video_id);


--
-- Name: widget_page_rules_widget_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX widget_page_rules_widget_id_idx ON public.widget_page_rules USING btree (widget_id);


--
-- Name: invites ao_convidar_alguem; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ao_convidar_alguem AFTER INSERT ON public.invites FOR EACH ROW EXECUTE FUNCTION public.email_de_convite();


--
-- Name: subscriptions ao_criar_assinatura; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ao_criar_assinatura AFTER INSERT ON public.subscriptions FOR EACH ROW WHEN ((new.asaas_subscription_id IS NOT NULL)) EXECUTE FUNCTION public.email_de_assinatura();


--
-- Name: organization_members ao_entrar_na_equipe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ao_entrar_na_equipe AFTER INSERT ON public.organization_members FOR EACH ROW WHEN ((new.role <> 'owner'::text)) EXECUTE FUNCTION public.email_de_equipe();


--
-- Name: subscriptions ao_reassinar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ao_reassinar AFTER UPDATE OF asaas_subscription_id ON public.subscriptions FOR EACH ROW WHEN (((new.asaas_subscription_id IS NOT NULL) AND (new.asaas_subscription_id IS DISTINCT FROM old.asaas_subscription_id))) EXECUTE FUNCTION public.email_de_assinatura();


--
-- Name: projects trg_criar_widget_do_projeto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_criar_widget_do_projeto AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.criar_widget_do_projeto();


--
-- Name: invites trg_forcar_papel_editor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forcar_papel_editor BEFORE INSERT OR UPDATE OF role ON public.invites FOR EACH ROW EXECUTE FUNCTION public.forcar_papel_editor();


--
-- Name: organization_members trg_impedir_troca_de_papel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_impedir_troca_de_papel BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.impedir_troca_de_papel();


--
-- Name: organizations trg_impedir_troca_de_plano; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_impedir_troca_de_plano BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.impedir_troca_de_plano();


--
-- Name: projects trg_limite_de_projetos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_limite_de_projetos BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.checar_limite_de_projetos();


--
-- Name: leads trg_notify_new_lead; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_new_lead AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.notify_new_lead();


--
-- Name: videos trg_videos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: widgets trg_widgets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_widgets_updated_at BEFORE UPDATE ON public.widgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admin_audit_log admin_audit_log_ator_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_ator_fkey FOREIGN KEY (ator) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: admin_audit_log admin_audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: arquivos_do_celular arquivos_do_celular_sessao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos_do_celular
    ADD CONSTRAINT arquivos_do_celular_sessao_id_fkey FOREIGN KEY (sessao_id) REFERENCES public.sessoes_de_envio(id) ON DELETE CASCADE;


--
-- Name: invite_codes invite_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invite_codes invite_codes_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invites invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: invites invites_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;


--
-- Name: leads leads_widget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES public.widgets(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_plan_fkey FOREIGN KEY (plan) REFERENCES public.plans(id);


--
-- Name: platform_admins platform_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sessoes_de_envio sessoes_de_envio_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessoes_de_envio
    ADD CONSTRAINT sessoes_de_envio_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sessoes_de_envio sessoes_de_envio_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessoes_de_envio
    ADD CONSTRAINT sessoes_de_envio_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_fkey FOREIGN KEY (plan) REFERENCES public.plans(id);


--
-- Name: subscriptions subscriptions_plano_agendado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plano_agendado_fkey FOREIGN KEY (plano_agendado) REFERENCES public.plans(id);


--
-- Name: videos videos_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: widget_ctas widget_ctas_widget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_ctas
    ADD CONSTRAINT widget_ctas_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES public.widgets(id) ON DELETE CASCADE;


--
-- Name: widget_events widget_events_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_events
    ADD CONSTRAINT widget_events_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;


--
-- Name: widget_events widget_events_widget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_events
    ADD CONSTRAINT widget_events_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES public.widgets(id) ON DELETE CASCADE;


--
-- Name: widget_page_rules widget_page_rules_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_page_rules
    ADD CONSTRAINT widget_page_rules_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: widget_page_rules widget_page_rules_widget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_page_rules
    ADD CONSTRAINT widget_page_rules_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES public.widgets(id) ON DELETE CASCADE;


--
-- Name: widgets widgets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widgets
    ADD CONSTRAINT widgets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: widgets widgets_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widgets
    ADD CONSTRAINT widgets_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;


--
-- Name: subscriptions admin da plataforma administra assinaturas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin da plataforma administra assinaturas" ON public.subscriptions USING (public.e_admin_da_plataforma()) WITH CHECK (public.e_admin_da_plataforma());


--
-- Name: invite_codes admin da plataforma administra os convites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin da plataforma administra os convites" ON public.invite_codes USING (public.e_admin_da_plataforma()) WITH CHECK (public.e_admin_da_plataforma());


--
-- Name: plans admin da plataforma administra os planos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin da plataforma administra os planos" ON public.plans USING (public.e_admin_da_plataforma()) WITH CHECK (public.e_admin_da_plataforma());


--
-- Name: cobranca_config admin da plataforma ve a config de cobranca; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin da plataforma ve a config de cobranca" ON public.cobranca_config USING (public.e_admin_da_plataforma()) WITH CHECK (public.e_admin_da_plataforma());


--
-- Name: admin_audit_log admin le a auditoria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin le a auditoria" ON public.admin_audit_log FOR SELECT USING (public.e_admin_da_plataforma());


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_admins admins veem a lista de admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins veem a lista de admins" ON public.platform_admins FOR SELECT USING (public.e_admin_da_plataforma());


--
-- Name: arquivos_do_celular; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.arquivos_do_celular ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations authenticated users can create organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cobranca_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cobranca_config ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions dono ve a assinatura da conta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dono ve a assinatura da conta" ON public.subscriptions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = subscriptions.organization_id) AND (m.user_id = auth.uid()) AND (m.role = 'owner'::text)))) OR public.e_admin_da_plataforma()));


--
-- Name: invite_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leads org members can delete leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can delete leads" ON public.leads FOR DELETE USING (public.is_org_member_of_widget(widget_id));


--
-- Name: projects org members can manage projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can manage projects" ON public.projects USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = projects.organization_id) AND (m.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = projects.organization_id) AND (m.user_id = auth.uid())))));


--
-- Name: videos org members can manage videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can manage videos" ON public.videos USING (public.is_org_member_of_project(project_id)) WITH CHECK (public.is_org_member_of_project(project_id));


--
-- Name: widget_ctas org members can manage widget ctas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can manage widget ctas" ON public.widget_ctas USING (public.is_org_member_of_widget(widget_id)) WITH CHECK (public.is_org_member_of_widget(widget_id));


--
-- Name: widgets org members can manage widgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can manage widgets" ON public.widgets USING (public.is_org_member_of_project(project_id)) WITH CHECK (public.is_org_member_of_project(project_id));


--
-- Name: leads org members can view leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view leads" ON public.leads FOR SELECT USING (public.is_org_member_of_widget(widget_id));


--
-- Name: organization_members org members can view membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view membership" ON public.organization_members FOR SELECT TO authenticated USING (public.is_member_of_org(organization_id));


--
-- Name: profiles org members can view profiles of same org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view profiles of same org" ON public.profiles FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.organization_members me
     JOIN public.organization_members them ON ((them.organization_id = me.organization_id)))
  WHERE ((me.user_id = auth.uid()) AND (them.user_id = profiles.id)))) OR (id = auth.uid())));


--
-- Name: projects org members can view projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view projects" ON public.projects FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = projects.organization_id) AND (m.user_id = auth.uid())))));


--
-- Name: organizations org members can view their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view their organization" ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = auth.uid())))));


--
-- Name: videos org members can view videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view videos" ON public.videos FOR SELECT USING (public.is_org_member_of_project(project_id));


--
-- Name: widget_ctas org members can view widget ctas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view widget ctas" ON public.widget_ctas FOR SELECT USING (public.is_org_member_of_widget(widget_id));


--
-- Name: widget_events org members can view widget events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view widget events" ON public.widget_events FOR SELECT USING (public.is_org_member_of_widget(widget_id));


--
-- Name: widgets org members can view widgets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org members can view widgets" ON public.widgets FOR SELECT USING (public.is_org_member_of_project(project_id));


--
-- Name: invites org owners/admins can manage invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org owners/admins can manage invites" ON public.invites USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = invites.organization_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = invites.organization_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organization_members org owners/admins can manage membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org owners/admins can manage membership" ON public.organization_members TO authenticated USING (public.is_member_of_org(organization_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_member_of_org(organization_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: organizations org owners/admins can update their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org owners/admins can update their organization" ON public.organizations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: invites org owners/admins can view invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org owners/admins can view invites" ON public.invites FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = invites.organization_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: plans qualquer um logado ve os planos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "qualquer um logado ve os planos" ON public.plans FOR SELECT TO authenticated USING (true);


--
-- Name: sessoes_de_envio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessoes_de_envio ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

--
-- Name: plans visitante ve os planos publicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "visitante ve os planos publicos" ON public.plans FOR SELECT TO anon USING ((publico = true));


--
-- Name: widget_ctas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widget_ctas ENABLE ROW LEVEL SECURITY;

--
-- Name: widget_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

--
-- Name: widget_page_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widget_page_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: widget_page_rules widget_page_rules_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY widget_page_rules_org_access ON public.widget_page_rules USING (public.is_org_member_of_widget(widget_id)) WITH CHECK (public.is_org_member_of_widget(widget_id));


--
-- Name: widgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict CtZjDtoKPSi9O8SWgdxzBu5Cf6VgEtRZUOu6XHyiphEHHFAilQdET5xdAbDb4dJ

