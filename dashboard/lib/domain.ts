/**
 * Reduz o que a pessoa digitou ao hostname puro: "https://www.Site.com.br/x"
 * vira "site.com.br". A RPC get_widget_config compara a origem do site do
 * cliente contra esse valor já normalizado (aceitando o domínio exato ou
 * qualquer subdomínio), então guardar com protocolo, "www." ou barra final
 * faria a comparação falhar e o widget simplesmente não apareceria.
 */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .trim();
}

/** Checagem simples de formato: algo.algo, sem espaços. */
export function isValidDomain(domain: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain);
}
