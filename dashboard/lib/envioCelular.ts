import { createAdminClient } from "@/lib/supabase/admin";

export type SessaoDeEnvio = {
  id: string;
  project_id: string;
  criado_por: string;
  expira_em: string;
};

/**
 * Acha a sessão pelo token e confere se ela ainda vale.
 *
 * Fica num lugar só porque três rotas fazem exatamente esta pergunta, e
 * uma delas esquecendo o prazo transformaria um link velho em porta
 * aberta para mandar arquivo na conta de alguém.
 */
export async function lerSessao(token: string): Promise<
  | { ok: true; sessao: SessaoDeEnvio }
  | { ok: false; erro: string; status: number }
> {
  if (typeof token !== "string" || token.length < 16) {
    return { ok: false, erro: "Link inválido.", status: 400 };
  }

  const admin = createAdminClient();

  const { data: sessao } = await admin
    .from("sessoes_de_envio")
    .select("id, project_id, criado_por, expira_em")
    .eq("token", token)
    .maybeSingle();

  if (!sessao) {
    return { ok: false, erro: "Este link não existe mais.", status: 404 };
  }

  if (new Date(sessao.expira_em) < new Date()) {
    return {
      ok: false,
      erro: "Este link expirou. Gere um novo QR code no computador.",
      status: 410,
    };
  }

  return { ok: true, sessao: sessao as SessaoDeEnvio };
}
