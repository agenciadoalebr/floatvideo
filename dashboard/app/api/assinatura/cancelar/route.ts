import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasConfigurado, cancelarAssinatura } from "@/lib/asaas";

/**
 * Cancela a assinatura da conta.
 *
 * Cancelar interrompe as próximas cobranças — não devolve o período já
 * pago nem tira o acesso na hora. Quem pagou o mês tem o mês; é o que
 * está escrito nos termos, e seria feio fazer diferente.
 */
export async function POST() {
  if (!asaasConfigurado()) {
    return NextResponse.json(
      { error: "Cobrança não configurada." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json(
      { error: "Só o dono da conta pode cancelar." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  const { data: assinatura } = await admin
    .from("subscriptions")
    .select("asaas_subscription_id, current_period_end")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!assinatura?.asaas_subscription_id) {
    return NextResponse.json(
      { error: "Não há assinatura ativa nesta conta." },
      { status: 404 }
    );
  }

  try {
    await cancelarAssinatura(assinatura.asaas_subscription_id);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível cancelar agora.",
      },
      { status: 502 }
    );
  }

  await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      ultimo_evento: "CANCELADA_PELO_CLIENTE",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", membership.organization_id);

  return NextResponse.json({
    ok: true,
    acessoAte: assinatura.current_period_end,
  });
}
