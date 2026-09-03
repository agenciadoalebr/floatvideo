"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import NovoSiteModal from "@/components/NovoSiteModal";

export type ResumoDoSite = {
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

function achatar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type Filtro = "todos" | "ativos" | "sem_video";

export default function ListaDeSites({
  sites,
  limite,
  planoNome,
}: {
  sites: ResumoDoSite[];
  limite: number | null;
  planoNome: string | null;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [modalAberto, setModalAberto] = useState(false);

  const usados = sites.length;
  const podeCriar = limite === null || usados < limite;

  const contagens = useMemo(
    () => ({
      todos: sites.length,
      ativos: sites.filter((s) => s.widget_ativo).length,
      sem_video: sites.filter((s) => s.videos_prontos === 0).length,
    }),
    [sites]
  );

  // A lista já veio inteira do servidor: filtrar aqui responde a cada
  // tecla sem uma ida ao banco por letra digitada.
  const visiveis = useMemo(() => {
    const alvo = achatar(busca);
    return sites.filter((s) => {
      if (filtro === "ativos" && !s.widget_ativo) return false;
      if (filtro === "sem_video" && s.videos_prontos > 0) return false;
      if (!alvo) return true;
      return (
        achatar(s.nome).includes(alvo) ||
        achatar(s.dominio ?? "").includes(alvo)
      );
    });
  }, [sites, busca, filtro]);

  // O guia de primeiros passos some quando deixa de ser útil: para quem
  // já tem tudo no ar, ele é só ruído ocupando a metade de baixo da tela.
  const mostrarGuia = sites.length === 0 || sites.some((s) => !s.widget_ativo);

  const abas: { id: Filtro; rotulo: string }[] = [
    { id: "todos", rotulo: `Todos (${contagens.todos})` },
    { id: "ativos", rotulo: `Com widget ativo (${contagens.ativos})` },
    { id: "sem_video", rotulo: `Sem vídeo (${contagens.sem_video})` },
  ];

  return (
    <div className="space-y-6">
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
            Gerencie os sites onde suas bolhas de vídeo estão ativas ou
            adicione novos domínios à sua conta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {planoNome && (
            <span className="cartao px-3 py-2.5 text-xs text-ink-muted">
              Plano <strong className="text-brand-ink">{planoNome}</strong> ·{" "}
              {usados} de {limite ?? "∞"} {limite === 1 ? "site" : "sites"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            disabled={!podeCriar}
            title={
              podeCriar
                ? undefined
                : `Seu plano cobre ${limite} ${limite === 1 ? "site" : "sites"}.`
            }
            className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Adicionar novo site
          </button>
        </div>
      </div>

      {/* Busca e filtros só quando há o que filtrar: com um site na tela,
          eles seriam moldura em volta do nada. */}
      {sites.length > 1 && (
        <div className="cartao flex flex-wrap items-center justify-between gap-3 p-3">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg bg-surface-soft px-3 py-2">
            <span aria-hidden className="text-ink-faint">
              ⌕
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar site ou domínio..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {abas.map((aba) => (
              <button
                key={aba.id}
                type="button"
                onClick={() => setFiltro(aba.id)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  filtro === aba.id
                    ? "bg-surface-strong font-medium text-brand-ink"
                    : "text-ink-muted hover:bg-surface-soft"
                }`}
              >
                {aba.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((site) => (
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
                      ? "Sem vídeo ativo"
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
                  Abrir painel →
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
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="cartao flex flex-col items-start gap-3 border-dashed p-5 text-left transition hover:border-brand-blue"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-strong text-brand-blue">
              +
            </span>
            <span className="text-lg font-semibold text-brand-ink">
              Adicionar novo site
            </span>
            <span className="text-sm text-ink-muted">
              Cadastre o endereço onde o vídeo vai aparecer e receba o código
              de instalação.
            </span>
            <span className="mt-auto text-xs text-ink-faint">
              {usados} de {limite ?? "∞"} {limite === 1 ? "site" : "sites"}{" "}
              {limite === null ? "" : "usados"}
            </span>
          </button>
        ) : (
          <div className="cartao flex flex-col gap-3 p-5">
            <span className="self-start rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
              {usados} de {limite} {limite === 1 ? "site" : "sites"} usados
            </span>
            <h2 className="text-lg font-semibold text-brand-ink">
              Limite do plano atingido
            </h2>
            <p className="text-sm text-ink-muted">
              O plano {planoNome ?? "atual"} cobre {limite}{" "}
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

      {visiveis.length === 0 && sites.length > 0 && (
        <p className="cartao p-6 text-center text-sm text-ink-muted">
          Nenhum site encontrado com esse filtro.
        </p>
      )}

      {mostrarGuia && (
        <section className="cartao p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-brand-ink">
                Como o vídeo entra no ar
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Nenhum destes passos exige saber programar.
              </p>
            </div>
            <span className="rounded-full bg-surface-strong px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-blue">
              3 passos simples
            </span>
          </div>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              [
                "Cadastre seu domínio",
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

      <NovoSiteModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
      />
    </div>
  );
}
