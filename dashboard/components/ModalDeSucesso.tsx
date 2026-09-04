"use client";

import { descreverRegra, type RegraNova } from "@/components/RegrasDoNovoVideo";

function mb(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * O fim feliz do envio.
 *
 * O que ela diz muda conforme o estado real do site, e não é sempre
 * "está no ar": um vídeo salvo com o widget pausado, ou num site onde o
 * código ainda não foi instalado, não aparece para ninguém. Prometer o
 * contrário faria a pessoa ir conferir, não achar nada e desconfiar de
 * tudo o que a tela diz.
 *
 * O vídeo é escolhido pela regra de página na hora em que o visitante
 * abre o site — por isso um vídeo novo com regra entra no ar sozinho,
 * sem precisar ser "selecionado" em lugar nenhum.
 */
export default function ModalDeSucesso({
  nome,
  regras,
  ganho,
  widgetAtivo,
  siteConectado,
  temCta,
  aoFechar,
  aoVerVideos,
  aoConfigurarCta,
}: {
  nome: string;
  regras: RegraNova[];
  ganho?: { antes: number; depois: number } | null;
  widgetAtivo: boolean;
  siteConectado: boolean;
  /** Já existe botão de ação configurado neste site. */
  temCta: boolean;
  aoFechar: () => void;
  aoVerVideos: () => void;
  aoConfigurarCta: () => void;
}) {
  const noAr = widgetAtivo && siteConectado;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cartao w-full max-w-md p-6"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </span>

        <h2 className="mt-4 text-center text-lg font-semibold text-brand-ink">
          {noAr ? "Pronto — o vídeo já está no ar" : "Vídeo salvo"}
        </h2>

        <p className="mt-2 text-center text-sm text-ink-muted">
          <strong className="text-brand-ink">{nome}</strong>{" "}
          {noAr
            ? "já está aparecendo para quem visita o seu site."
            : widgetAtivo
              ? "está guardado e configurado. Ele entra no ar assim que o código do widget estiver instalado no site."
              : "está guardado e configurado. O widget está pausado — ligue-o para o vídeo aparecer."}
        </p>

        {regras.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface-soft p-4">
            <p className="rotulo-metrica">Onde ele aparece</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {regras.map((r) => (
                <li key={`${r.tipo}-${r.padrao}`}>{descreverRegra(r)}</li>
              ))}
            </ul>
          </div>
        )}

        {ganho && ganho.antes > ganho.depois && (
          <p className="mt-3 rounded-xl bg-surface-soft px-4 py-3 text-sm text-brand-ink">
            Comprimimos de <strong>{mb(ganho.antes)}</strong> para{" "}
            <strong>{mb(ganho.depois)}</strong> —{" "}
            <span className="text-emerald-700">
              {Math.round((1 - ganho.depois / ganho.antes) * 100)}% mais leve
            </span>
            , sem perda visível no balão. É o que mantém o seu site rápido.
          </p>
        )}

        {/* O lembrete só aparece para quem ainda não tem botão nenhum.
            Repetir o aviso para quem já configurou seria ruído — e
            ruído repetido é o que faz as pessoas pararem de ler avisos.
            Sem botão, o vídeo é assistido e a conversa morre ali. */}
        {!temCta && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Falta o botão de ação
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              É ele que transforma quem assistiu em contato — WhatsApp,
              formulário ou o botão de comprar da página. Sem ele o visitante
              vê o vídeo e não tem para onde ir.
            </p>
            <button
              type="button"
              onClick={aoConfigurarCta}
              className="mt-3 rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
            >
              Configurar agora
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={aoVerVideos}
            className="btn-brand flex-1 rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            Ver na lista de vídeos
          </button>
          <button
            type="button"
            onClick={aoFechar}
            className="flex-1 rounded-lg border border-outline-soft px-4 py-2.5 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
          >
            Enviar outro
          </button>
        </div>
      </div>
    </div>
  );
}
