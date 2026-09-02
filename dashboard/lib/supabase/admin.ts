import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço, que ignora as regras de acesso do
 * banco. Só para rotinas do servidor em que o dado não é decidido pelo
 * usuário — status de assinatura vindo do Asaas, por exemplo.
 *
 * A chave vive apenas nas variáveis de ambiente do servidor. Se este
 * arquivo for importado por um componente de navegador, o build quebra —
 * e é bom que quebre.
 */
export function createAdminClient() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!chave) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor."
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
