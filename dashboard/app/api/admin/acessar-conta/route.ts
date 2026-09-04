import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Entrar na conta de um cliente, para dar suporte.
 *
 * Três coisas que precisam estar claras para quem mexer nisto depois:
 *
 * 1. Isto é acesso completo. Quem entra passa a ser aquela pessoa dentro
 *    do painel, com os mesmos poderes dela — inclusive apagar coisas.
 *    Não existe modo "só leitura" aqui.
 * 2. A sessão de quem entrou é substituída pela do cliente. Para voltar a
 *    ser você, é preciso sair e entrar de novo.
 * 3. O acesso é registrado antes de acontecer, com IP e navegador. O
 *    registro vem primeiro de propósito: se gravasse depois, uma falha no
 *    meio deixaria o acesso sem rastro.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: ehAdmin } = await supabase.rpc("e_admin_da_plataforma");
  if (!ehAdmin) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { organizationId, motivo } = await request.json();
  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }

  // O motivo é obrigatório: é o que transforma o registro em algo que dá
  // para auditar depois. "Entrou na conta" sem porquê não responde nada.
  if (typeof motivo !== "string" || motivo.trim().length < 5) {
    return NextResponse.json(
      { error: "Descreva o motivo do acesso (ao menos 5 caracteres)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: conta } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (!conta) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  // Entra como o dono: é quem enxerga tudo dentro da conta.
  // Duas consultas, e não um join: a chave de organization_members
  // aponta para auth.users, não para profiles, então o PostgREST não
  // traz o perfil junto — e falha em silêncio, o que aqui virava
  // "esta conta não tem dono" numa conta que tem.
  const { data: dono } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: perfil } = dono
    ? await admin
        .from("profiles")
        .select("email")
        .eq("id", dono.user_id)
        .maybeSingle()
    : { data: null };

  const email = perfil?.email;

  if (!email) {
    return NextResponse.json(
      { error: "Esta conta não tem um dono com e-mail para acessar." },
      { status: 400 }
    );
  }

  if (dono?.user_id === user.id) {
    return NextResponse.json(
      { error: "Esta conta já é a sua." },
      { status: 400 }
    );
  }

  await registrarAuditoria({
    ator: user.id,
    atorEmail: user.email ?? "",
    acao: "acessou_como_cliente",
    organizationId,
    contaNome: conta.name,
    detalhe: `Entrou como ${email}. Motivo: ${motivo.trim()}`,
    request,
  });

  // O link pronto do Supabase não serve aqui: ele devolve o token no
  // fragmento da URL (#access_token=...), que só o navegador enxerga.
  // Este painel guarda sessão em cookie, lida no servidor — o token no
  // fragmento passava batido e a sessão do administrador continuava de pé.
  //
  // Então usamos só o token do link e trocamos ele por uma sessão aqui
  // mesmo, no servidor. O verifyOtp escreve os cookies na resposta, e o
  // navegador volta ao painel já como o cliente.
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !link?.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível gerar o acesso." },
      { status: 502 }
    );
  }

  const { error: erroDaTroca } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });

  if (erroDaTroca) {
    return NextResponse.json(
      { error: erroDaTroca.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, email });
}
