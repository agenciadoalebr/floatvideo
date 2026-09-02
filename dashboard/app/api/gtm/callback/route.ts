import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { gtmConfigurado, trocarCodigoPorToken } from "@/lib/gtm";

/**
 * Volta do Google com o código, troca pelo token e devolve a pessoa ao
 * projeto para escolher o contêiner.
 *
 * O token vai num cookie próprio, httpOnly e de 15 minutos — nunca no
 * banco. Ele existe só pelo tempo de escolher o contêiner e criar a
 * configuração; depois disso é apagado.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();

  function voltar(projectId: string, erro?: string) {
    const destino = new URL(
      projectId ? `/dashboard/projects/${projectId}` : "/dashboard",
      url.origin
    );
    destino.searchParams.set("gtm", erro ? "erro" : "conectado");
    if (erro) destino.searchParams.set("motivo", erro);
    return NextResponse.redirect(destino);
  }

  if (!gtmConfigurado()) return voltar("", "nao-configurado");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const codigo = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";

  let projectId = "";
  let nonce = "";
  try {
    const dados = JSON.parse(Buffer.from(state, "base64url").toString());
    projectId = dados.projectId ?? "";
    nonce = dados.nonce ?? "";
  } catch {
    return voltar("", "state-invalido");
  }

  if (!codigo || !nonce || nonce !== jar.get("fvw_gtm_state")?.value) {
    return voltar(projectId, "state-invalido");
  }

  jar.delete("fvw_gtm_state");

  try {
    const token = await trocarCodigoPorToken(codigo, url.origin);
    jar.set("fvw_gtm_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 900,
      path: "/",
    });
  } catch {
    return voltar(projectId, "falha-na-troca");
  }

  return voltar(projectId);
}
