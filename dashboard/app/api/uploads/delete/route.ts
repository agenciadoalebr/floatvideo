import { NextResponse } from "next/server";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { criarClienteR2, r2Configurado, R2_BUCKET } from "@/lib/r2";

/**
 * Apaga os arquivos de um vídeo no R2 (o arquivo cheio, a prévia e a
 * miniatura). Mesma regra do envio: só dentro da própria pasta.
 */
export async function POST(request: Request) {
  if (!r2Configurado()) {
    // Vídeo antigo, ainda no Storage do Supabase: nada a fazer aqui, e
    // não é erro.
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { chaves } = await request.json();

  if (!Array.isArray(chaves) || chaves.length === 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const permitidas = chaves.filter(
    (c: unknown) =>
      typeof c === "string" && c.startsWith(`${user.id}/`) && !c.includes("..")
  );

  if (permitidas.length === 0) {
    return NextResponse.json({ error: "Caminho não permitido." }, { status: 403 });
  }

  const cliente = criarClienteR2();
  await cliente.send(
    new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: permitidas.map((Key: string) => ({ Key })) },
    })
  );

  return NextResponse.json({ ok: true, apagados: permitidas.length });
}
