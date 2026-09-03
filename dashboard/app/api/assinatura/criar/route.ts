import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasConfigurado,
  criarAssinatura,
  garantirCliente,
  primeiraFatura,
} from "@/lib/asaas";
import {
  documentoValido,
  limparDocumento,
  limparNumeros,
  telefoneValido,
} from "@/lib/documentos";

/**
 * Assina um plano.
 *
 * Atende as duas portas: quem já é cliente e assina pelo painel, e quem
 * chega pela landing e ainda não tem organização — nesse caso é aqui que
 * a organização nasce. O acesso vem de ter organização, então criá-la
 * junto da assinatura é o que faz o pagamento valer como entrada.
 *
 * O valor e os dias de teste vêm da tabela de planos, nunca do
 * navegador: quem paga não escolhe quanto paga nem por quanto tempo
 * deixa de pagar.
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

  const { plano, nome, cpfCnpj, telefone, codigo } = await request.json();

  // A conferência do navegador é conforto; a que vale é esta. Sem ela,
  // bastaria abrir o console para assinar com documento inventado.
  const documento = limparDocumento(cpfCnpj);
  if (!documentoValido(documento)) {
    return NextResponse.json(
      { error: "Informe um CPF ou CNPJ válido." },
      { status: 400 }
    );
  }

  const celular = limparNumeros(telefone);
  if (!telefoneValido(celular)) {
    return NextResponse.json(
      { error: "Informe um telefone válido, com DDD." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Quem foi convidado para a conta de outra pessoa não decide o plano
  // dela. Quem ainda não tem conta nenhuma segue adiante: a dele nasce
  // logo abaixo.
  if (membership && membership.role !== "owner") {
    return NextResponse.json(
      { error: "Só o dono da conta pode assinar." },
      { status: 403 }
    );
  }

  const { data: planoEscolhido } = await supabase
    .from("plans")
    .select("id, nome, preco_centavos, trial_dias, trial_dias_convite, publico")
    .eq("id", plano)
    .maybeSingle();

  if (!planoEscolhido?.publico) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const titular = (nome ?? "").trim() || (user.email ?? "Cliente FloatVideo");
  const codigoLimpo = (codigo ?? "").trim().toUpperCase();

  // O código é consumido antes de qualquer chamada ao Asaas: se ele já
  // tiver sido usado, a pessoa descobre agora, e não depois de uma
  // assinatura criada com o prazo errado.
  let diasDeTeste = planoEscolhido.trial_dias;

  if (codigoLimpo) {
    const { data: consumido } = await admin
      .from("invite_codes")
      .update({
        used_by: user.id,
        used_email: user.email,
        used_at: new Date().toISOString(),
      })
      .eq("code", codigoLimpo)
      .is("used_at", null)
      .select("code")
      .maybeSingle();

    if (!consumido) {
      return NextResponse.json(
        { error: "Este código de convite não existe ou já foi utilizado." },
        { status: 400 }
      );
    }

    diasDeTeste = planoEscolhido.trial_dias_convite;
  }

  let organizacaoId = membership?.organization_id ?? null;

  if (!organizacaoId) {
    const { data: nova, error: erroOrg } = await admin
      .from("organizations")
      .insert({ name: titular, plan: planoEscolhido.id })
      .select("id")
      .single();

    if (erroOrg || !nova) {
      return NextResponse.json(
        { error: "Não foi possível criar sua conta agora." },
        { status: 500 }
      );
    }

    organizacaoId = nova.id;

    await admin
      .from("organization_members")
      .insert({
        organization_id: organizacaoId,
        user_id: user.id,
        role: "owner",
      });
  }

  try {
    const clienteId = await garantirCliente({
      nome: titular,
      cpfCnpj: documento,
      email: user.email ?? "",
      telefone: celular,
    });

    const assinatura = await criarAssinatura({
      clienteId,
      valorCentavos: planoEscolhido.preco_centavos,
      descricao: `FloatVideo — plano ${planoEscolhido.nome}`,
      diasDeTeste,
      referencia: organizacaoId,
    });

    const fatura = await primeiraFatura(assinatura.id);

    const fimDoTeste = new Date();
    fimDoTeste.setDate(fimDoTeste.getDate() + diasDeTeste);

    await admin.from("subscriptions").upsert(
      {
        organization_id: organizacaoId,
        plan: planoEscolhido.id,
        // Com dias de teste a conta começa em teste; sem eles, ela só
        // vira ativa quando o primeiro pagamento for confirmado.
        status: diasDeTeste > 0 ? "trialing" : "overdue",
        asaas_customer_id: clienteId,
        asaas_subscription_id: assinatura.id,
        titular,
        cpf_cnpj: documento,
        telefone: celular || null,
        trial_ends_at: diasDeTeste > 0 ? fimDoTeste.toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );

    // O plano passa a valer na hora: o teste é acesso completo, senão
    // não é teste.
    await admin
      .from("organizations")
      .update({ plan: planoEscolhido.id })
      .eq("id", organizacaoId);

    return NextResponse.json({
      assinatura: assinatura.id,
      vencimento: fatura.vencimento ?? assinatura.nextDueDate,
      fatura: fatura.url,
      diasDeTeste,
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
