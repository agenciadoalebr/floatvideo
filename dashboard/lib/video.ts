import type { Video } from "@/lib/types";

/**
 * Como o vídeo aparece na interface. Fica aqui (e não em cada componente)
 * porque três telas mostram o mesmo vídeo — lista, seletor do widget e
 * abas de métricas — e o nome precisa bater nas três.
 */
export function videoLabel(video: Video) {
  if (video.name?.trim()) return video.name.trim();
  return video.source_type === "youtube"
    ? `YouTube — ${video.youtube_id}`
    : "Vídeo enviado";
}
