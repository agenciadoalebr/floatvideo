import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registra uma ação da administração sobre a conta de outra pessoa.
 *
 * Grava com a chave de serviço, no mesmo passo da ação: se o registro
 * dependesse do navegador, bastaria bloquear uma requisição para agir
 * sem deixar rastro.
 *
 * Nunca lança. Um erro ao gravar o log não pode derrubar a operação em
 * si — mas o `console.error` fica, para o problema aparecer nos registros
 * da Vercel em vez de sumir.
 */
export async function registrarAuditoria(dados: {
  ator: string;
  atorEmail: string;
  acao: string;
  organizationId?: string | null;
  contaNome?: string | null;
  detalhe?: string | null;
  request?: Request;
}) {
  try {
    const cabecalhos = dados.request?.headers;
    await createAdminClient()
      .from("admin_audit_log")
      .insert({
        ator: dados.ator,
        ator_email: dados.atorEmail,
        acao: dados.acao,
        organization_id: dados.organizationId ?? null,
        conta_nome: dados.contaNome ?? null,
        detalhe: dados.detalhe ?? null,
        // A Vercel entrega o IP de origem neste cabeçalho; o primeiro da
        // lista é o cliente, os demais são os proxies do caminho.
        ip: cabecalhos?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        navegador: cabecalhos?.get("user-agent") ?? null,
      });
  } catch (err) {
    console.error("[auditoria] não foi possível registrar:", err);
  }
}
