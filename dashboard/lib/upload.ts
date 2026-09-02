/**
 * Envio de arquivo pelo navegador, em duas etapas: o servidor autoriza,
 * o navegador manda direto pro R2.
 *
 * O arquivo não passa pelo nosso servidor — o que evita o limite de
 * tamanho de requisição da Vercel e não gasta banda nossa em nada.
 */
export type ArquivoEnviado = {
  chave: string;
  publicUrl: string;
};

export async function enviarArquivo(
  arquivo: Blob,
  chave: string,
  tipo: "video" | "previa" | "miniatura"
): Promise<ArquivoEnviado> {
  const contentType = arquivo.type || "application/octet-stream";

  const autorizacao = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chave, tipo, contentType, tamanho: arquivo.size }),
  });

  const dados = await autorizacao.json();
  if (!autorizacao.ok) {
    throw new Error(dados.error ?? "Não foi possível autorizar o envio.");
  }

  const envio = await fetch(dados.url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      // Precisa ser igual ao que foi assinado, senão o R2 recusa.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: arquivo,
  });

  if (!envio.ok) {
    throw new Error("Falha ao enviar o arquivo (" + envio.status + ").");
  }

  return { chave, publicUrl: dados.publicUrl };
}

/** Apaga no R2 os arquivos de um vídeo. Nunca derruba a exclusão. */
export async function apagarArquivos(chaves: (string | null | undefined)[]) {
  const lista = chaves.filter(Boolean);
  if (lista.length === 0) return;
  try {
    await fetch("/api/uploads/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chaves: lista }),
    });
  } catch {
    // Arquivo órfão no bucket custa centavos; travar a exclusão do vídeo
    // por causa disso custaria a confiança de quem clicou.
  }
}
