import type { BuyPlatform } from "@/lib/types";

/**
 * Plataformas de e-commerce que o botão Comprar sabe reconhecer.
 *
 * Aqui ficam só os rótulos: os seletores CSS de cada plataforma vivem no
 * player.js (SELETORES_COMPRA), que é quem roda no site do cliente. O
 * painel não precisa deles — só precisa saber o que oferecer na lista.
 */
export const PLATAFORMAS: {
  valor: BuyPlatform;
  nome: string;
  ajuda: string;
}[] = [
  {
    valor: "auto",
    nome: "Detectar sozinho (recomendado)",
    ajuda:
      "Procura o botão de compra de todas as plataformas conhecidas e, se nenhuma casar, procura pelo texto do botão.",
  },
  {
    valor: "vtex",
    nome: "VTEX",
    ajuda: "Serve tanto para a VTEX IO quanto para a Legacy (CMS).",
  },
  {
    valor: "loja_integrada",
    nome: "Loja Integrada",
    ajuda: "Botão padrão da Loja Integrada e dos temas mais usados.",
  },
  {
    valor: "nuvemshop",
    nome: "Nuvemshop",
    ajuda: "Nuvemshop / Tiendanube, incluindo temas com carrinho lateral.",
  },
  {
    valor: "woocommerce",
    nome: "WordPress (WooCommerce)",
    ajuda: "Botão de adicionar ao carrinho do WooCommerce.",
  },
  {
    valor: "shopify",
    nome: "Shopify",
    ajuda: "Formulário de carrinho e botão de compra expressa da Shopify.",
  },
  {
    valor: "wix",
    nome: "Wix",
    ajuda: "Loja da Wix (Wix Stores).",
  },
  {
    valor: "tray",
    nome: "Tray",
    ajuda: "Botão comprar da Tray e dos temas derivados.",
  },
  {
    valor: "custom",
    nome: "Outra plataforma (informar o seletor)",
    ajuda: "Para lojas feitas sob medida ou tema muito customizado.",
  },
];
