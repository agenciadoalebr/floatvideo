"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Video } from "@/lib/types";
import { videoLabel } from "@/lib/video";

export type Metricas = {
  dias: number;
  totais: Record<string, number>;
  anterior: Record<string, number>;
  leads: number;
  leads_anterior: number;
  paginas: {
    pagina: string;
    impressoes: number;
    aberturas: number;
    cliques: number;
  }[];
};

function numero(n: number) {
  return n.toLocaleString("pt-BR");
}

function pct(parte: number, todo: number) {
  if (!todo) return null;
  return ((parte / todo) * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
}

/** Variação contra o mesmo número do período anterior. */
function variacao(agora: number, antes: number) {
  if (!antes) return null;
  const v = ((agora - antes) / antes) * 100;
  return {
    texto: `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    subiu: v >= 0,
  };
}

const PERIODOS = [
  [7, "7 dias"],
  [30, "30 dias"],
  [90, "90 dias"],
] as const;

/**
 * A escada de retenção, medida contra quem abriu o vídeo — e não contra
 * quem viu o balão passar na tela. São perguntas diferentes: uma é sobre
 * atrair o clique, a outra é sobre segurar quem já clicou.
 */
const RETENCAO = [
  { key: "play", rotulo: "Abriram", detalhe: "clicaram e o vídeo começou" },
  { key: "progress_3s", rotulo: "3 segundos", detalhe: "passaram do gancho" },
  { key: "progress_25", rotulo: "25%", detalhe: "primeiro quarto" },
  { key: "progress_50", rotulo: "Metade", detalhe: "chegaram ao meio" },
  { key: "progress_75", rotulo: "75%", detalhe: "reta final" },
  { key: "complete", rotulo: "Fim", detalhe: "assistiram inteiro" },
];

export default function AnalyticsPanel({
  projectId,
  inicial,
  videos = [],
}: {
  projectId: string;
  inicial: Metricas | null;
  /** Para o seletor, que só some em site sem vídeo nenhum. */
  videos?: Video[];
}) {
  const [dias, setDias] = useState(inicial?.dias ?? 30);
  // null é "todos os vídeos", que é como a tela abre: a pergunta comum é
  // sobre o site, e o recorte por vídeo é a segunda pergunta.
  const [videoId, setVideoId] = useState<string | null>(null);
  const [dados, setDados] = useState<Metricas | null>(inicial);
  const [carregando, setCarregando] = useState(false);
  // Cada busca leva um número; só a resposta da última vale. Sem isso,
  // trocar de vídeo duas vezes rápido pode fazer a resposta antiga
  // chegar depois e sobrescrever a nova.
  const pedido = useRef(0);

  // A busca acontece no clique, e não num efeito: quem dispara é a
  // pessoa trocando o período ou o vídeo, e o primeiro conjunto já veio
  // pronto do servidor.
  async function carregar(novosDias: number, novoVideo: string | null) {
    setDias(novosDias);
    setVideoId(novoVideo);
    setCarregando(true);

    const meu = ++pedido.current;

    const supabase = createClient();
    const { data } = await supabase.rpc("metricas_do_site", {
      p_project_id: projectId,
      p_dias: novosDias,
      p_video_id: novoVideo,
    });

    if (meu !== pedido.current) return;

    setDados((data ?? null) as unknown as Metricas | null);
    setCarregando(false);
  }

  const t = dados?.totais ?? {};
  const a = dados?.anterior ?? {};
  const impressoes = t.impression ?? 0;
  const aberturas = t.expand ?? 0;
  const cliques = t.cta_click ?? 0;
  const leads = dados?.leads ?? 0;
  const play = t.play ?? 0;

  const cartoes = [
    {
      rotulo: "Aparições do balão",
      valor: impressoes,
      variacao: variacao(impressoes, a.impression ?? 0),
      texto: "Quantas vezes o vídeo apareceu no canto da página.",
      extra: null as string | null,
    },
    {
      rotulo: "Cliques para expandir",
      valor: aberturas,
      variacao: variacao(aberturas, a.expand ?? 0),
      texto: "Visitantes que clicaram e assistiram em tela cheia.",
      extra: pct(aberturas, impressoes)
        ? `${pct(aberturas, impressoes)}% de quem viu`
        : null,
    },
    {
      rotulo: "Cliques no botão de ação",
      valor: cliques,
      variacao: variacao(cliques, a.cta_click ?? 0),
      texto: "Quem seguiu para o WhatsApp, o formulário ou a compra.",
      extra: pct(cliques, aberturas)
        ? `${pct(cliques, aberturas)}% de quem abriu`
        : null,
    },
    {
      rotulo: "Contatos gerados",
      valor: leads,
      variacao: variacao(leads, dados?.leads_anterior ?? 0),
      texto: "Pessoas que deixaram contato ou foram para o WhatsApp.",
      extra: pct(leads, impressoes)
        ? `${pct(leads, impressoes)}% de quem viu`
        : null,
    },
  ];

  const totalPaginas = (dados?.paginas ?? []).reduce(
    (s, p) => s + p.impressoes,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Métricas
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Quantas pessoas viram o vídeo, quantas abriram, onde elas param
            de assistir e quantas viraram contato.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Aparece já com um vídeo. Escondê-lo nesse caso parecia
              limpeza — dois itens que dão o mesmo número —, mas deixava
              a funcionalidade invisível justamente em metade dos sites,
              e quem abre não tem como saber que ela existe. Com um vídeo
              só, o seletor ao menos diz de quem são os números. */}
          {videos.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Vídeo</span>
              <select
                value={videoId ?? ""}
                onChange={(e) => carregar(dias, e.target.value || null)}
                className="rounded-lg border border-outline-soft bg-surface-card px-3 py-2 text-sm text-ink-muted"
              >
                <option value="">Todos os vídeos</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {videoLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          )}

        <div className="flex gap-1 rounded-lg bg-surface-soft p-1">
          {PERIODOS.map(([valor, nome]) => (
            <button
              key={valor}
              type="button"
              onClick={() => carregar(valor, videoId)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                dias === valor
                  ? "bg-surface-card font-medium text-brand-ink shadow-sm"
                  : "text-ink-muted hover:text-brand-ink"
              }`}
            >
              {nome}
            </button>
          ))}
        </div>
        </div>
      </div>

      {impressoes === 0 && !carregando ? (
        <p className="cartao p-6 text-sm text-ink-muted">
          {videoId
            ? "Este vídeo não teve nenhuma exibição no período escolhido. Ele pode não estar no ar, ou não ter caído em nenhuma página visitada."
            : "Ainda não há dados neste período. Os números aparecem assim que o widget começar a ser exibido no site."}
        </p>
      ) : (
        <>
          <div
            className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${
              carregando ? "opacity-50" : ""
            }`}
          >
            {cartoes.map((c) => (
              <div key={c.rotulo} className="cartao p-5">
                <p className="rotulo-metrica">{c.rotulo}</p>
                <p className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-semibold text-brand-ink">
                    {numero(c.valor)}
                  </span>
                  {c.variacao && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.variacao.subiu
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {c.variacao.texto}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs text-ink-muted">{c.texto}</p>
                {c.extra && (
                  <p className="mt-2 border-t border-outline-soft pt-2 text-xs text-brand-blue">
                    {c.extra}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* A variação compara com os mesmos dias imediatamente
              anteriores. Sem dizer isso, "+18%" é um número sem régua. */}
          <p className="text-xs text-ink-faint">
            A variação compara com os {dias} dias anteriores a este período.
          </p>

          {play > 0 && (
            <section className="cartao p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-brand-ink">
                    Onde as pessoas param de assistir
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    De cada 100 que abriram o vídeo, quantas chegaram a cada
                    ponto. O degrau mais fundo é onde elas desistem.
                  </p>
                </div>
                <span className="text-xs text-ink-faint">
                  base: {numero(play)} aberturas
                </span>
              </div>

              <ol className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {RETENCAO.map((etapa, i) => {
                  const valor = t[etapa.key] ?? 0;
                  const p = (valor / play) * 100;
                  const anterior =
                    i === 0 ? null : (t[RETENCAO[i - 1].key] ?? 0);
                  const queda =
                    anterior && anterior > 0
                      ? ((anterior - valor) / play) * 100
                      : null;
                  return (
                    <li
                      key={etapa.key}
                      className="rounded-xl border border-outline-soft p-3"
                    >
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-ink-muted">
                          {etapa.rotulo}
                        </span>
                        <span className="text-sm font-semibold text-brand-ink">
                          {p.toLocaleString("pt-BR", {
                            maximumFractionDigits: 0,
                          })}
                          %
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {etapa.detalhe}
                      </p>
                      <div className="mt-2 h-1.5 rounded-full bg-surface-muted">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet"
                          style={{ width: `${Math.max(2, p)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-ink-faint">
                        {numero(valor)} pessoas
                        {queda && queda > 0.5 && (
                          <span className="ml-1 text-amber-700">
                            · saíram{" "}
                            {queda.toLocaleString("pt-BR", {
                              maximumFractionDigits: 0,
                            })}
                            %
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {(t.progress_25 ?? 0) === 0 && (
                <p className="mt-3 text-xs text-ink-faint">
                  Os marcos de retenção passaram a ser medidos depois de
                  algumas aberturas antigas — elas contam só na primeira
                  coluna.
                </p>
              )}
            </section>
          )}

          {(dados?.paginas ?? []).length > 0 && (
            <section className="cartao">
              <div className="px-5 py-4">
                <h2 className="text-base font-semibold text-brand-ink">
                  Páginas que mais exibiram
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Onde o vídeo apareceu, e o que ele rendeu em cada lugar.
                </p>
              </div>
              <div className="overflow-x-auto border-t border-outline-soft">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-soft">
                    <tr className="text-ink-faint">
                      <th className="px-5 py-2 font-medium">Página</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Aparições
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Aberturas
                      </th>
                      <th className="px-5 py-2 text-right font-medium">
                        Cliques
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-soft">
                    {(dados?.paginas ?? []).map((p) => (
                      <tr key={p.pagina}>
                        <td className="max-w-0 px-5 py-3">
                          <span className="block truncate text-brand-ink">
                            {p.pagina}
                          </span>
                          <span className="text-xs text-ink-faint">
                            {pct(p.impressoes, totalPaginas)}% do total
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-brand-ink">
                          {numero(p.impressoes)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-brand-ink">
                            {numero(p.aberturas)}
                          </span>
                          <span className="block text-xs text-ink-faint">
                            {pct(p.aberturas, p.impressoes) ?? "0"}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-brand-ink">
                            {numero(p.cliques)}
                          </span>
                          <span className="block text-xs text-ink-faint">
                            {pct(p.cliques, p.aberturas) ?? "0"}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-outline-soft px-5 py-3 text-xs text-ink-faint">
                As 20 páginas com mais aparições no período. O endereço vem
                sem os parâmetros de campanha, senão a mesma página viraria
                dez linhas diferentes.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
