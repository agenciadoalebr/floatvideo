"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconeVideos,
  IconeUpload,
  IconeWidget,
  IconeBotao,
  IconeCodigo,
  IconeAnalytics,
  IconeLeads,
  IconeMetricas,
} from "@/components/IconesDoMenu";

export type ItemDoMenu = {
  id: string;
  rotulo: string;
  grupo: string;
  icone: ReactNode;
};

export const SECOES: ItemDoMenu[] = [
  { id: "videos", rotulo: "Vídeos", grupo: "Conteúdo", icone: IconeVideos },
  { id: "upload", rotulo: "Upload", grupo: "Conteúdo", icone: IconeUpload },
  { id: "widget", rotulo: "Widget", grupo: "Aparência", icone: IconeWidget },
  {
    id: "cta",
    rotulo: "Botão de ação",
    grupo: "Aparência",
    icone: IconeBotao,
  },
  {
    id: "instalacao",
    rotulo: "Instalação",
    grupo: "Publicação",
    icone: IconeCodigo,
  },
  {
    id: "analytics",
    rotulo: "Analytics do site",
    grupo: "Publicação",
    icone: IconeAnalytics,
  },
  { id: "leads", rotulo: "Leads", grupo: "Resultados", icone: IconeLeads },
  {
    id: "metricas",
    rotulo: "Métricas",
    grupo: "Resultados",
    icone: IconeMetricas,
  },
];

export const SECAO_PADRAO = "videos";

export function secaoValida(valor: string | undefined) {
  return valor && SECOES.some((s) => s.id === valor) ? valor : SECAO_PADRAO;
}

/**
 * Menu do site, coluna fixa à esquerda.
 *
 * A seção vive na URL, e não em estado de componente. Isso é o que faz o
 * botão de voltar do navegador funcionar entre as seções, o link de uma
 * seção poder ser compartilhado, e o menu poder morar no layout enquanto
 * o conteúdo mora na página.
 */
export default function MenuDoSite({
  projectId,
  contagens,
  rodape,
}: {
  projectId: string;
  contagens: Record<string, number>;
  rodape: ReactNode;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const atual = secaoValida(params.get("secao") ?? undefined);

  // Botões espalhados pela tela ("Editar widget" no card do vídeo,
  // "Alterar" no bloco do CTA) pedem a troca por evento. Aqui esse
  // pedido vira navegação de verdade, sem cada um deles precisar saber
  // como o menu funciona.
  useEffect(() => {
    function aoPedir(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id && SECOES.some((s) => s.id === id)) {
        router.push(`${caminho}?secao=${id}`, { scroll: false });
      }
    }
    window.addEventListener("fvw-goto-tab", aoPedir);
    return () => window.removeEventListener("fvw-goto-tab", aoPedir);
  }, [router, caminho]);

  const grupos: { nome: string; itens: ItemDoMenu[] }[] = [];
  for (const secao of SECOES) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nome === secao.grupo) ultimo.itens.push(secao);
    else grupos.push({ nome: secao.grupo, itens: [secao] });
  }

  function Item({ secao }: { secao: ItemDoMenu }) {
    const on = secao.id === atual;
    const conta = contagens[secao.id];
    return (
      <Link
        href={`/dashboard/projects/${projectId}?secao=${secao.id}`}
        scroll={false}
        aria-current={on ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
          on
            ? "bg-surface-strong font-medium text-brand-ink"
            : "text-ink-muted hover:bg-surface-soft hover:text-brand-ink"
        }`}
      >
        <span aria-hidden className={on ? "text-brand-blue" : "text-ink-faint"}>
          {secao.icone}
        </span>
        <span className="flex-1 whitespace-nowrap">{secao.rotulo}</span>
        {typeof conta === "number" && conta > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              on
                ? "bg-brand-blue/10 text-brand-blue"
                : "bg-surface-muted text-ink-faint"
            }`}
          >
            {conta}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Celular: faixa que rola na horizontal. Na largura de um telefone,
          uma coluna fixa comeria metade da tela. */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
        {SECOES.map((secao) => (
          <span key={secao.id} className="shrink-0">
            <Item secao={secao} />
          </span>
        ))}
      </nav>

      <nav className="hidden w-[260px] shrink-0 border-r border-outline-soft bg-surface-card lg:block">
        <div className="sticky top-[65px] flex h-[calc(100vh-65px)] flex-col gap-5 overflow-y-auto px-4 py-6">
          <div className="flex-1 space-y-5">
            {grupos.map((g) => (
              <div key={g.nome} className="space-y-1">
                <p className="rotulo-metrica px-3 pb-1">{g.nome}</p>
                {g.itens.map((secao) => (
                  <Item key={secao.id} secao={secao} />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-2">{rodape}</div>
        </div>
      </nav>
    </>
  );
}
