import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { documentoValido, limparDocumento, limparNumeros } from "@/lib/documentos";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Edição dos dados de uma conta pela administração da plataforma.
 *
 * O que dá para mudar aqui é o que é nosso: nome da conta, dados do
 * titular, plano e exceção de limite. O que é do Asaas — status da
 * assinatura, datas de cobrança — não entra: mudar aqui não muda lá, e
 * a próxima notificação do Asaas sobrescreveria de volta. Ficaria um
 * campo que parece funcionar e não funciona.
 *
 * A exceção é o fim do teste, que é decisão comercial nossa e não do
 * meio de pagamento.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: ehAdmin } = await supabase.rpc("e_admin_da_plataforma");
  if (!ehAdmin) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const {
    organizationId,
    nome,
    plano,
    excecaoSites,
    titular,
    cpfCnpj,
    telefone,
    fimDoTeste,
    observacoes,
    bloqueioManual,
  } = await request.json();

  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }

  const admin = createAdminClient();

  const daConta: Record<string, unknown> = {};

  if (typeof nome === "string") {
    if (!nome.trim()) {
      return NextResponse.json(
        { error: "O nome da conta não pode ficar vazio." },
        { status: 400 }
      );
    }
    daConta.name = nome.trim();
  }

  if (typeof plano === "string" && plano) {
    const { data: existe } = await admin
      .from("plans")
      .select("id")
      .eq("id", plano)
      .maybeSingle();

    if (!existe) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }
    daConta.plan = plano;
  }

  // Vazio devolve a conta ao limite do plano; um número a mantém acima
  // (ou abaixo) dele, e a tela mostra isso marcado como exceção.
  if (excecaoSites === null || excecaoSites === "") {
    daConta.max_projects = null;
  } else if (excecaoSites !== undefined) {
    const n = Number(excecaoSites);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json(
        { error: "O limite de sites precisa ser um número inteiro." },
        { status: 400 }
      );
    }
    daConta.max_projects = n;
  }

  if (typeof observacoes === "string") {
    daConta.observacoes_internas = observacoes.trim() || null;
  }

  // Bloqueio decidido pela administração, em coluna própria: escrever
  // "suspended" na assinatura seria apagado pela próxima notificação do
  // Asaas, sem ninguém perceber.
  if (typeof bloqueioManual === "boolean") {
    daConta.bloqueio_manual = bloqueioManual;
  }

  if (Object.keys(daConta).length > 0) {
    const { data: antes } = await admin
      .from("organizations")
      .select("name, bloqueio_manual")
      .eq("id", organizationId)
      .maybeSingle();

    const { error } = await admin
      .from("organizations")
      .update(daConta)
      .eq("id", organizationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cortar o acesso de um cliente é a única ação daqui que ele sente na
    // hora: fica registrada à parte, com quem fez.
    if (
      typeof bloqueioManual === "boolean" &&
      antes &&
      antes.bloqueio_manual !== bloqueioManual
    ) {
      await registrarAuditoria({
        ator: user.id,
        atorEmail: user.email ?? "",
        acao: bloqueioManual ? "bloqueou_conta" : "desbloqueou_conta",
        organizationId,
        contaNome: antes.name,
        request,
      });
    }
  }

  // Dados do titular vivem na assinatura, e só existem se houver uma.
  const daAssinatura: Record<string, unknown> = {};

  if (typeof titular === "string") daAssinatura.titular = titular.trim() || null;

  if (typeof cpfCnpj === "string") {
    const documento = limparDocumento(cpfCnpj);
    if (documento && !documentoValido(documento)) {
      return NextResponse.json(
        { error: "Este CPF ou CNPJ não é válido." },
        { status: 400 }
      );
    }
    daAssinatura.cpf_cnpj = documento || null;
  }

  if (typeof telefone === "string") {
    daAssinatura.telefone = limparNumeros(telefone) || null;
  }

  if (fimDoTeste !== undefined) {
    daAssinatura.trial_ends_at = fimDoTeste
      ? new Date(fimDoTeste + "T12:00:00Z").toISOString()
      : null;
    // Estender o teste sem limpar o aviso faria o lembrete de "termina em
    // 2 dias" nunca mais sair para essa conta.
    daAssinatura.aviso_fim_teste_em = null;
  }

  if (Object.keys(daAssinatura).length > 0) {
    daAssinatura.updated_at = new Date().toISOString();

    const { error, count } = await admin
      .from("subscriptions")
      .update(daAssinatura, { count: "exact" })
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({
        ok: true,
        aviso:
          "Os dados da conta foram salvos. Titular, documento, telefone e fim do teste não foram gravados porque esta conta não tem assinatura.",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
