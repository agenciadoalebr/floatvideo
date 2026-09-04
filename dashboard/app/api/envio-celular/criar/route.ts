import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Abre uma sessão de envio pelo celular e devolve o link do QR code.
 *
 * Só quem já tem acesso ao site pode abrir — o link resultante permite
 * mandar arquivo para esta conta sem nenhum login, e é por isso que ele
 * vale só uma hora (o prazo está no padrão da coluna).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { projectId } = await request.json();

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "Site inválido." }, { status: 400 });
  }

  // A consulta passa pelo cliente do usuário, e não pelo de serviço: são
  // as regras de acesso do banco que dizem se este site é dele. Repetir
  // essa checagem na mão aqui seria uma segunda verdade para manter.
  const { data: projeto } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!projeto) {
    return NextResponse.json(
      { error: "Site não encontrado nesta conta." },
      { status: 404 }
    );
  }

  const admin = createAdminClient();

  const { data: sessao, error } = await admin
    .from("sessoes_de_envio")
    .insert({ project_id: projectId, criado_por: user.id })
    .select("token, expira_em")
    .single();

  if (error || !sessao) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível abrir o envio." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    token: sessao.token,
    expiraEm: sessao.expira_em,
  });
}
