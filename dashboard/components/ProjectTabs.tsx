"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export type Tab = {
  id: string;
  label: string;
  /** Desenho ao lado do rótulo, para reconhecer a seção sem ler. */
  icone?: ReactNode;
  /** Numero opcional ao lado do rotulo (ex.: quantidade de leads). */
  count?: number;
  /** Assunto ao qual a seção pertence, para agrupar no menu. */
  grupo?: string;
  content: ReactNode;
};

/**
 * Navegação do projeto, em menu lateral.
 *
 * Era uma fila de abas horizontais. Com oito seções, os nomes começavam a
 * competir por espaço e, no celular, viravam uma barra de rolagem em que
 * metade ficava escondida. Na vertical cabe o nome inteiro, cabe o
 * agrupamento por assunto, e sobra largura para o conteúdo — que é onde a
 * pessoa realmente trabalha.
 *
 * O conteúdo continua vindo pronto do servidor via children: as consultas
 * ficam lá, e só a troca de seção roda no navegador.
 */
export default function ProjectTabs({
  tabs,
  rodape,
}: {
  tabs: Tab[];
  /** Bloco preso ao pé do menu — o estado do widget e o suporte. */
  rodape?: ReactNode;
}) {
  // "?secao=" permite voltar direto a uma seção — é o que traz a pessoa
  // de volta ao Analytics depois de autorizar no Google, em vez de
  // largá-la na primeira seção do projeto.
  const params = useSearchParams();
  const pedida = params.get("secao");
  const [active, setActive] = useState(
    pedida && tabs.some((t) => t.id === pedida) ? pedida : tabs[0]?.id
  );

  // Botoes de outras partes da tela ("Editar widget", "Ver metricas" no
  // card do video) pedem a troca de secao por evento de janela, em vez de
  // erguer esse estado ate a pagina inteira.
  useEffect(() => {
    function handle(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id && tabs.some((t) => t.id === id)) setActive(id);
    }
    window.addEventListener("fvw-goto-tab", handle);
    return () => window.removeEventListener("fvw-goto-tab", handle);
  }, [tabs]);

  // Mantém a ordem em que as seções chegaram, agrupando as vizinhas de
  // mesmo assunto. Sem grupo, cai num bloco sem título.
  const grupos: { nome: string | null; itens: Tab[] }[] = [];
  for (const tab of tabs) {
    const nome = tab.grupo ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nome === nome) ultimo.itens.push(tab);
    else grupos.push({ nome, itens: [tab] });
  }

  function Item({ tab }: { tab: Tab }) {
    const on = tab.id === active;
    return (
      <button
        type="button"
        onClick={() => setActive(tab.id)}
        aria-current={on ? "page" : undefined}
        className={`flex w-full shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
          on
            ? "bg-surface-strong font-medium text-brand-ink"
            : "text-ink-muted hover:bg-surface-soft hover:text-brand-ink"
        }`}
      >
        {tab.icone && (
          <span
            aria-hidden
            className={on ? "text-brand-blue" : "text-ink-faint"}
          >
            {tab.icone}
          </span>
        )}
        <span className="flex-1 whitespace-nowrap">{tab.label}</span>
        {typeof tab.count === "number" && tab.count > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              on
                ? "bg-brand-blue/10 text-brand-blue"
                : "bg-surface-muted text-ink-faint"
            }`}
          >
            {tab.count}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="gap-8 lg:flex lg:items-start">
      {/* Celular: uma faixa que rola na horizontal, sem títulos de grupo —
          na largura de um telefone, o agrupamento custaria mais altura do
          que ajuda. */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
        {tabs.map((tab) => (
          <Item key={tab.id} tab={tab} />
        ))}
      </nav>

      {/* 260px, como manda o sistema de design. Preso abaixo do
          cabeçalho, que tem 65px de altura. */}
      <nav className="hidden w-[260px] shrink-0 flex-col gap-5 lg:sticky lg:top-[81px] lg:flex lg:max-h-[calc(100vh-105px)]">
        <div className="flex-1 space-y-5 overflow-y-auto">
          {grupos.map((g, i) => (
            <div key={g.nome ?? `grupo-${i}`} className="space-y-1">
              {g.nome && (
                <p className="rotulo-metrica px-3 pb-1">{g.nome}</p>
              )}
              {g.itens.map((tab) => (
                <Item key={tab.id} tab={tab} />
              ))}
            </div>
          ))}
        </div>
        {rodape && <div className="space-y-2">{rodape}</div>}
      </nav>

      {/* Todas as seções ficam montadas e a inativa é apenas escondida: o
          painel de métricas guarda qual vídeo está selecionado, e
          desmontar zeraria essa escolha ao trocar de seção e voltar. */}
      <div className="min-w-0 flex-1">
        {tabs.map((tab) => (
          <div key={tab.id} hidden={tab.id !== active} className="pt-4 lg:pt-0">
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
