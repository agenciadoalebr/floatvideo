import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Encerra a conexão com o Google deste navegador.
 *
 * "Desconectar" aqui é literalmente apagar o token de curta duração que
 * guardamos no cookie — não há nada em banco para remover. Quem quiser
 * tirar a permissão do FloatVideo por completo faz isso na própria conta
 * do Google, em Segurança → Apps de terceiros; isso está dito na tela.
 */
export async function POST() {
  const jar = await cookies();
  jar.delete("fvw_gtm_token");
  jar.delete("fvw_gtm_state");
  return NextResponse.json({ ok: true });
}
