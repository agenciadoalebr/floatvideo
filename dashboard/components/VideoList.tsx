"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Video, Widget } from "@/lib/types";
import { videoLabel } from "@/lib/video";

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
};

export default function VideoList({ videos, projectId, widget }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

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

  // "Editar" usa este vídeo no widget do projeto (cria o widget se ainda
  // não existir) e leva direto pra seção de configuração — atalho pra
  // editar o widget de um vídeo já carregado sem precisar rolar a tela
  // e escolher no seletor manualmente.
  async function handleEdit(video: Video) {
    setEditingId(video.id);
    const supabase = createClient();

    if (widget) {
      await supabase.from("widgets").update({ video_id: video.id }).eq("id", widget.id);
    } else {
      await supabase.from("widgets").insert({
        project_id: projectId,
        video_id: video.id,
      });
    }

    setEditingId(null);
    router.refresh();
    window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: "widget" }));
  }

  // Troca para a aba de métricas já filtrada neste vídeo. Os dois
  // componentes não têm relação de pai/filho, e o evento de janela evita
  // erguer esse estado até a página inteira só pra ligar um botão.
  function handleSeeMetrics(video: Video) {
    window.dispatchEvent(new CustomEvent("fvw-show-metrics", { detail: video.id }));
    window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: "metricas" }));
  }

  if (videos.length === 0) return null;

  return (
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
                onClick={() => startRename(video)}
                title="Clique para renomear"
                className="block w-full truncate text-left text-sm font-medium text-brand-ink hover:text-brand-blue"
              >
                {videoLabel(video)}
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
              onClick={() => handleEdit(video)}
              disabled={video.status !== "ready" || editingId === video.id}
              className="border-r border-neutral-100 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {editingId === video.id ? "Aplicando..." : "Editar widget"}
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
  );
}
