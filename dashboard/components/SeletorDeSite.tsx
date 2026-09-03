"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SiteDoMenu = {
  id: string;
  nome: string;
  dominio: string | null;
  ativo: boolean;
};

/**
 * Troca de site direto no cabeçalho.
 *
 * Antes era preciso voltar a "Seus sites" para ir de um a outro. Para
 * uma agência com cinco lojas, isso é uma ida e volta a cada conferida.
 */
export default function SeletorDeSite({ sites }: { sites: SiteDoMenu[] }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const atual = sites.find((s) => caminho.includes(`/projects/${s.id}`));

  useEffect(() => {
    function foraDaCaixa(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", foraDaCaixa);
    return () => document.removeEventListener("mousedown", foraDaCaixa);
  }, []);

  // Fora de um site não há o que trocar: o cabeçalho fica limpo.
  if (!atual) return null;

  return (
    <div ref={caixa} className="relative flex items-center gap-3">
      <span className="h-8 w-px bg-outline-soft" />

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-surface-soft"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-brand-ink">
            {atual.dominio ?? atual.nome}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-faint">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                atual.ativo ? "bg-emerald-500" : "bg-ink-faint"
              }`}
            />
            {atual.ativo ? "Ativo no site" : "Pausado"}
          </span>
        </span>
        {sites.length > 1 && (
          <span aria-hidden className="text-ink-faint">
            ⌄
          </span>
        )}
      </button>

      {aberto && sites.length > 1 && (
        <div className="cartao-flutuante absolute left-3 top-full z-40 mt-2 w-64 p-1.5">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/dashboard/projects/${site.id}`}
              onClick={() => setAberto(false)}
              className={`block rounded-lg px-3 py-2 text-sm ${
                site.id === atual.id
                  ? "bg-surface-soft font-medium text-brand-ink"
                  : "text-ink-muted hover:bg-surface-soft"
              }`}
            >
              <span className="block truncate">{site.nome}</span>
              <span className="block truncate text-xs text-ink-faint">
                {site.dominio ?? "sem domínio"}
              </span>
            </Link>
          ))}
          <Link
            href="/dashboard"
            onClick={() => setAberto(false)}
            className="mt-1 block rounded-lg border-t border-outline-soft px-3 py-2 text-xs text-ink-muted hover:bg-surface-soft"
          >
            Ver todos os sites
          </Link>
        </div>
      )}

      {atual.dominio && (
        <a
          href={`https://${atual.dominio}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden rounded-lg border border-outline-soft px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue sm:block"
        >
          Ver no site ↗
        </a>
      )}
    </div>
  );
}
