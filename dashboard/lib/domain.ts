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

/**
 * Máscara de telefone brasileiro para exibição: +55 (11) 96713-6667.
 * Aceita fixo de 8 dígitos. Guardamos só os dígitos; a máscara existe
 * para quem digita conferir o número enquanto escreve, em vez de
 * descobrir que errou depois que o widget já está no ar.
 */
export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
  if (!d) return "";
  let out = "+55 (" + d.slice(0, 2);
  if (d.length >= 2) out += ") ";
  if (d.length > 2) {
    const corpo = d.length > 10 ? d.slice(2, 7) : d.slice(2, 6);
    out += corpo;
    const fim = d.length > 10 ? d.slice(7) : d.slice(6);
    if (fim) out += "-" + fim;
  }
  return out;
}

/** Só os dígitos com DDI, como o wa.me espera: 5511967136667. */
export function telefoneParaWhatsApp(valor: string): string {
  const d = valor.replace(/\D/g, "").replace(/^55/, "");
  return d ? "55" + d : "";
}
