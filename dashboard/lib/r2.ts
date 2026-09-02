import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2, onde os vídeos enviados passam a morar.
 *
 * O motivo é um só: no R2 se paga para guardar, não para entregar. Como o
 * balão toca para todo visitante, a entrega é o custo que cresce junto com
 * o sucesso do cliente — e era ele que impedia prometer visualizações
 * ilimitadas.
 *
 * O R2 fala o protocolo da S3, então usamos o cliente da AWS apontado para
 * o endereço da Cloudflare. Nada disso roda no navegador: as credenciais
 * ficam só no servidor, e o envio acontece por URL assinada.
 */
export const R2_BUCKET = process.env.R2_BUCKET ?? "";
export const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(
  /\/$/,
  ""
);

export function r2Configurado() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      R2_BUCKET &&
      R2_PUBLIC_BASE_URL
  );
}

export function criarClienteR2() {
  return new S3Client({
    // "auto" é a região que a Cloudflare espera; o endereço é que define
    // a conta.
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

/** Endereço público do arquivo, que é o que vai parar no widget. */
export function urlPublica(chave: string) {
  return `${R2_PUBLIC_BASE_URL}/${chave}`;
}
