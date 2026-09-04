"use client";

import VideoUploader from "@/components/VideoUploader";
import YouTubeForm from "@/components/YouTubeForm";

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
  totalDeVideos,
}: {
  projectId: string;
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
            balão. Depois de enviar, você diz em quais páginas ele aparece.
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
          <VideoUploader projectId={projectId} />

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
          <h2 className="mt-1 text-base font-semibold text-brand-ink">
            Importar do YouTube
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Se o vídeo já está publicado lá, cole o link. Nada é enviado — o
            player do YouTube roda dentro do balão.
          </p>

          <div className="mt-4">
            <YouTubeForm projectId={projectId} />
          </div>

          <p className="mt-4 border-t border-outline-soft pt-3 text-xs text-ink-faint">
            Enviar o arquivo dá mais controle: sem marca de player, com
            prévia leve e miniatura própria. O link do YouTube é o atalho.
          </p>
        </section>
      </div>

      <section className="cartao p-5">
        <h2 className="text-base font-semibold text-brand-ink">
          Depois de enviar
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          O vídeo entra na lista, mas ainda não aparece no site. Falta dizer
          onde: em <strong>Vídeos</strong>, no menu do vídeo, use{" "}
          <strong>&ldquo;Onde aparece?&rdquo;</strong> para escolher as
          páginas. Sem regra, ele não entra em lugar nenhum — de propósito,
          para nada ir ao ar sem você mandar.
        </p>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("fvw-goto-tab", { detail: "videos" })
            )
          }
          className="mt-3 rounded-lg border border-outline-soft px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
        >
          Ir para os vídeos
        </button>
      </section>
    </div>
  );
}
