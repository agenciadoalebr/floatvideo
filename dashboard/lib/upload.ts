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
  tipo: "video" | "previa" | "miniatura",
  /**
   * Progresso real do envio, de 0 a 100. Sem isto a tela só saberia
   * dizer "enviando" — e num vídeo de 80 MB isso é uma barra parada por
   * minutos, que a pessoa lê como travamento.
   */
  aoProgredir?: (pct: number) => void
): Promise<ArquivoEnviado> {
  const contentType = arquivo.type || "application/octet-stream";

  const autorizacao = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chave, tipo, contentType, tamanho: arquivo.size }),
  });

  // Sessão expirada não devolve JSON: o middleware manda pro login, e a
  // resposta vira a página HTML inteira. Sem esta conferência, o erro que
  // a pessoa via era um "unexpected token <" — que não diz nada.
  if (autorizacao.redirected || !autorizacao.headers.get("content-type")?.includes("json")) {
    throw new Error("Sua sessão expirou. Entre de novo e repita o envio.");
  }

  const dados = await autorizacao.json();
  if (!autorizacao.ok) {
    throw new Error(dados.error ?? "Não foi possível autorizar o envio.");
  }

  // XMLHttpRequest, e não fetch, só por causa do progresso: o fetch não
  // informa quanto do corpo já subiu.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", dados.url);
    xhr.setRequestHeader("Content-Type", contentType);
    // Precisa ser igual ao que foi assinado, senão o R2 recusa.
    xhr.setRequestHeader("Cache-Control", "public, max-age=31536000, immutable");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && aoProgredir) {
        aoProgredir(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Falha ao enviar o arquivo (" + xhr.status + ")."));
    xhr.onerror = () => reject(new Error("Falha de conexão ao enviar o arquivo."));
    xhr.send(arquivo);
  });

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
