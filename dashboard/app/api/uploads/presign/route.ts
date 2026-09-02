import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import {
  criarClienteR2,
  r2Configurado,
  urlPublica,
  R2_BUCKET,
} from "@/lib/r2";

/** Tipos que o painel envia. Nada além disso entra no bucket. */
const TIPOS_ACEITOS: Record<string, string[]> = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  previa: ["video/mp4"],
  miniatura: ["image/jpeg"],
};

const TAMANHO_MAXIMO = 500 * 1024 * 1024; // 500MB, o mesmo limite do painel

/**
 * Devolve uma autorização temporária para o navegador enviar um arquivo
 * direto ao R2.
 *
 * O R2 não conhece os nossos usuários — quem confere quem pode escrever
 * onde é este endpoint. A regra é a mesma que a do Storage do Supabase
 * que ele substitui: cada pessoa só escreve dentro da própria pasta.
 */
export async function POST(request: Request) {
  if (!r2Configurado()) {
    return NextResponse.json(
      { error: "Armazenamento de vídeos não configurado." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { chave, tipo, contentType, tamanho } = await request.json();

  if (typeof chave !== "string" || !TIPOS_ACEITOS[tipo]) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // A pasta de quem envia é o id dele. Sem isso, uma pessoa poderia
  // escrever por cima do vídeo de outra só mudando o caminho.
  if (!chave.startsWith(`${user.id}/`) || chave.includes("..")) {
    return NextResponse.json({ error: "Caminho não permitido." }, { status: 403 });
  }

  if (!TIPOS_ACEITOS[tipo].includes(contentType)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não aceito." },
      { status: 400 }
    );
  }

  if (typeof tamanho === "number" && tamanho > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "Arquivo grande demais." }, { status: 400 });
  }

  const cliente = criarClienteR2();
  const url = await getSignedUrl(
    cliente,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: chave,
      ContentType: contentType,
      // Um ano de cache: o arquivo nunca muda de conteúdo, só de nome.
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300 }
  );

  return NextResponse.json({ url, publicUrl: urlPublica(chave) });
}
