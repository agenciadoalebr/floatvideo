"use client";

import { useEffect, useState, type ReactNode } from "react";

export type Tab = {
  id: string;
  label: string;
  /** Numero opcional ao lado do rotulo (ex.: quantidade de leads). */
  count?: number;
  content: ReactNode;
};

/**
 * Abas do projeto. Recebe o conteudo ja renderizado no servidor via
 * children — Server Components podem ser passados como ReactNode para um
 * Client Component, entao as consultas ao banco continuam no servidor e
 * so a troca de aba roda no browser.
 *
 * Antes as quatro secoes ficavam empilhadas numa pagina so, e era preciso
 * rolar muito pra chegar nas metricas. Ferramentas equivalentes
 * (VideoAsk, Tolstoy, Vidyard) resolvem isso com abas dentro do projeto.
 */
export default function ProjectTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  // Botoes de outras partes da tela ("Editar widget", "Ver metricas" no
  // card do video) pedem a troca de aba por evento de janela, em vez de
  // erguer esse estado ate a pagina inteira.
  useEffect(() => {
    function handle(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id && tabs.some((t) => t.id === id)) setActive(id);
    }
    window.addEventListener("fvw-goto-tab", handle);
    return () => window.removeEventListener("fvw-goto-tab", handle);
  }, [tabs]);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              aria-current={on ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                on
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                    on ? "bg-brand-blue text-white" : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Todas as abas ficam montadas e a inativa e apenas escondida: o
          painel de metricas guarda qual video esta selecionado, e
          desmontar zeraria essa escolha ao trocar de aba e voltar. */}
      {tabs.map((tab) => (
        <div key={tab.id} hidden={tab.id !== active} className="pt-6">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
