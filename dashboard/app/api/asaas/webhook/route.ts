import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Eventos de cobrança do Asaas.
 *
 * É por aqui que o pagamento vira acesso: o painel nunca decide se
 * alguém está em dia — quem decide é o Asaas, e este endpoint apenas
 * registra o que ele informou.
 *
 * Autenticação pelo header "asaas-access-token", com o valor
 * configurado no painel do Asaas. Sem ele, qualquer um poderia liberar a
 * própria conta mandando um POST.
 */
export async function POST(request: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;

  if (!esperado) {
    return NextResponse.json(
      { error: "Webhook não configurado." },
      { status: 503 }
    );
  }

  if (request.headers.get("asaas-access-token") !== esperado) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const corpo = (await request.json()) as {
    event?: string;
    payment?: {
      subscription?: string;
      externalReference?: string;
      dueDate?: string;
      value?: number;
    };
  };

  const evento = corpo.event ?? "";
  const pagamento = corpo.payment;

  if (!evento || !pagamento) {
    // Responder 200 mesmo assim: o Asaas interrompe a fila depois de 15
    // falhas seguidas, e um evento que não nos interessa não é falha.
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const admin = createAdminClient();

  // A referência é o id da organização, gravado na criação da
  // assinatura; a busca pelo id da assinatura é a reserva.
  const filtro = pagamento.externalReference
    ? { coluna: "organization_id", valor: pagamento.externalReference }
    : { coluna: "asaas_subscription_id", valor: pagamento.subscription ?? "" };

  if (!filtro.valor) return NextResponse.json({ ok: true, ignorado: true });

  const atualizacao: Record<string, unknown> = {
    ultimo_evento: evento,
    updated_at: new Date().toISOString(),
  };

  switch (evento) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      atualizacao.status = "active";
      // O acesso vale até o próximo vencimento, com folga de um dia para
      // a cobrança seguinte ser gerada e paga.
      if (pagamento.dueDate) {
        const fim = new Date(pagamento.dueDate);
        fim.setMonth(fim.getMonth() + 1);
        fim.setDate(fim.getDate() + 1);
        atualizacao.current_period_end = fim.toISOString();
      }
      break;
    }
    case "PAYMENT_OVERDUE":
      atualizacao.status = "overdue";
      break;
    case "PAYMENT_REFUNDED":
    case "PAYMENT_DELETED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      atualizacao.status = "canceled";
      break;
    default:
      // Evento conhecido do Asaas que não muda acesso (criação de
      // cobrança, split, etc.). Registra e segue.
      break;
  }

  await admin
    .from("subscriptions")
    .update(atualizacao)
    .eq(filtro.coluna, filtro.valor);

  // Resposta curta e imediata: a documentação pede para não segurar o
  // Asaas esperando processamento.
  return NextResponse.json({ ok: true });
}
