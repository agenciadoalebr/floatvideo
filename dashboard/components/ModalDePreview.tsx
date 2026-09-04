"use client";

import { useEffect } from "react";
import type { Video } from "@/lib/types";
import { videoLabel } from "@/lib/video";

/**
 * O vídeo em tela cheia, como o visitante vê ao tocar no balão.
 *
 * Aqui vale o arquivo cheio e com som: a prévia leve existe para o balão
 * recolhido, onde ninguém está prestando atenção ainda. Quem abriu isto
 * quer conferir o vídeo, não economizar banda.
 */
export default function ModalDePreview({
  video,
  aoFechar,
}: {
  video: Video;
  aoFechar: () => void;
}) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const doYouTube = video.source_type === "youtube" && video.youtube_id;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Prévia de ${videoLabel(video)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3 pb-2">
          <p className="truncate text-sm font-medium text-white">
            {videoLabel(video)}
          </p>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-lg leading-none text-white hover:bg-white/25"
          >
            &times;
          </button>
        </div>

        {/* 9:16 porque é o formato que o balão usa — ver aqui em outra
            proporção não responderia a pergunta de quem abriu. */}
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
          {doYouTube ? (
            <iframe
              src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
              title={videoLabel(video)}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : video.mp4_url ? (
            <video
              src={video.mp4_url}
              controls
              autoPlay
              playsInline
              // O atributo autoPlay sozinho não toca um vídeo com som: a
              // política do navegador o ignora. Pedir play() funciona
              // porque quem abriu esta janela acabou de clicar — e se
              // ainda assim for recusado, os controles estão à mão.
              onCanPlay={(e) => {
                void e.currentTarget.play().catch(() => {});
              }}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">
              Este vídeo ainda não tem arquivo para tocar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
