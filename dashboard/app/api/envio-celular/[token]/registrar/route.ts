import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerSessao } from "@/lib/envioCelular";
import { R2_PUBLIC_BASE_URL } from "@/lib/r2";

/**
 * Anota que um arquivo chegou pelo celular.
 *
 * É esta linha que faz o arquivo aparecer na tela do computador. A chave
 * é conferida contra a pasta da sessão: sem isso, quem tivesse o link
 * poderia registrar o caminho de um arquivo alheio e vê-lo aparecer no
 * painel de outra pessoa.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const leitura = await lerSessao(token);

  if (!leitura.ok) {
    return NextResponse.json({ error: leitura.erro }, { status: leitura.status });
  }

  const { chave, nome, tamanho, tipo } = await request.json();

  const prefixo = `celular/${leitura.sessao.id}/`;
  if (typeof chave !== "string" || !chave.startsWith(prefixo)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: arquivo, error } = await admin
    .from("arquivos_do_celular")
    .insert({
      sessao_id: leitura.sessao.id,
      nome: typeof nome === "string" && nome.trim() ? nome.trim() : "vídeo.mp4",
      chave,
      url: `${R2_PUBLIC_BASE_URL}/${chave}`,
      tamanho: typeof tamanho === "number" ? tamanho : null,
      tipo: typeof tipo === "string" ? tipo : null,
    })
    .select("id, nome, url, tamanho, created_at")
    .single();

  if (error || !arquivo) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível registrar o arquivo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ arquivo });
}
