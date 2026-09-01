"use client";

import { useRef, useState } from "react";

/**
 * Trecho para copiar e colar no GTM/GA4. Existe porque quase tudo neste
 * tutorial precisa ser digitado exatamente igual do outro lado —
 * `floatvideo.video`, `{{Event}}`, o regex do acionador. Uma letra ou um
 * acento diferente não dá erro em lugar nenhum: o campo simplesmente
 * chega vazio no GA4, e a pessoa descobre semanas depois.
 */
export default function Copiavel({
  texto,
  bloco = false,
}: {
  texto: string;
  /** Ocupa a linha inteira — para valores longos, como o regex. */
  bloco?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLElement>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Sem permissão de área de transferência (navegador antigo, http),
      // seleciona o texto para a pessoa copiar com Ctrl+C. Por referência,
      // e não por id: o mesmo trecho aparece mais de uma vez na página.
      if (ref.current) {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <span
      className={
        bloco
          ? "mt-1 flex items-start gap-1.5"
          : "inline-flex max-w-full items-center gap-1 align-bottom"
      }
    >
      <code
        ref={ref}
        className={`rounded bg-neutral-100 px-1 text-neutral-800 ${
          bloco ? "flex-1 break-all py-0.5" : "whitespace-nowrap"
        }`}
      >
        {texto}
      </code>
      <button
        type="button"
        onClick={copiar}
        aria-label={copiado ? "Copiado" : `Copiar ${texto}`}
        title={copiado ? "Copiado!" : "Copiar"}
        className={`shrink-0 rounded p-0.5 transition ${
          copiado
            ? "text-emerald-600"
            : "text-neutral-400 hover:bg-neutral-100 hover:text-brand-blue"
        }`}
      >
        {copiado ? (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-3.5 w-3.5"
          >
            <path d="M8.2 14.5 4 10.3l1.4-1.4 2.8 2.8 6.4-6.4L16 6.7z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-3.5 w-3.5"
          >
            <path d="M7 2h7a2 2 0 0 1 2 2v9h-2V4H7zM4 5h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2m0 2v9h7V7z" />
          </svg>
        )}
      </button>
    </span>
  );
}
