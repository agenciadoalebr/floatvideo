import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasConfigurado,
  criarAssinatura,
  garantirCliente,
  limparCpfCnpj,
  primeiraFatura,
} from "@/lib/asaas";

/**
 * Assina um plano.
 *
 * O valor vem da tabela de planos, nunca do navegador: quem paga não
 * escolhe quanto paga. E a gravação da assinatura usa a chave de serviço
 * porque status e datas são decididos pelo Asaas — o cliente lê, não
 * escreve.
 */
export async function POST(request: Request) {
  if (!asaasConfigurado()) {
    return NextResponse.json(
      { error: "Cobrança ainda não configurada." },
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

  const { plano, nome, cpfCnpj } = await request.json();

  const documento = limparCpfCnpj(cpfCnpj);
  if (documento.length !== 11 && documento.length !== 14) {
    return NextResponse.json(
      { error: "Informe um CPF ou CNPJ válido." },
      { status: 400 }
    );
  }

  // Só o dono da conta assina — quem foi convidado não decide o plano.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json(
      { error: "Só o dono da conta pode assinar." },
      { status: 403 }
    );
  }

  const { data: planoEscolhido } = await supabase
    .from("plans")
    .select("id, nome, preco_centavos, trial_dias, publico")
    .eq("id", plano)
    .maybeSingle();

  if (!planoEscolhido?.publico) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const titular = (nome ?? "").trim() || (user.email ?? "Cliente FloatVideo");

  try {
    const clienteId = await garantirCliente({
      nome: titular,
      cpfCnpj: documento,
      email: user.email ?? "",
    });

    const assinatura = await criarAssinatura({
      clienteId,
      valorCentavos: planoEscolhido.preco_centavos,
      descricao: `FloatVideo — plano ${planoEscolhido.nome}`,
      diasDeTeste: planoEscolhido.trial_dias,
      referencia: membership.organization_id,
    });

    const fatura = await primeiraFatura(assinatura.id);

    const fimDoTeste = new Date();
    fimDoTeste.setDate(fimDoTeste.getDate() + planoEscolhido.trial_dias);

    await admin.from("subscriptions").upsert(
      {
        organization_id: membership.organization_id,
        plan: planoEscolhido.id,
        // Com dias de teste a conta começa em teste; sem eles, ela só
        // vira ativa quando o primeiro pagamento for confirmado.
        status: planoEscolhido.trial_dias > 0 ? "trialing" : "overdue",
        asaas_customer_id: clienteId,
        // Guardado para a administração achar a conta pelo documento sem
        // ter de abrir o Asaas.
        titular,
        cpf_cnpj: documento,
        asaas_subscription_id: assinatura.id,
        trial_ends_at:
          planoEscolhido.trial_dias > 0 ? fimDoTeste.toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );

    // O plano passa a valer na hora: o teste é acesso completo, senão
    // não é teste.
    await admin
      .from("organizations")
      .update({ plan: planoEscolhido.id })
      .eq("id", membership.organization_id);

    return NextResponse.json({
      assinatura: assinatura.id,
      vencimento: fatura.vencimento ?? assinatura.nextDueDate,
      fatura: fatura.url,
      diasDeTeste: planoEscolhido.trial_dias,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Não foi possível assinar agora.",
      },
      { status: 502 }
    );
  }
}
