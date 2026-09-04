import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerSessao } from "@/lib/envioCelular";

/**
 * O que já chegou do celular. É esta rota que o computador consulta
 * enquanto o QR code está na tela.
 *
 * Ao contrário das outras duas, esta exige login: ter o token permite
 * mandar arquivo, não ver o que os outros mandaram. Sem essa distinção,
 * um link vazado viraria uma janela para dentro da conta.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { token } = await params;
  const leitura = await lerSessao(token);

  if (!leitura.ok) {
    return NextResponse.json({ error: leitura.erro }, { status: leitura.status });
  }

  // Pelas regras de acesso do banco: se o site não aparece para este
  // usuário, a sessão também não é dele.
  const { data: projeto } = await supabase
    .from("projects")
    .select("id")
    .eq("id", leitura.sessao.project_id)
    .maybeSingle();

  if (!projeto) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: arquivos } = await admin
    .from("arquivos_do_celular")
    .select("id, nome, url, tamanho, created_at")
    .eq("sessao_id", leitura.sessao.id)
    .order("created_at");

  return NextResponse.json({
    arquivos: arquivos ?? [],
    expiraEm: leitura.sessao.expira_em,
  });
}
