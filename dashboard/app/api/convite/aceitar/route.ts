import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Aceitar um convite de equipe.
 *
 * Quem chega aqui não está autenticado — o token do link é a única
 * credencial. Por isso nada do que o navegador manda é usado para
 * decidir em qual conta a pessoa entra: conta, papel e e-mail saem do
 * convite guardado no banco, achado por aquele token.
 */
export async function POST(request: Request) {
  const { token, nome, senha } = await request.json();

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Convite inválido." }, { status: 400 });
  }

  if (typeof senha !== "string" || senha.length < 8) {
    return NextResponse.json(
      { error: "Use uma senha com pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: convite } = await admin
    .from("invites")
    .select("id, email, role, organization_id, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!convite) {
    return NextResponse.json(
      { error: "Este convite não existe mais." },
      { status: 404 }
    );
  }

  if (convite.accepted_at) {
    return NextResponse.json(
      { error: "Este convite já foi usado. Faça login com o seu e-mail." },
      { status: 409 }
    );
  }

  if (new Date(convite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Este convite venceu. Peça um novo para quem te convidou." },
      { status: 410 }
    );
  }

  // Já ter conta no FloatVideo é comum: agência que atende vários
  // clientes, por exemplo. Nesse caso a pessoa entra na equipe com a
  // senha que já tem — trocar a senha dela por causa de um convite de
  // terceiro seria sequestrar o acesso dela.
  const { data: perfil } = await admin
    .from("profiles")
    .select("id")
    .eq("email", convite.email)
    .maybeSingle();

  if (perfil) {
    await admin
      .from("organization_members")
      .upsert(
        {
          organization_id: convite.organization_id,
          user_id: perfil.id,
          role: convite.role,
        },
        { onConflict: "organization_id,user_id", ignoreDuplicates: true }
      );

    await admin
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", convite.id);

    return NextResponse.json({ ok: true, jaTinhaConta: true });
  }

  // O invite_id vai junto para o gatilho do banco saber exatamente qual
  // convite aceitar, e não chutar pelo e-mail.
  const { error: erroDeCriacao } = await admin.auth.admin.createUser({
    email: convite.email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      name: typeof nome === "string" && nome.trim() ? nome.trim() : null,
      invite_id: convite.id,
    },
  });

  if (erroDeCriacao) {
    return NextResponse.json(
      { error: erroDeCriacao.message },
      { status: 502 }
    );
  }

  // Entrar já: a pessoa acabou de escolher a senha, pedir para digitar
  // de novo numa tela de login seria só atrito. O signInWithPassword no
  // cliente do servidor é o que escreve os cookies da sessão.
  const supabase = await createClient();
  const { error: erroDeLogin } = await supabase.auth.signInWithPassword({
    email: convite.email,
    password: senha,
  });

  if (erroDeLogin) {
    return NextResponse.json({ ok: true, precisaEntrar: true });
  }

  return NextResponse.json({ ok: true });
}
