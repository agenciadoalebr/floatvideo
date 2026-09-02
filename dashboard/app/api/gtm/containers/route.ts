import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listarContainers, instalarNoContainer } from "@/lib/gtm";

async function tokenDaSessao() {
  const jar = await cookies();
  return jar.get("fvw_gtm_token")?.value ?? null;
}

async function exigirLogin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Contêineres aos quais a pessoa deu acesso, para ela escolher um. */
export async function GET() {
  if (!(await exigirLogin())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const token = await tokenDaSessao();
  if (!token) {
    return NextResponse.json(
      { error: "Conexão expirada. Conecte de novo." },
      { status: 440 }
    );
  }

  try {
    return NextResponse.json({ containers: await listarContainers(token) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao listar." },
      { status: 502 }
    );
  }
}

/** Cria variáveis, acionador e tag no contêiner escolhido. */
export async function POST(request: Request) {
  if (!(await exigirLogin())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const token = await tokenDaSessao();
  if (!token) {
    return NextResponse.json(
      { error: "Conexão expirada. Conecte de novo." },
      { status: 440 }
    );
  }

  const { containerPath, measurementId } = await request.json();

  if (typeof containerPath !== "string" || !containerPath.startsWith("accounts/")) {
    return NextResponse.json({ error: "Contêiner inválido." }, { status: 400 });
  }

  try {
    const resultado = await instalarNoContainer(
      token,
      containerPath,
      typeof measurementId === "string" && measurementId.trim()
        ? measurementId.trim()
        : undefined
    );

    // Trabalho feito: o token deixa de existir aqui também. Ele já não
    // estava no banco; agora não está nem no navegador.
    const jar = await cookies();
    jar.delete("fvw_gtm_token");

    return NextResponse.json(resultado);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao criar." },
      { status: 502 }
    );
  }
}
