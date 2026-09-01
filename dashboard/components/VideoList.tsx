"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Video, Widget, PageRule } from "@/lib/types";
import { videoLabel } from "@/lib/video";
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
};

export default function VideoList({ videos, projectId, widget, pageRules }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function handleDelete(video: Video) {
    if (!confirm("Excluir este vídeo? Se ele estiver em uso num widget, o widget ficará sem vídeo até você escolher outro.")) {
      return;
    }

    setDeletingId(video.id);
    const supabase = createClient();

    if (video.source_type === "upload" && video.original_file_key) {
      await supabase.storage.from("videos").remove([video.original_file_key]);
    }

    await supabase.from("videos").delete().eq("id", video.id);

    setDeletingId(null);
    router.refresh();
  }

  // Troca para a aba de métricas já filtrada neste vídeo. Os dois
  // componentes não têm relação de pai/filho, e o evento de janela evita
  // erguer esse estado até a página inteira só pra ligar um botão.
  function handleSeeMetrics(video: Video) {
    window.dispatchEvent(new CustomEvent("fvw-show-metrics", { detail: video.id }));
    window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: "metricas" }));
  }

  if (videos.length === 0) return null;

  const videoAberto = videos.find((v) => v.id === regrasAbertas);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
      {videos.map((video) => (
        <div
          key={video.id}
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
        >
          <div className="aspect-video bg-neutral-100">
            {video.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnail_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : video.mp4_url ? (
              <video src={video.mp4_url} className="h-full w-full object-cover" muted />
            ) : null}
          </div>
          <div className="space-y-1 p-2">
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
              <button
                type="button"
                onClick={() => startRename(video)}
                title="Renomear vídeo"
                aria-label={`Renomear ${videoLabel(video)}`}
                className="group flex w-full items-center gap-1.5 text-left text-sm font-medium text-brand-ink hover:text-brand-blue"
              >
                <span className="truncate">{videoLabel(video)}</span>
                {/* O lápis é o que sinaliza que dá pra editar: o título
                    sozinho não passava essa impressão. Fica discreto e
                    ganha cor junto do texto no hover/foco. */}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:text-brand-blue"
                >
                  <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                </svg>
              </button>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {video.source_type === "youtube" ? "YouTube" : "Upload"}
                {widget?.video_id === video.id && (
                  <span className="ml-1 text-emerald-600">· em uso</span>
                )}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[video.status]}`}
              >
                {statusLabel[video.status]}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() =>
                setRegrasAbertas(regrasAbertas === video.id ? null : video.id)
              }
              aria-expanded={regrasAbertas === video.id}
              className={`border-r border-neutral-100 py-1.5 text-xs hover:bg-neutral-50 ${
                regrasAbertas === video.id
                  ? "font-medium text-brand-blue"
                  : "text-neutral-700"
              }`}
            >
              Onde aparece?
            </button>
            <button
              onClick={() => handleSeeMetrics(video)}
              className="border-r border-neutral-100 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Ver métricas
            </button>
            <button
              onClick={() => handleDelete(video)}
              disabled={deletingId === video.id}
              className="py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deletingId === video.id ? "Excluindo..." : "Excluir vídeo"}
            </button>
          </div>
        </div>
      ))}
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
                ehPadrao={widget?.video_id === videoAberto.id}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
