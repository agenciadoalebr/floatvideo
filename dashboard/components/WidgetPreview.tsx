"use client";

import { useEffect } from "react";
import type { Video, Widget } from "@/lib/types";

type Props = {
  video: Video | undefined;
  shape: Widget["shape"];
  size: Widget["size"];
  position: Widget["position"];
  borderColor: string;
  offsetX: number;
  offsetY: number;
  focalX: number;
  focalY: number;
};

/**
 * Prévia do balão usando o CSS de produção (/fvw-styles.css), não uma
 * reimplementação: qualquer ajuste no visual do widget aparece aqui
 * automaticamente, sem risco de a prévia e o widget real divergirem com
 * o tempo.
 */
export default function WidgetPreview({
  video,
  shape,
  size,
  position,
  borderColor,
  offsetX,
  offsetY,
  focalX,
  focalY,
}: Props) {
  // Todas as regras são prefixadas com .fvw-, então carregar a folha de
  // estilo do widget dentro do painel não afeta o resto da interface.
  useEffect(() => {
    if (document.getElementById("fvw-styles")) return;
    const link = document.createElement("link");
    link.id = "fvw-styles";
    link.rel = "stylesheet";
    link.href = "/fvw-styles.css";
    document.head.appendChild(link);
  }, []);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-neutral-700">Prévia ao vivo</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Formato, tamanho, cor e posição mudam conforme você edita ao lado.
      </p>

      <div
        // O balão real usa position:fixed. Um ancestral com "transform"
        // vira o bloco de contenção dele — é o que prende o balão dentro
        // desta caixa em vez de ele flutuar sobre o painel inteiro.
        style={{ transform: "translateZ(0)" }}
        className="relative mt-3 h-72 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100"
      >
        {/* Faixas cinzas só pra dar a sensação de uma página por baixo,
            e assim dar noção de contraste e posicionamento. */}
        <div className="space-y-2 p-4" aria-hidden>
          <div className="h-3 w-1/3 rounded bg-neutral-200" />
          <div className="h-2 w-full rounded bg-neutral-200" />
          <div className="h-2 w-5/6 rounded bg-neutral-200" />
          <div className="h-2 w-2/3 rounded bg-neutral-200" />
        </div>

        {video ? (
          <div
            className={[
              "fvw-wrapper",
              "fvw-visible",
              `fvw-shape-${shape}`,
              `fvw-size-${size}`,
              `fvw-pos-${position}`,
            ].join(" ")}
            style={
              {
                "--fvw-border-color": borderColor,
                "--fvw-offset-x": `${offsetX}px`,
                "--fvw-offset-y": `${offsetY}px`,
                // Mesmo cálculo do player: o iframe do YouTube está a
                // 300%, então andar 1% do vídeo é andar 3% do balão.
                "--fvw-focal-x": `${focalX}%`,
                "--fvw-focal-y": `${focalY}%`,
                "--fvw-iframe-left": `${50 + (50 - focalX) * 3}%`,
                "--fvw-iframe-top": `${50 + (50 - focalY) * 3}%`,
              } as React.CSSProperties
            }
          >
            <button className="fvw-close" aria-label="Fechar vídeo" tabIndex={-1}>
              ×
            </button>
            <div className="fvw-media-slot">
              {video.source_type === "youtube" ? (
                <iframe
                  // key força recriar o iframe ao trocar de vídeo — sem
                  // isso o YouTube às vezes mantém o vídeo anterior.
                  key={video.youtube_id}
                  src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${video.youtube_id}&playsinline=1&modestbranding=1&rel=0&cc_load_policy=0`}
                  allow="autoplay; encrypted-media"
                  title="Prévia do vídeo"
                />
              ) : (
                <video
                  key={video.mp4_url ?? video.id}
                  className="fvw-video"
                  src={video.mp4_url ?? undefined}
                  poster={video.thumbnail_url ?? undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              )}
            </div>
          </div>
        ) : (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
            Selecione um vídeo para ver a prévia.
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-neutral-400">
        Prévia aproximada: como esta caixa é menor que uma tela real, o balão
        aparece proporcionalmente maior do que ficará no site.
      </p>
    </div>
  );
}
