import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { gtmConfigurado, urlDeAutorizacao } from "@/lib/gtm";

/** Manda a pessoa ao Google para autorizar o acesso ao Tag Manager. */
export async function GET(request: Request) {
  if (!gtmConfigurado()) {
    return NextResponse.json(
      { error: "Conexão com o Tag Manager não configurada." },
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

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  // A permissão de publicar só é pedida se a pessoa marcou a opção: cada
  // escopo a mais aparece na tela de consentimento e precisa ser
  // justificado na verificação do Google.
  const comPublicacao = url.searchParams.get("publicar") === "1";

  // Guarda contra pedido forjado: o "state" volta do Google e precisa
  // bater com o que ficou no cookie desta pessoa.
  const nonce = crypto.randomUUID();
  const state = Buffer.from(
    JSON.stringify({ projectId, nonce, publicar: comPublicacao })
  ).toString("base64url");

  const jar = await cookies();
  jar.set("fvw_gtm_state", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(
    urlDeAutorizacao(url.origin, state, comPublicacao)
  );
}
