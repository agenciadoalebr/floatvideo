# Banco de dados — video-flutuante (FloatVideo)

Projeto Supabase: **video-flutuante** (`shlblslzuyubhutzypid`), região `sa-east-1`, organização `isdtsyzyeepgkvwkjhyb`.

- URL: `https://shlblslzuyubhutzypid.supabase.co`
- Chaves públicas: ver [.env.example](../.env.example) na raiz.
- `SUPABASE_SERVICE_ROLE_KEY`: pegar em Project Settings → API. Não fica em nenhum arquivo do repo — em produção vive nas variáveis de ambiente da Vercel.

## Migrations

Os arquivos `.sql` deste diretório cobrem apenas as quatro primeiras migrations. As demais foram aplicadas direto no projeto via MCP do Supabase e **não têm arquivo correspondente aqui** — a lista abaixo é a fonte de verdade. Para o histórico completo, `list_migrations` no projeto.

| Versão | Nome | O que faz |
|---|---|---|
| 20260821142839 / 142928 | `init_schema`, `init_schema_full` | Tabelas (organizations, organization_members, projects, videos, widgets, widget_ctas, leads, widget_events), triggers de `updated_at`, RLS multi-tenant e as 3 RPCs públicas do widget. |
| 20260821142957 | `harden_security_definer_functions` | Fixa `search_path` e revoga execução pública das funções internas de checagem de organização. |
| 20260821143534 | `storage_videos_bucket` | Cria o bucket público `videos` (500MB/arquivo; MP4/WebM/MOV + JPEG/PNG/WebP). |
| 20260821143544 | `auto_onboarding_trigger` | Ao criar usuário, cria organização + membership `owner` automaticamente. |
| 20260821152006 | `auth_password_admin_and_invites` | Convites e administração de senha. |
| 20260821152028 | `harden_handle_new_user` | Blindagem do trigger de onboarding. |
| 20260821161824 | `fix_organization_members_rls_recursion` | Corrige recursão infinita nas policies de `organization_members`. |
| 20260821162346 | `fix_authenticated_execute_on_org_helpers` | Ajusta grants dos helpers de organização. |
| 20260821171850 | `widget_offsets_and_expand_event` | `offset_x`/`offset_y` no widget e evento `expand`. |
| 20260821184845 | `widget_mobile_layout` | Tamanho/posição/offsets específicos de celular. |
| 20260825160349 | `domain_restriction_and_lead_rate_limit` | `get_widget_config` passa a validar a origem contra `projects.domain`; `leads.session_id` + limite de 3 envios por sessão a cada 24h. |
| 20260825160746 | `drop_old_rpc_overloads` | Remove as assinaturas antigas das RPCs — `CREATE OR REPLACE` com lista de parâmetros diferente cria uma **sobrecarga nova** em vez de substituir, e as duas versões ficavam expostas. |
| 20260825182331 | `track_video_id_on_events_and_leads` | `video_id` em `widget_events` e `leads`, preenchido no servidor a partir do widget. Permite métrica por vídeo. |
| 20260825184856 | `add_video_name` | `videos.name` — nome amigável definido por quem sobe. |

## Modelo de segurança (resumo)

- RLS habilitado em **todas** as tabelas.
- O dashboard só enxerga dados da própria organização, via helpers usados dentro das policies. Esses helpers **não são chamáveis via REST**.
- O visitante do site do cliente nunca lê tabelas direto. Só pode chamar 3 RPCs `SECURITY DEFINER`:
  - `get_widget_config(p_embed_key text, p_origin text)` → config do widget. Devolve `null` se a origem não bater com `projects.domain` (domínio vazio = sem restrição). O widget simplesmente não aparece, sem erro visível.
  - `record_widget_event(p_widget_id, p_event_type, p_page_url, p_session_id)` → analytics. O `video_id` **não** vem do navegador: é lido do widget no servidor, para ninguém forjar métrica de outro vídeo.
  - `record_widget_lead(p_widget_id, p_data, p_page_url, p_session_id)` → lead, com limite anti-spam de 3 por sessão a cada 24h.

## Armazenamento de vídeo

Uploads vão para o bucket **público** `videos` do Supabase Storage, em `{user_id}/{project_id}/{timestamp}.{ext}`, com `cacheControl` de 1 ano. A URL pública é gravada em `videos.mp4_url` e o widget a consome direto — sem token, sem expiração.

"Público" é literal: quem tiver a URL do arquivo acessa, sem passar pelo painel nem pela restrição de domínio. A trava de domínio protege a *configuração* do widget, não o arquivo. Aceitável para vídeo institucional; reavaliar se algum dia entrar conteúdo sensível.

Vídeos entre 15MB e 150MB são recomprimidos **no navegador** de quem sobe (ffmpeg.wasm, 1280px, CRF 28) antes do upload. Não há worker nem fila.

**Quando migrar para outro storage:** o plano Free do Supabase dá 1GB de storage e 5GB de banda/mês. Enquanto o uso ficar longe disso, migrar só adiciona um serviço, credenciais e um ponto de falha. Se chegar perto do limite, aí compensa comparar com Cloudflare R2, que não cobra egress. Uma versão anterior deste projeto já previa R2 e uma fila Redis/BullMQ no `.env.example`, mas nada disso foi implementado — as variáveis foram removidas para a documentação parar de descrever uma arquitetura inexistente.
