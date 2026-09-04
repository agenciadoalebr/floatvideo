"use client";

import VideoUploader from "@/components/VideoUploader";
import YouTubeForm from "@/components/YouTubeForm";
import MarcaYouTube from "@/components/MarcaYouTube";

/**
 * A tela de envio.
 *
 * Eram duas caixas lado a lado, do mesmo tamanho, como se enviar um
 * arquivo e colar um link fossem a mesma decisão. Enviar é o caminho
 * principal — o link do YouTube é a alternativa de quem já tem o vídeo
 * publicado, e agora ela ocupa o espaço de uma alternativa.
 */
export default function PainelDeUpload({
  projectId,
  widgetId,
  widgetAtivo,
  siteConectado,
  temCta,
  totalDeVideos,
}: {
  projectId: string;
  /** Dono das regras de página — nasce junto com o site, no banco. */
  widgetId: string | null;
  widgetAtivo: boolean;
  siteConectado: boolean;
  temCta: boolean;
  totalDeVideos: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Enviar novo vídeo
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Vídeo gravado no celular, em pé, funciona melhor: é o formato do
            balão. Você diz o nome e em quais páginas ele aparece antes de
            enviar — assim ele já entra no ar pronto.
          </p>
        </div>

        <span className="cartao px-3 py-2 text-xs text-ink-muted">
          {totalDeVideos}{" "}
          {totalDeVideos === 1 ? "vídeo neste site" : "vídeos neste site"} ·{" "}
          <strong className="text-brand-ink">sem limite</strong>
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <section className="cartao p-6">
          <VideoUploader
            projectId={projectId}
            widgetId={widgetId}
            widgetAtivo={widgetAtivo}
            siteConectado={siteConectado}
            temCta={temCta}
          />

          <ul className="mt-5 grid gap-2 border-t border-outline-soft pt-4 text-xs text-ink-muted sm:grid-cols-3">
            {[
              ["Vertical 9:16", "aproveita o balão inteiro"],
              ["Até 500 MB", "MP4, WebM ou MOV"],
              ["Comprimido antes de subir", "no seu próprio navegador"],
            ].map(([titulo, nota]) => (
              <li key={titulo} className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-blue">✓</span>
                <span>
                  <strong className="block font-medium text-brand-ink">
                    {titulo}
                  </strong>
                  {nota}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cartao p-6">
          <p className="rotulo-metrica">Alternativa</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-brand-ink">
            <MarcaYouTube />
            Importar do YouTube
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Se o vídeo já está publicado lá, cole o link. Nada é enviado — o
            player do YouTube roda dentro do balão.
          </p>

          <div className="mt-4">
            <YouTubeForm projectId={projectId} widgetId={widgetId} />
          </div>

          <p className="mt-4 border-t border-outline-soft pt-3 text-xs text-ink-faint">
            Enviar o arquivo dá mais controle: sem marca de player, com
            prévia leve e miniatura própria. O link do YouTube é o atalho.
          </p>
        </section>
      </div>

    </div>
  );
}
