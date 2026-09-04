import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasConfigurado,
  atualizarAssinatura,
  criarCobrancaAvulsa,
  MINIMO_COBRANCA_CENTAVOS,
} from "@/lib/asaas";

const DIA = 86400000;

/**
 * Quanto vale a parte do mês que ainda não foi usada.
 *
 * O crédito dos dias que sobraram do plano antigo e a cobrança
 * proporcional do plano novo se anulam quase todos: o que resta é a
 * diferença de preço aplicada só aos dias restantes. Um mês de 30 dias,
 * troca no dia 10 de um plano de R$ 49 para um de R$ 149: sobram 20
 * dias, e a diferença de R$ 100 sobre dois terços do mês dá R$ 66,67.
 */
function acertoProporcional(
  precoAtual: number,
  precoNovo: number,
  fimDoPeriodo: Date
) {
  const inicio = new Date(fimDoPeriodo);
  inicio.setMonth(inicio.getMonth() - 1);

  const ciclo = Math.max(1, Math.round((fimDoPeriodo.getTime() - inicio.getTime()) / DIA));
  const restantes = Math.max(
    0,
    Math.ceil((fimDoPeriodo.getTime() - Date.now()) / DIA)
  );
  const proporcao = Math.min(1, restantes / ciclo);

  return {
    dias: restantes,
    ciclo,
    centavos: Math.round((precoNovo - precoAtual) * proporcao),
  };
}

/**
 * Troca o plano de uma conta que já assina.
 *
 * Subir e descer de plano não são simétricos, e tratá-los igual é que
 * daria injustiça dos dois lados:
 *
 * - Subir vale na hora, e a diferença dos dias que faltam vem numa
 *   cobrança avulsa. Sem ela, quem sobe no dia 2 usaria o plano maior
 *   um mês inteiro pagando o menor.
 * - Descer fica agendado para a próxima renovação. O mês em curso já
 *   foi pago pelo plano maior, e tirar sites no meio dele seria cobrar
 *   por algo que a pessoa deixa de ter.
 *
 * Quando o período em curso ainda não foi pago (em teste, ou em atraso)
 * não há o que ratear: muda o valor da assinatura, e a própria fatura
 * pendente passa a valer o valor novo.
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

  // Preço e limite saem da tabela de planos, nunca do navegador.
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
    .select(
      "asaas_subscription_id, asaas_customer_id, plan, plano_agendado, status, current_period_end"
    )
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
      {
        error:
          "A assinatura está cancelada. Assine de novo para escolher o plano.",
      },
      { status: 409 }
    );
  }

  // Consulta separada, e nao embed: depois do plano agendado existem
  // duas chaves de subscriptions para plans, e embed ambiguo no
  // PostgREST volta vazio sem reclamar.
  const { data: planoAtual } = await admin
    .from("plans")
    .select("nome, preco_centavos")
    .eq("id", assinatura.plan)
    .maybeSingle();

  if (!planoAtual) {
    return NextResponse.json(
      { error: "Não foi possível ler o plano atual da conta." },
      { status: 500 }
    );
  }

  // Escolher de novo o plano que já vale é o jeito de desistir de uma
  // descida agendada — sem isso, o cliente teria que pedir por e-mail
  // justamente o que esta tela veio resolver.
  const desistindoDaDescida =
    assinatura.plan === novo.id && assinatura.plano_agendado;

  if (assinatura.plan === novo.id && !desistindoDaDescida) {
    return NextResponse.json(
      { error: "Este já é o plano da conta." },
      { status: 400 }
    );
  }

  const fim = assinatura.current_period_end
    ? new Date(assinatura.current_period_end)
    : null;
  const periodoPago =
    assinatura.status === "active" && !!fim && fim.getTime() > Date.now();

  if (desistindoDaDescida) {
    await atualizarAssinatura({
      assinaturaId: assinatura.asaas_subscription_id,
      valorCentavos: planoAtual.preco_centavos,
      descricao: `FloatVideo — plano ${planoAtual.nome}`,
      atualizarPendentes: !periodoPago,
    });

    await admin
      .from("subscriptions")
      .update({
        plano_agendado: null,
        ultimo_evento: "TROCA_DESFEITA",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", membership.organization_id);

    return NextResponse.json({ ok: true, desfeito: true, plano: planoAtual.nome });
  }

  const subindo = novo.preco_centavos > planoAtual.preco_centavos;

  // Descer para um plano com menos sites do que a conta usa deixaria a
  // conta acima do limite. Melhor recusar aqui, dizendo quantos sobram,
  // do que desligar site de cliente por conta própria.
  if (!subindo) {
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
  }

  const agendar = !subindo && periodoPago;

  try {
    await atualizarAssinatura({
      assinaturaId: assinatura.asaas_subscription_id,
      valorCentavos: novo.preco_centavos,
      descricao: `FloatVideo — plano ${novo.nome}`,
      // Numa descida agendada a fatura pendente, se existir, é do mês
      // que já está sendo usado no plano maior: ela fica como está.
      atualizarPendentes: !agendar,
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

  if (agendar) {
    await admin
      .from("subscriptions")
      .update({
        plano_agendado: novo.id,
        ultimo_evento: "PLANO_AGENDADO",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", membership.organization_id);

    return NextResponse.json({
      ok: true,
      agendado: true,
      plano: novo.nome,
      valorCentavos: novo.preco_centavos,
      valeApartirDe: assinatura.current_period_end,
    });
  }

  // Subida com o mês já pago: cobra só a diferença dos dias restantes.
  let cobranca: { url: string | null; centavos: number; dias: number } | null =
    null;

  if (subindo && periodoPago && fim && assinatura.asaas_customer_id) {
    const acerto = acertoProporcional(
      planoAtual.preco_centavos,
      novo.preco_centavos,
      fim
    );

    // Abaixo do mínimo do Asaas a cobrança nem seria aceita. Faltando
    // dois dias para a renovação, cobrar R$ 3 dá mais trabalho de
    // suporte do que vale — a diferença entra inteira no próximo mês.
    if (acerto.centavos >= MINIMO_COBRANCA_CENTAVOS) {
      try {
        const fatura = await criarCobrancaAvulsa({
          clienteId: assinatura.asaas_customer_id,
          valorCentavos: acerto.centavos,
          descricao: `FloatVideo — ajuste proporcional do plano ${planoAtual.nome} para ${novo.nome} (${acerto.dias} dias)`,
          vencimentoEmDias: 3,
        });
        cobranca = {
          url: fatura.invoiceUrl ?? null,
          centavos: acerto.centavos,
          dias: acerto.dias,
        };
      } catch {
        // A assinatura já subiu no Asaas. Falhar tudo agora deixaria o
        // cliente sem o plano que ele acabou de pedir por causa de um
        // acerto de alguns reais; o ajuste vira cobrança manual.
        cobranca = null;
      }
    }
  }

  // O plano local só muda depois de o Asaas aceitar: ao contrário, a
  // conta teria o plano novo sem estar pagando por ele.
  await admin
    .from("subscriptions")
    .update({
      plan: novo.id,
      plano_agendado: null,
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
    cobranca,
  });
}
