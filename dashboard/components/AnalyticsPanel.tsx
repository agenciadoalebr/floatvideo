"use client";

import { useEffect, useState } from "react";
import type { Video } from "@/lib/types";
import { videoLabel } from "@/lib/video";

type Props = {
  /** Contagem por tipo de evento somando todos os vídeos do site. */
  totals: Record<string, number>;
  /** Contagem por tipo de evento, separada por vídeo. */
  byVideo: Record<string, Record<string, number>>;
  videos: Video[];
  /** Eventos gravados antes de passarmos a registrar o vídeo. */
  unattributed: number;
};

const LABELS: Record<string, string> = {
  impression: "Impressões (balão apareceu)",
  expand: "Expansões (clicou pra assistir)",
  play: "Vídeo iniciou",
  complete: "Vídeo assistido até o fim",
  cta_click: "Cliques no botão de ação",
  close: "Fechamentos",
};

const ORDER = ["impression", "expand", "play", "complete", "cta_click", "close"];

const ALL = "__all__";

export default function AnalyticsPanel({ totals, byVideo, videos, unattributed }: Props) {
  const [selected, setSelected] = useState<string>(ALL);

  // O botão "Ver métricas" de cada vídeo (lá em cima, no card) avisa por
  // um evento de janela qual vídeo abrir aqui — os dois componentes não
  // têm relação de pai/filho, e um evento simples resolve sem precisar
  // arrastar estado pela página inteira.
  useEffect(() => {
    function handle(e: Event) {
      const videoId = (e as CustomEvent<string>).detail;
      setSelected(videoId || ALL);
    }
    window.addEventListener("fvw-show-metrics", handle);
    return () => window.removeEventListener("fvw-show-metrics", handle);
  }, []);

  const counts = selected === ALL ? totals : (byVideo[selected] ?? {});
  const impressions = counts.impression ?? 0;
  const max = Math.max(1, ...ORDER.map((k) => counts[k] ?? 0));

  const tabs = [
    { id: ALL, label: "Todos os vídeos" },
    ...videos.map((v) => ({ id: v.id, label: videoLabel(v) })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelected(tab.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selected === tab.id
                ? "btn-brand"
                : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {impressions === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          {selected === ALL
            ? "Ainda não há dados suficientes. As métricas aparecem aqui assim que o widget começar a receber visitas."
            : "Este vídeo ainda não registrou visitas enquanto esteve no widget."}
        </p>
      ) : (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
          {ORDER.map((key) => {
            const value = counts[key] ?? 0;
            const pct = Math.round((value / impressions) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span>{LABELS[key]}</span>
                  <span className="font-medium text-neutral-900">
                    {value}
                    {key !== "impression" && ` · ${pct}%`}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet"
                    style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected === ALL && unattributed > 0 && (
        <p className="text-xs text-neutral-400">
          {unattributed} evento(s) foram registrados antes da separação por vídeo —
          entram no total, mas não em nenhum vídeo específico.
        </p>
      )}
    </div>
  );
}
