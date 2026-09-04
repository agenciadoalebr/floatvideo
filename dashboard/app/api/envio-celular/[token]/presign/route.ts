import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { criarClienteR2, r2Configurado, urlPublica, R2_BUCKET } from "@/lib/r2";
import { lerSessao } from "@/lib/envioCelular";

const TIPOS_ACEITOS = ["video/mp4", "video/webm", "video/quicktime"];
const TAMANHO_MAXIMO = 500 * 1024 * 1024;

/**
 * Autoriza o celular a mandar um vídeo direto para o R2.
 *
 * É o mesmo mecanismo do painel, com uma diferença que importa: aqui não
 * existe usuário logado. Quem responde pelo envio é o token do link, e
 * por isso o caminho do arquivo é montado aqui a partir da sessão — o
 * celular não escolhe onde escreve.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!r2Configurado()) {
    return NextResponse.json(
      { error: "Armazenamento de vídeos não configurado." },
      { status: 503 }
    );
  }

  const { token } = await params;
  const leitura = await lerSessao(token);

  if (!leitura.ok) {
    return NextResponse.json({ error: leitura.erro }, { status: leitura.status });
  }

  const { contentType, tamanho, nome } = await request.json();

  if (!TIPOS_ACEITOS.includes(contentType)) {
    return NextResponse.json(
      { error: "Envie um vídeo em MP4, WebM ou MOV." },
      { status: 400 }
    );
  }

  if (typeof tamanho !== "number" || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "O arquivo excede o limite de 500MB." },
      { status: 400 }
    );
  }

  const extensao =
    typeof nome === "string" && /\.[a-z0-9]{2,4}$/i.test(nome)
      ? nome.match(/\.[a-z0-9]{2,4}$/i)![0].toLowerCase()
      : ".mp4";

  // Pasta da própria sessão: um link não alcança arquivo de outro.
  const chave = `celular/${leitura.sessao.id}/${Date.now()}${extensao}`;

  const url = await getSignedUrl(
    criarClienteR2(),
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: chave,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 600 }
  );

  return NextResponse.json({ url, chave, publicUrl: urlPublica(chave) });
}
