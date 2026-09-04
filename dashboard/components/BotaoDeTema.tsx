"use client";

import { useSyncExternalStore } from "react";

export type Tema = "claro" | "escuro";

const CHAVE = "fv-tema";

/**
 * Script que roda antes da primeira pintura.
 *
 * Sem isto, a página nasce clara e escurece um instante depois — o
 * "flash" branco na cara de quem escolheu o modo noturno, que é
 * justamente quem está no escuro. Por isso ele é inline no <head> e não
 * um efeito de componente: qualquer coisa que espere o React já é tarde.
 *
 * Só entra no escuro quem pediu. Seguir a preferência do sistema levaria
 * a landing page junto, e ela não foi desenhada para o escuro — visitante
 * de primeira viagem receberia uma página que ninguém conferiu.
 */
export const SCRIPT_DO_TEMA = `(function(){try{
if(localStorage.getItem("${CHAVE}")==="escuro"){document.documentElement.dataset.tema="escuro";}
}catch(e){}})();`;

/**
 * O tema mora no próprio <html>, escrito pelo script acima — não num
 * estado do React. Este punhado de funções é a ponte: useSyncExternalStore
 * lê de lá e sabe se virar na hidratação, quando o servidor ainda não
 * tinha como conhecer a preferência de quem abriu.
 */
const ouvintes = new Set<() => void>();

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

function lerTema(): Tema {
  return document.documentElement.dataset.tema === "escuro"
    ? "escuro"
    : "claro";
}

/** No servidor não há <html> para consultar; o claro é o padrão. */
function noServidor(): Tema {
  return "claro";
}

/** A chavinha de dia/noite. */
export default function BotaoDeTema() {
  const tema = useSyncExternalStore(assinar, lerTema, noServidor);

  function alternar() {
    const novo: Tema = tema === "escuro" ? "claro" : "escuro";

    if (novo === "escuro") {
      document.documentElement.dataset.tema = "escuro";
    } else {
      delete document.documentElement.dataset.tema;
    }

    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Navegador com armazenamento bloqueado: o tema vale nesta aba e
      // volta ao padrão na próxima. Melhor que não deixar trocar.
    }

    ouvintes.forEach((avisar) => avisar());
  }

  const escuro = tema === "escuro";

  return (
    <button
      type="button"
      onClick={alternar}
      role="switch"
      aria-checked={escuro}
      aria-label={escuro ? "Voltar ao modo claro" : "Ativar o modo noturno"}
      title={escuro ? "Modo claro" : "Modo noturno"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-soft hover:text-brand-ink"
    >
      {escuro ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-5 w-5"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
