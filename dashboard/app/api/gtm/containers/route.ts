import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  listarContas,
  listarContainersDaConta,
  instalarNoContainer,
} from "@/lib/gtm";

// Listar contêineres de uma conta de agência custa uma chamada por
// cliente, e ainda pode haver espera por causa da cota do Google.
export const maxDuration = 30;

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

/**
 * Sem "conta" na consulta, devolve as contas. Com ela, os contêineres
 * daquela conta. Uma chamada ao Google em cada caso — é o que mantém a
 * conexão viável numa agência com dezenas de clientes.
 */
export async function GET(request: Request) {
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

  const conta = new URL(request.url).searchParams.get("conta");

  try {
    if (!conta) {
      return NextResponse.json({ contas: await listarContas(token) });
    }
    if (!conta.startsWith("accounts/")) {
      return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
    }
    return NextResponse.json({
      containers: await listarContainersDaConta(token, conta),
    });
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
