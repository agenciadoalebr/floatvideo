"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apagarArquivos } from "@/lib/upload";
import type { Video, Widget, PageRule } from "@/lib/types";
import { videoLabel } from "@/lib/video";
import {
  gerarEsalvarMiniatura,
  gerarEsalvarPrevia,
  formatarDuracao,
} from "@/lib/miniatura";
import PageRules from "@/components/PageRules";

const statusLabel: Record<Video["status"], string> = {
  processing: "Processando...",
  ready: "Pronto",
  error: "Erro",
};

const statusColor: Record<Video["status"], string> = {
  processing: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

type Props = {
  videos: Video[];
  projectId: string;
  widget: Widget | null;
  pageRules: PageRule[];
  /** Eventos por vídeo, para a linha mostrar views e conversão. */
  porVideo?: Record<string, Record<string, number>>;
  /** Tipo do botão de ação, que é o mesmo para todos os vídeos. */
  tipoDoCta?: string | null;
};

const NOME_DO_CTA: Record<string, string> = {
  whatsapp: "WhatsApp",
  whatsapp_form: "WhatsApp com formulário",
  form: "Formulário",
  buy: "Comprar",
  link: "Link direto",
};

export default function VideoList({
  videos,
  projectId,
  widget,
  pageRules,
  porVideo = {},
  tipoDoCta,
}: Props) {
  const [busca, setBusca] = useState("");
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [previaId, setPreviaId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Qual card está com as regras de página abertas. Um por vez: dois
  // cards abertos lado a lado deixariam a lista alta e confusa.
  const [regrasAbertas, setRegrasAbertas] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Esc fecha o modal de regras. Fica aqui, e não no modal, pra o
  // listener existir uma vez só em vez de um por card.
  useEffect(() => {
    if (!regrasAbertas) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setRegrasAbertas(null);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [regrasAbertas]);

  function startRename(video: Video) {
    setRenamingId(video.id);
    // Abre com o nome atual, não com o rótulo genérico — senão o
    // "Vídeo enviado" viraria o nome de verdade ao salvar sem editar.
    setDraftName(video.name ?? "");
  }

  async function saveRename(video: Video) {
    const next = draftName.trim();
    setRenamingId(null);
    if (next === (video.name ?? "")) return;

    const supabase = createClient();
    await supabase
      .from("videos")
      .update({ name: next || null })
      .eq("id", video.id);
    router.refresh();
  }

  // Vídeos enviados antes de a miniatura existir continuam sem imagem —
  // aqui ela é extraída do próprio arquivo já hospedado, sem reenvio.
  async function gerarMiniatura(video: Video) {
    if (!video.mp4_url) return;
    setGerandoId(video.id);
    const supabase = createClient();
    const url = await gerarEsalvarMiniatura(
      supabase,
      video.id,
      video.mp4_url,
      video.original_file_key as string
    );
    setGerandoId(null);
    if (!url) {
      alert(
        "Não foi possível gerar a miniatura deste vídeo. Tente de novo ou reenvie o arquivo."
      );
      return;
    }
    router.refresh();
  }

  // Vídeos enviados antes de a prévia existir continuam servindo o
  // arquivo cheio para todo visitante. Aqui ela é gerada a partir do que
  // já está hospedado — o download acontece uma vez, nesta aba.
  async function gerarPrevia(video: Video) {
    if (!video.mp4_url || !video.original_file_key) return;
    setPreviaId(video.id);
    try {
      const resposta = await fetch(video.mp4_url);
      const arquivo = await resposta.blob();
      const supabase = createClient();
      const url = await gerarEsalvarPrevia(
        supabase,
        video.id,
        arquivo,
        video.original_file_key
      );
      if (!url) {
        alert("Não foi possível gerar a prévia deste vídeo.");
        return;
      }
      router.refresh();
    } finally {
      setPreviaId(null);
    }
  }

  async function handleDelete(video: Video) {
    if (!confirm("Excluir este vídeo? As regras de página dele também serão removidas.")) {
      return;
    }

    setDeletingId(video.id);
    const supabase = createClient();

    if (video.source_type === "upload" && video.original_file_key) {
      const semExtensao = video.original_file_key.replace(/\.[a-z0-9]+$/i, "");
      // Vídeos antigos ainda moram no Storage do Supabase; os novos, no
      // R2. Limpar os dois é mais simples do que descobrir qual é qual —
      // apagar o que não existe não custa nada nos dois lados.
      await supabase.storage
        .from("videos")
        .remove([
          video.original_file_key,
          `${semExtensao}.jpg`,
          `${semExtensao}-previa.mp4`,
        ]);
      await apagarArquivos([
        video.original_file_key,
        `${semExtensao}.jpg`,
        `${semExtensao}-previa.mp4`,
      ]);
    }

    await supabase.from("videos").delete().eq("id", video.id);

    setDeletingId(null);
    router.refresh();
  }

  // Troca para a aba de métricas já filtrada neste vídeo. Os dois
  // componentes não têm relação de pai/filho, e o evento de janela evita
  // erguer esse estado até a página inteira só pra ligar um botão.
  function handleSeeMetrics(video: Video) {
    window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: "metricas" }));
  }

  if (videos.length === 0) return null;

  const videoAberto = videos.find((v) => v.id === regrasAbertas);

  const alvo = busca.trim().toLowerCase();
  const visiveis = alvo
    ? videos.filter((v) => videoLabel(v).toLowerCase().includes(alvo))
    : videos;

  /** O que este vídeo é hoje, do ponto de vista de quem visita o site. */
  function situacao(video: Video) {
    if (video.status === "processing") {
      return { texto: "Processando", cor: "bg-amber-100 text-amber-800" };
    }
    if (video.status === "error") {
      return { texto: "Erro", cor: "bg-red-100 text-red-700" };
    }
    const temRegra = pageRules.some((r) => r.video_id === video.id);
    if (!temRegra) {
      return { texto: "Rascunho", cor: "bg-surface-muted text-ink-muted" };
    }
    if (!widget?.is_active) {
      return { texto: "Pausado", cor: "bg-surface-muted text-ink-muted" };
    }
    return { texto: "Ativo", cor: "bg-emerald-100 text-emerald-800" };
  }

  return (
    <>
      {/* Sem overflow-hidden: ele arredondava o rodapé, mas tesourava
          o menu de ações que sai da borda do cartão. O arredondamento
          volta no proprio rodapé. */}
      <div className="cartao">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-brand-ink">
              Seus vídeos gravados
            </h3>
            <p className="text-xs text-ink-muted">
              Biblioteca de conteúdos e mensagens gravadas
            </p>
          </div>
          {videos.length > 3 && (
            <label className="flex min-w-[200px] items-center gap-2 rounded-lg bg-surface-soft px-3 py-2">
              <span aria-hidden className="text-ink-faint">
                &#8981;
              </span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar vídeo..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
            </label>
          )}
        </div>

        <ul className="divide-y divide-outline-soft border-t border-outline-soft">
          {visiveis.map((video) => {
            const estado = situacao(video);
            const contas = porVideo[video.id] ?? {};
            const views = contas.impression ?? 0;
            const cliques = contas.cta_click ?? 0;
            const conv = views ? (cliques / views) * 100 : null;

            return (
              <li key={video.id} className="flex items-center gap-4 px-5 py-4">
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                  {video.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : video.mp4_url ? (
                    <video
                      src={video.mp4_url}
                      className="h-full w-full object-cover"
                      muted
                    />
                  ) : null}
                  {formatarDuracao(video.duration_seconds) && (
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white">
                      {formatarDuracao(video.duration_seconds)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {renamingId === video.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => saveRename(video)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      placeholder="Nome do vídeo"
                      className="w-full rounded border border-brand-blue px-2 py-1 text-sm outline-none"
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startRename(video)}
                        title="Renomear vídeo"
                        className="truncate text-sm font-semibold text-brand-ink hover:text-brand-blue"
                      >
                        {videoLabel(video)}
                      </button>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.cor}`}
                      >
                        {estado.texto}
                      </span>
                    </div>
                  )}
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {tipoDoCta
                      ? `Botão: ${NOME_DO_CTA[tipoDoCta] ?? tipoDoCta}`
                      : "Sem botão de ação"}
                    {" • "}
                    {estado.texto === "Rascunho"
                      ? "Não publicado"
                      : `${views.toLocaleString("pt-BR")} views`}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  {cliques > 0 ? (
                    <>
                      <p className="text-sm font-semibold text-brand-ink">
                        {cliques.toLocaleString("pt-BR")} cliques CTA
                      </p>
                      <p className="text-xs text-ink-faint">
                        {conv?.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}
                        % conv.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-ink-faint">&mdash;</p>
                      <p className="text-xs text-ink-faint">Sem dados</p>
                    </>
                  )}
                </div>

                {/* As ações moram num menu: eram três botões por card, e
                    numa lista isso vira uma parede de texto repetido. */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setMenuAberto(menuAberto === video.id ? null : video.id)
                    }
                    aria-label={`Ações de ${videoLabel(video)}`}
                    aria-expanded={menuAberto === video.id}
                    className="rounded-lg px-2 py-1 text-ink-faint hover:bg-surface-soft"
                  >
                    &#8942;
                  </button>

                  {menuAberto === video.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuAberto(null)}
                      />
                      <div className="cartao-flutuante absolute right-0 top-full z-50 mt-1 w-56 p-1.5 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setRegrasAbertas(video.id);
                            setMenuAberto(null);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-soft hover:text-brand-ink"
                        >
                          Onde aparece?
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            startRename(video);
                            setMenuAberto(null);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-soft hover:text-brand-ink"
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSeeMetrics(video);
                            setMenuAberto(null);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-soft hover:text-brand-ink"
                        >
                          Ver métricas
                        </button>

                        {!video.thumbnail_url &&
                          video.mp4_url &&
                          video.original_file_key && (
                            <button
                              type="button"
                              onClick={() => {
                                gerarMiniatura(video);
                                setMenuAberto(null);
                              }}
                              disabled={gerandoId === video.id}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-soft hover:text-brand-ink disabled:opacity-50"
                            >
                              {gerandoId === video.id
                                ? "Gerando..."
                                : "Gerar miniatura"}
                            </button>
                          )}

                        {video.source_type === "upload" &&
                          video.mp4_url &&
                          video.original_file_key &&
                          !video.preview_url && (
                            <button
                              type="button"
                              onClick={() => {
                                gerarPrevia(video);
                                setMenuAberto(null);
                              }}
                              disabled={previaId === video.id}
                              title="Versão curta e leve para o balão, que economiza banda"
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-soft hover:text-brand-ink disabled:opacity-50"
                            >
                              {previaId === video.id
                                ? "Preparando..."
                                : "Gerar prévia leve"}
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() => {
                            handleDelete(video);
                            setMenuAberto(null);
                          }}
                          disabled={deletingId === video.id}
                          className="mt-1 block w-full rounded-lg border-t border-outline-soft px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === video.id
                            ? "Excluindo..."
                            : "Excluir vídeo"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}

          {visiveis.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-ink-muted">
              Nenhum vídeo com esse nome.
            </li>
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-outline-soft bg-surface-soft px-5 py-3">
          <p className="text-xs text-ink-muted">
            {videos.length} {videos.length === 1 ? "vídeo" : "vídeos"} neste
            site &middot; sem limite de quantidade
          </p>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("fvw-goto-tab", { detail: "upload" })
              )
            }
            className="text-xs font-medium text-brand-blue hover:underline"
          >
            Enviar outro &rarr;
          </button>
        </div>
      </div>

      {/* Modal fora da grade: dentro do card os campos ficavam espremidos
          em um terço da largura, e o card crescia empurrando a lista. */}
      {videoAberto && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setRegrasAbertas(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Onde aparece: ${videoLabel(videoAberto)}`}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  Onde aparece?
                </p>
                <p className="text-xs text-neutral-500">
                  {videoLabel(videoAberto)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegrasAbertas(null)}
                aria-label="Fechar"
                className="rounded-md px-2 py-1 text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                &times;
              </button>
            </div>
            <div className="p-5">
              <PageRules
                widgetId={widget?.id ?? null}
                videoId={videoAberto.id}
                rules={pageRules}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
