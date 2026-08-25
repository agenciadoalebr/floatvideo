# Banco de dados — video-flutuante

Projeto Supabase: **video-flutuante** (`shlblslzuyubhutzypid`), região `sa-east-1`, organização `isdtsyzyeepgkvwkjhyb`.

- URL: `https://shlblslzuyubhutzypid.supabase.co`
- Chaves públicas: ver [.env.example](../.env.example) na raiz do projeto.
- `SUPABASE_SERVICE_ROLE_KEY`: pegar em Project Settings → API no painel Supabase (não fica salva em nenhum arquivo do repo).

## Migrations aplicadas

| Arquivo | O que faz |
|---|---|
| [0001_init_schema.sql](0001_init_schema.sql) | Cria todas as tabelas (organizations, organization_members, projects, videos, widgets, widget_ctas, leads, widget_events), triggers de `updated_at`, RLS multi-tenant e as 3 RPCs públicas do widget (`get_widget_config`, `record_widget_event`, `record_widget_lead`). |
| [0002_harden_security_definer_functions.sql](0002_harden_security_definer_functions.sql) | Corrige achados do Security Advisor: fixa `search_path` do trigger helper e revoga execução pública das funções internas `is_org_member_of_project`/`is_org_member_of_widget`. |

Ambas já foram **aplicadas diretamente no projeto** via MCP do Supabase. Este diretório é a fonte de verdade em texto — se recriar o projeto do zero (ex. `supabase db reset` local, ou outro ambiente), rode os arquivos nesta ordem numérica.

## Modelo de segurança (resumo)

- RLS habilitado em **todas** as 8 tabelas.
- Dashboard (usuário logado) só enxerga/edita dados da própria organização, via helpers `is_org_member_of_project` / `is_org_member_of_widget` usados dentro das policies — essas duas funções **não são chamáveis via REST**, só internamente pelo Postgres ao avaliar RLS.
- O site final do cliente (visitante anônimo carregando o `embed.js`) nunca lê as tabelas diretamente. Ele só pode chamar 3 RPCs `SECURITY DEFINER`, cada uma devolvendo/gravando exatamente o necessário:
  - `get_widget_config(embed_key text)` → JSON de config do widget ativo do projeto.
  - `record_widget_event(widget_id, event_type, page_url, session_id)` → grava analytics.
  - `record_widget_lead(widget_id, data, page_url)` → grava lead do formulário.
- O backend (Next/NestJS) usa a `service_role key` só em rotas server-side administrativas (upload, processamento, dashboard), nunca no browser.

## Testado

Rodei um fluxo de ponta a ponta (org → project → video → widget → cta → RPCs de config/evento/lead) direto no banco antes de entregar — os dados de teste já foram removidos (cascade automático via FKs `on delete cascade`).

## Próximos passos sugeridos

1. Criar os buckets no Cloudflare R2 (`video-flutuante-raw` privado, `video-flutuante-processed` público via CDN) e preencher `.env`.
2. Configurar Supabase Auth (magic link ou social login) pro dashboard.
3. Ao criar um usuário novo, o backend deve inserir automaticamente uma linha em `organizations` + `organization_members` (role `owner`) — isso não é feito por trigger no banco de propósito, pra manter a lógica de onboarding no app.
