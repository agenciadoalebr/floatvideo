import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Antes deste arquivo o endereço não existia e caía no proxy, que
 * mandava para o /login — um rastreador pedindo permissão recebia uma
 * tela de senha. Quem verifica o app no Google costuma ler o robots
 * antes de buscar a política de privacidade, então valia como tropeço.
 *
 * O painel fica de fora: são páginas de conta, sem nada a indexar.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/", "/completar-cadastro", "/setup"],
    },
  };
}
