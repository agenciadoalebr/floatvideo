import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // O Google devolve o erro pela URL quando a pessoa fecha a janela ou
  // recusa. Sem tratar, ela voltaria para o login sem entender o que
  // aconteceu — nem que nada aconteceu.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?erro=google`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Entrar pelo Google não é ter conta: quem chega sem organização
      // veio pela porta do Google sem convite, e o convite é cobrado na
      // tela seguinte.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { count } = await supabase
          .from("organization_members")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (!count) {
          return NextResponse.redirect(`${origin}/completar-cadastro`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
