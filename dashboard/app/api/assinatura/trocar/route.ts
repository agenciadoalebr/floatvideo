import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasConfigurado, atualizarAssinatura } from "@/lib/asaas";

/**
 * Troca o plano de uma conta que já assina.
 *
 * O Asaas não faz rateio: mudar o valor da assinatura não gera crédito
 * nem cobrança proporcional pelos dias restantes. Então o preço novo
 * vale a partir da próxima cobrança — e da fatura em aberto, se houver.
 * Quem sobe de plano no meio do mês usa o plano maior até o vencimento
 * sem pagar a diferença; é uma escolha de negócio, não um descuido.
 *
 * O plano local muda junto, e é ele que manda no limite de sites.
 */
export async function POST(request: Request) {
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

  const { plano } = await request.json();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json(
      { error: "Só o dono da conta pode trocar de plano." },
      { status: 403 }
    );
  }

  // O preço sai da tabela de planos, nunca do navegador.
  const { data: novo } = await supabase
    .from("plans")
    .select("id, nome, preco_centavos, max_projects, publico")
    .eq("id", plano)
    .maybeSingle();

  if (!novo?.publico) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: assinatura } = await admin
    .from("subscriptions")
    .select("asaas_subscription_id, plan, status")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!assinatura?.asaas_subscription_id) {
    return NextResponse.json(
      { error: "Esta conta ainda não tem assinatura. Assine primeiro." },
      { status: 404 }
    );
  }

  if (assinatura.status === "canceled") {
    return NextResponse.json(
      { error: "A assinatura está cancelada. Assine de novo para escolher o plano." },
      { status: 409 }
    );
  }

  if (assinatura.plan === novo.id) {
    return NextResponse.json(
      { error: "Este já é o plano da conta." },
      { status: 400 }
    );
  }

  // Descer de plano com mais sites do que o novo plano comporta deixaria
  // a conta acima do limite — e o limite é justamente o que se está
  // pagando. Melhor recusar aqui, dizendo quantos sites sobram, do que
  // aceitar e desligar site de cliente por conta própria.
  const { count: sites } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", membership.organization_id);

  if (novo.max_projects !== null && (sites ?? 0) > novo.max_projects) {
    return NextResponse.json(
      {
        error: `O plano ${novo.nome} permite ${novo.max_projects} ${
          novo.max_projects === 1 ? "site" : "sites"
        }, e esta conta tem ${sites}. Remova ${
          (sites ?? 0) - novo.max_projects
        } antes de trocar.`,
      },
      { status: 409 }
    );
  }

  try {
    await atualizarAssinatura({
      assinaturaId: assinatura.asaas_subscription_id,
      valorCentavos: novo.preco_centavos,
      descricao: `FloatVideo — plano ${novo.nome}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível trocar o plano agora.",
      },
      { status: 502 }
    );
  }

  // Só depois de o Asaas confirmar: se a gravação viesse antes e a
  // chamada falhasse, a conta teria o plano novo sem estar pagando por
  // ele.
  await admin
    .from("subscriptions")
    .update({
      plan: novo.id,
      ultimo_evento: "PLANO_TROCADO",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", membership.organization_id);

  await admin
    .from("organizations")
    .update({ plan: novo.id })
    .eq("id", membership.organization_id);

  return NextResponse.json({
    ok: true,
    plano: novo.nome,
    valorCentavos: novo.preco_centavos,
  });
}
