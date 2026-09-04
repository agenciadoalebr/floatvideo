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
import ModalDePreview from "@/components/ModalDePreview";
import MarcaYouTube from "@/components/MarcaYouTube";

type Props = {
  videos: Video[];
  widget: Widget | null;
  pageRules: PageRule[];
};

export default function VideoList({ videos, widget, pageRules }: Props) {
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
  const [previaAberta, setPreviaAberta] = useState<string | null>(null);
  // A chave responde na hora e o banco vem atrás: esperar a ida e volta
  // deixaria o controle parecendo quebrado no clique.
  const [ligadoLocal, setLigadoLocal] = useState<Record<string, boolean>>({});

  async function alternarAtivo(video: Video) {
    const novo = !(ligadoLocal[video.id] ?? video.ativo);
    setLigadoLocal((antes) => ({ ...antes, [video.id]: novo }));

    const supabase = createClient();
    const { error } = await supabase
      .from("videos")
      .update({ ativo: novo })
      .eq("id", video.id);

    if (error) {
      console.error("[VideoList] falha ao mudar ativo:", error);
      // Desfaz o que a tela já tinha mostrado: uma chave que diz "ligado"
      // com o vídeo fora do ar é pior do que um erro.
      setLigadoLocal((antes) => ({ ...antes, [video.id]: !novo }));
      alert("Não foi possível mudar o estado deste vídeo. Tente de novo.");
      return;
    }
    router.refresh();
  }
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
  function handleSeeMetrics() {
    window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: "metricas" }));
  }

  if (videos.length === 0) return null;

  const videoAberto = videos.find((v) => v.id === regrasAbertas);
  const videoEmPrevia = videos.find((v) => v.id === previaAberta);

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
    if (!(ligadoLocal[video.id] ?? video.ativo)) {
      return { texto: "Desligado", cor: "bg-surface-muted text-ink-muted" };
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


  /** As quatro ações do card, na ordem em que costumam ser usadas. */
  function Acoes({ video }: { video: Video }) {
    const botoes: [string, () => void][] = [
      ["Preview", () => setPreviaAberta(video.id)],
      ["Regras de URL", () => setRegrasAbertas(video.id)],
      ["Renomear", () => startRename(video)],
      ["Métricas", () => handleSeeMetrics()],
    ];

    return (
      <div className="grid grid-cols-2 gap-1.5">
        {botoes.map(([rotulo, aoClicar]) => (
          <button
            key={rotulo}
            type="button"
            onClick={aoClicar}
            className="rounded-lg border border-outline-soft px-2 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand-blue hover:text-brand-blue"
          >
            {rotulo}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {videos.length > 3 && (
          <label className="flex max-w-sm items-center gap-2 rounded-lg bg-surface-soft px-3 py-2">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visiveis.map((video) => {
            const estado = situacao(video);
            const ligado = ligadoLocal[video.id] ?? video.ativo;
            const temArquivo = Boolean(
              video.mp4_url || (video.source_type === "youtube" && video.youtube_id)
            );

            return (
              <article
                key={video.id}
                className="cartao flex flex-col overflow-visible"
              >
                {/* A miniatura é o botão de prévia: numa grade de vídeos,
                    a imagem é a primeira coisa em que se clica. */}
                <button
                  type="button"
                  onClick={() => temArquivo && setPreviaAberta(video.id)}
                  disabled={!temArquivo}
                  aria-label={`Ver prévia de ${videoLabel(video)}`}
                  className={`group relative block aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-surface-muted transition disabled:cursor-default ${
                    ligado ? "" : "opacity-50 grayscale"
                  }`}
                >
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
                      preload="metadata"
                    />
                  ) : null}

                  {temArquivo && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-card/90 opacity-0 shadow transition group-hover:opacity-100">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-brand-ink">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </span>
                  )}

                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.cor}`}
                  >
                    {estado.texto}
                  </span>

                  {formatarDuracao(video.duration_seconds) && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatarDuracao(video.duration_seconds)}
                    </span>
                  )}

                  {/* De onde o vídeo veio muda o que ele faz no balão: o
                      do YouTube roda no player deles, sem prévia leve nem
                      miniatura própria. Saber isso de relance evita
                      procurar num card o que só existe no outro. */}
                  {video.source_type === "youtube" && (
                    <span
                      title="Vídeo do YouTube"
                      className="absolute bottom-2 left-2 flex items-center rounded bg-surface-card/90 p-1 shadow"
                    >
                      <MarcaYouTube className="h-3.5 w-auto" />
                    </span>
                  )}
                </button>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex items-start justify-between gap-2">
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
                      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-ink">
                        {videoLabel(video)}
                      </h3>
                    )}

                    {/* O que é raro ou perigoso fica no menu: excluir e os
                        dois reparos de vídeo antigo. As quatro ações do
                        dia a dia ficam à vista, abaixo. */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuAberto(menuAberto === video.id ? null : video.id)
                        }
                        aria-label={`Mais ações de ${videoLabel(video)}`}
                        aria-expanded={menuAberto === video.id}
                        className="rounded-lg px-1.5 py-0.5 text-ink-faint hover:bg-surface-soft"
                      >
                        &#8942;
                      </button>

                      {menuAberto === video.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setMenuAberto(null)}
                          />
                          <div className="cartao-flutuante absolute right-0 top-full z-50 mt-1 w-52 p-1.5 text-left">
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
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === video.id
                                ? "Excluindo..."
                                : "Excluir vídeo"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* A chave fica acima das acoes e separada por uma
                      linha: ela e a unica coisa ali que muda o que o
                      visitante do site enxerga agora. */}
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between gap-2 border-t border-outline-soft pt-3">
                      <span className="text-xs font-medium text-brand-ink">
                        {ligado ? "Vídeo ativo" : "Vídeo desligado"}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ligado}
                        aria-label={`${ligado ? "Desligar" : "Ligar"} ${videoLabel(video)}`}
                        onClick={() => alternarAtivo(video)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          ligado ? "bg-brand-blue" : "bg-surface-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface-card shadow transition-all ${
                            ligado ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <Acoes video={video} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {visiveis.length === 0 && (
          <p className="cartao px-5 py-8 text-center text-sm text-ink-muted">
            Nenhum vídeo com esse nome.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
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

      {videoEmPrevia && (
        <ModalDePreview
          video={videoEmPrevia}
          aoFechar={() => setPreviaAberta(null)}
        />
      )}

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
          aria-label={`Regras de URL: ${videoLabel(videoAberto)}`}
        >
          <div className="cartao max-h-[85vh] w-full max-w-lg overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-soft px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  Regras de URL
                </p>
                <p className="text-xs text-ink-muted">
                  {videoLabel(videoAberto)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegrasAbertas(null)}
                aria-label="Fechar"
                className="rounded-md px-2 py-1 text-lg leading-none text-ink-faint hover:bg-surface-soft hover:text-brand-ink"
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
