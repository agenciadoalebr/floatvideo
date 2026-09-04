"use client";

import VideoList from "@/components/VideoList";
import type { Video, Widget, PageRule } from "@/lib/types";

function irPara(secao: string) {
  window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: secao }));
}

/**
 * A tela de Vídeos: os vídeos, e nada mais.
 *
 * Ela já foi um painel de resumo — métricas, simulação do balão no site,
 * últimos contatos. Tudo isso existe com mais espaço nas telas próprias
 * (Métricas, Widget, Leads), e repetido aqui só empurrava para baixo o
 * que a pessoa veio fazer: mexer nos vídeos.
 *
 * O que cada vídeo permite fazer mora no próprio card.
 */
export default function PainelDeVideos({
  videos,
  widget,
  pageRules,
  dominio,
}: {
  videos: Video[];
  widget: Widget | null;
  pageRules: PageRule[];
  dominio: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Vídeos do seu site
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gerencie a bolha de vídeo interativa exibida em{" "}
            <strong className="text-brand-ink">{dominio ?? "seu site"}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => irPara("upload")}
          className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          Subir novo vídeo
        </button>
      </div>

      <VideoList videos={videos} widget={widget} pageRules={pageRules} />
    </div>
  );
}
