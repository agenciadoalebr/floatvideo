import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    // A raiz e a pagina de vendas: quem chega ali ainda nao tem conta.
    request.nextUrl.pathname === "/" ||
    // Politica e termos precisam abrir sem login — inclusive pro Google,
    // que exige a politica publica pra verificar o app.
    // A tela de compra e publica: e ela que cria a conta.
    request.nextUrl.pathname.startsWith("/assinar") ||
    request.nextUrl.pathname.startsWith("/privacidade") ||
    request.nextUrl.pathname.startsWith("/termos") ||
    // O Asaas chama este endereco de servidor pra servidor: nao ha sessao
    // pra checar, e um redirecionamento pro login seria lido como falha
    // de entrega. Quem autentica ali e o token no cabecalho.
    request.nextUrl.pathname.startsWith("/api/asaas/webhook") ||
    // O convite de equipe: quem abre o link ainda nao tem conta, e o
    // token do link e que faz as vezes de credencial.
    request.nextUrl.pathname.startsWith("/convite") ||
    request.nextUrl.pathname.startsWith("/api/convite") ||
    // O envio pelo celular: quem abre o QR code nao tem sessao naquele
    // aparelho, e o token do link e que autoriza mandar o arquivo. A
    // rota que LISTA o que chegou fica de fora desta lista de proposito
    // — ela exige login, porque ver o que ja veio e outra coisa.
    request.nextUrl.pathname.startsWith("/enviar") ||
    /^\/api\/envio-celular\/[^/]+\/(presign|registrar)$/.test(
      request.nextUrl.pathname
    ) ||
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth") ||
    request.nextUrl.pathname.startsWith("/setup") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
