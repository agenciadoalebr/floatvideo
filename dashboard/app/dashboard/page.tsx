import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewProjectForm from "@/components/NewProjectForm";

type Resumo = {
  id: string;
  nome: string;
  dominio: string | null;
  criado_em: string;
  videos: number;
  videos_prontos: number;
  widget_ativo: boolean;
  video_principal: string | null;
  miniatura: string | null;
  impressoes: number;
  cliques_cta: number;
  leads: number;
  ultima_atividade: string | null;
};

function numero(n: number) {
  return n.toLocaleString("pt-BR");
}

/** "há 15 min", "há 3 dias" — mais legível que a data crua num cartão. */
function desde(iso: string | null) {
  if (!iso) return null;
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Uma chamada só: contagem de eventos por site não é algo que o
  // PostgREST agrupe, e esta é a primeira tela do painel — o lugar onde
  // a espera mais incomoda.
  // A tipagem gerada não sabe que esta RPC devolve conjunto; o cast fica
  // aqui, num lugar só, como já é feito em listar_contas.
  const { data: sites } = await supabase.rpc("resumo_dos_sites");
  const lista = (sites ?? []) as unknown as Resumo[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organizations(max_projects, plans(nome, max_projects))")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .maybeSingle();

  const org = membership?.organizations as
    | {
        max_projects: number | null;
        plans: { nome: string; max_projects: number | null } | null;
      }
    | undefined;

  // A exceção negociada na conta vence o limite do plano — a mesma regra
  // que o banco aplica ao recusar o cadastro.
  const limite = org?.max_projects ?? org?.plans?.max_projects ?? null;
  const usados = lista.length;
  const podeCriar = limite === null || usados < limite;

  // O guia de primeiros passos some quando deixa de ser útil: para quem
  // já tem tudo no ar, ele é só ruído ocupando a metade de baixo da tela.
  const mostrarGuia = lista.length === 0 || lista.some((s) => !s.widget_ativo);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-surface-strong px-2 py-0.5 font-semibold uppercase tracking-wide text-brand-blue">
              Visão geral
            </span>
            <span className="text-ink-faint">
              {usados === 0
                ? "nenhum site ainda"
                : `${usados} ${usados === 1 ? "site registrado" : "sites registrados"}`}
            </span>
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-ink">
            Seus sites
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Cada site onde o vídeo flutuante aparece. Abra um para enviar
            vídeos, ajustar o balão e ver os resultados.
          </p>
        </div>

        {org?.plans?.nome && (
          <span className="cartao px-3 py-2 text-xs text-ink-muted">
            Plano <strong className="text-brand-ink">{org.plans.nome}</strong> ·{" "}
            {usados} de {limite ?? "∞"} {limite === 1 ? "site" : "sites"}
          </span>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((site) => (
          <div key={site.id} className="cartao flex flex-col overflow-hidden">
            {/* Fio do degradê no topo só quando está no ar: é o sinal que
                dá para ler de longe, antes mesmo de chegar no texto. */}
            <div
              className={
                site.widget_ativo
                  ? "h-1 bg-gradient-to-r from-brand-blue to-brand-violet"
                  : "h-1 bg-surface-muted"
              }
            />

            <div className="flex flex-1 flex-col gap-4 p-5">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    site.widget_ativo
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-surface-muted text-ink-muted"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      site.widget_ativo ? "bg-emerald-500" : "bg-ink-faint"
                    }`}
                  />
                  {site.widget_ativo
                    ? "Widget ativo"
                    : site.videos_prontos === 0
                      ? "Sem vídeo"
                      : "Widget desligado"}
                </span>

                <h2 className="mt-2 text-lg font-semibold text-brand-ink">
                  {site.nome}
                </h2>
                {site.dominio ? (
                  <a
                    href={`https://${site.dominio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-ink-faint hover:text-brand-blue hover:underline"
                  >
                    {site.dominio} ↗
                  </a>
                ) : (
                  <p className="text-xs text-amber-700">domínio não definido</p>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-surface-soft p-3">
                {site.miniatura ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={site.miniatura}
                    alt=""
                    className="h-16 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-ink-faint">
                    ▶
                  </div>
                )}
                <div className="min-w-0">
                  <p className="rotulo-metrica">Vídeo principal</p>
                  <p className="truncate text-sm font-medium text-brand-ink">
                    {site.video_principal ??
                      (site.videos_prontos > 0
                        ? "Vídeo sem nome"
                        : "Nenhum vídeo pronto")}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {site.videos} {site.videos === 1 ? "vídeo" : "vídeos"} no
                    site
                  </p>
                </div>
              </div>

              {/* Trinta dias, e o rótulo diz isso: número sem período é
                  número que cada pessoa interpreta de um jeito. */}
              <div>
                <p className="rotulo-metrica">Últimos 30 dias</p>
                <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Aparições", site.impressoes],
                    ["Cliques", site.cliques_cta],
                    ["Leads", site.leads],
                  ].map(([rotulo, valor]) => (
                    <div
                      key={rotulo as string}
                      className="rounded-lg border border-outline-soft py-2"
                    >
                      <dd className="text-base font-semibold text-brand-ink">
                        {numero(valor as number)}
                      </dd>
                      <dt className="text-[11px] text-ink-faint">{rotulo}</dt>
                    </div>
                  ))}
                </dl>
              </div>

              <p className="text-xs text-ink-faint">
                {desde(site.ultima_atividade)
                  ? `Última atividade ${desde(site.ultima_atividade)}`
                  : "Sem atividade nos últimos 30 dias"}
              </p>

              <div className="mt-auto flex gap-2 pt-1">
                <Link
                  href={`/dashboard/projects/${site.id}`}
                  className="btn-brand flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium"
                >
                  Abrir painel
                </Link>
                <Link
                  href={`/dashboard/projects/${site.id}?secao=instalacao`}
                  title="Ver o código de instalação"
                  className="rounded-lg border border-outline-soft px-3 py-2.5 font-mono text-sm text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                >
                  &lt;/&gt;
                </Link>
              </div>
            </div>
          </div>
        ))}

        {podeCriar ? (
          <div className="cartao flex flex-col gap-3 p-5">
            <h2 className="text-lg font-semibold text-brand-ink">
              Adicionar novo site
            </h2>
            <p className="text-sm text-ink-muted">
              Informe o endereço exato onde o vídeo vai aparecer.
            </p>
            <NewProjectForm />
          </div>
        ) : (
          <div className="cartao flex flex-col gap-3 p-5">
            <span className="self-start rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
              {usados} de {limite} {limite === 1 ? "site" : "sites"} usados
            </span>
            <h2 className="text-lg font-semibold text-brand-ink">
              Limite do plano atingido
            </h2>
            <p className="text-sm text-ink-muted">
              O plano {org?.plans?.nome ?? "atual"} cobre {limite}{" "}
              {limite === 1 ? "site" : "sites"}. Para cadastrar outro, fale com
              a gente.
            </p>
            <a
              href="mailto:contato@floatvideo.com.br"
              className="btn-brand mt-auto rounded-lg px-4 py-2.5 text-center text-sm font-medium"
            >
              Falar sobre mudar de plano
            </a>
          </div>
        )}
      </div>

      {mostrarGuia && (
        <section className="cartao p-6">
          <h2 className="text-base font-semibold text-brand-ink">
            Como o vídeo entra no ar
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Três passos, e nenhum deles exige saber programar.
          </p>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              [
                "Cadastre o site",
                "O endereço exato onde o vídeo vai aparecer — a loja, o site institucional, a página de captura.",
              ],
              [
                "Envie o vídeo e diga onde ele aparece",
                "Um arquivo seu ou um link do YouTube. Sem uma regra de página, o vídeo não entra em lugar nenhum.",
              ],
              [
                "Cole uma linha no site",
                "Antes do fechamento do </body>, ou pelo Google Tag Manager em dois cliques.",
              ],
            ].map(([titulo, texto], i) => (
              <li key={titulo} className="rounded-xl bg-surface-soft p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 text-sm font-medium text-brand-ink">
                  {titulo}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{texto}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
