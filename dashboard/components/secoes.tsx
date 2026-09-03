import type { ReactNode } from "react";
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

/**
 * As seções de um site.
 *
 * Módulo neutro de propósito, sem "use client": a lista é lida dos dois
 * lados da fronteira — o menu (navegador) desenha os itens, e a página
 * (servidor) decide qual seção montar. Deixar isso dentro do componente
 * de menu fazia o servidor chamar uma função do cliente, que é erro de
 * execução e não de compilação — ou seja, só aparece em produção.
 */
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
  { id: "cta", rotulo: "Botão de ação", grupo: "Aparência", icone: IconeBotao },
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

/** Seção pedida na URL, ou a primeira quando o valor não existe. */
export function secaoValida(valor: string | undefined) {
  return valor && SECOES.some((s) => s.id === valor) ? valor : SECAO_PADRAO;
}
