/**
 * Cobrança pelo Asaas.
 *
 * Escolhido por três motivos, nessa ordem: é dos poucos com Pix
 * Automático, trata boleto e cartão na mesma conta, e a documentação e o
 * suporte são em português — o que pesa quando quem mantém isso é a
 * própria agência.
 *
 * Nada aqui roda no navegador: a chave de API fica só no servidor.
 */
const BASE =
  process.env.ASAAS_BASE_URL ??
  (process.env.ASAAS_AMBIENTE === "producao"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3");

export function asaasConfigurado() {
  return Boolean(process.env.ASAAS_API_KEY);
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      access_token: process.env.ASAAS_API_KEY ?? "",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    // O Asaas devolve os erros em português, com o campo que falhou —
    // repassar isso é mais útil do que uma mensagem genérica nossa.
    try {
      const corpo = JSON.parse(texto) as {
        errors?: { description?: string }[];
      };
      const descricao = corpo.errors?.[0]?.description;
      if (descricao) throw new Error(descricao);
    } catch (err) {
      if (err instanceof Error && err.message && !err.message.includes("JSON")) {
        throw err;
      }
    }
    throw new Error(`Asaas respondeu ${resposta.status}.`);
  }

  return JSON.parse(texto) as T;
}

export type ClienteAsaas = { id: string };

/**
 * Cria o cliente no Asaas, ou reaproveita o que já existe com o mesmo
 * CPF/CNPJ — repetir o cadastro criaria dois clientes para a mesma
 * pessoa, e a cobrança acabaria em um deles.
 */
export async function garantirCliente(dados: {
  nome: string;
  cpfCnpj: string;
  email: string;
  telefone?: string;
}): Promise<string> {
  const existentes = await chamar<{ data?: ClienteAsaas[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(dados.cpfCnpj)}`
  );

  if (existentes.data?.[0]?.id) return existentes.data[0].id;

  const criado = await chamar<ClienteAsaas>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      email: dados.email,
      // O Asaas usa o celular para avisar sobre a cobrança — quem não
      // abre e-mail costuma abrir mensagem.
      ...(dados.telefone ? { mobilePhone: dados.telefone } : {}),
    }),
  });

  return criado.id;
}

export type AssinaturaAsaas = {
  id: string;
  status: string;
  nextDueDate: string;
};

/**
 * Assinatura mensal. O período de teste é a data do primeiro
 * vencimento: a conta é liberada hoje e a primeira cobrança cai daqui a
 * N dias. Não existe "cobrar e estornar" — simplesmente não se cobra
 * antes.
 *
 * billingType UNDEFINED deixa a escolha (Pix, boleto ou cartão) com quem
 * paga, na hora de pagar.
 */
export async function criarAssinatura(dados: {
  clienteId: string;
  valorCentavos: number;
  descricao: string;
  diasDeTeste: number;
  referencia: string;
}): Promise<AssinaturaAsaas> {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + dados.diasDeTeste);

  return chamar<AssinaturaAsaas>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.clienteId,
      billingType: "UNDEFINED",
      value: dados.valorCentavos / 100,
      nextDueDate: vencimento.toISOString().slice(0, 10),
      cycle: "MONTHLY",
      description: dados.descricao,
      // Volta nos webhooks e permite achar a conta sem depender de
      // procurar pelo id da assinatura.
      externalReference: dados.referencia,
    }),
  });
}

/** Link da primeira fatura, para a pessoa pagar quando quiser. */
export async function primeiraFatura(assinaturaId: string) {
  const pagamentos = await chamar<{
    data?: { invoiceUrl?: string; dueDate?: string }[];
  }>(`/subscriptions/${assinaturaId}/payments`);

  return {
    url: pagamentos.data?.[0]?.invoiceUrl ?? null,
    vencimento: pagamentos.data?.[0]?.dueDate ?? null,
  };
}

/**
 * Troca o valor da assinatura já existente — o que acontece quando o
 * cliente sobe de plano ou desce.
 *
 * updatePendingPayments alcança a fatura que já foi gerada e ainda não
 * foi paga. Sem ele, quem sobe de plano no meio do ciclo receberia mais
 * um mês pelo preço antigo; quem desce pagaria o preço antigo mais uma
 * vez. Vencimento e ciclo não mudam: a data da próxima cobrança é a
 * mesma de antes.
 *
 * A referência do Asaas documenta PUT, mas a API também responde a POST
 * neste caminho e parte dos SDKs usa POST. Como o erro de método viria
 * como uma falha genérica na frente do cliente, aqui tenta os dois.
 */
export async function atualizarAssinatura(dados: {
  assinaturaId: string;
  valorCentavos: number;
  descricao: string;
  /**
   * Alcança a fatura já gerada e ainda não paga. Verdadeiro quando o
   * cliente ainda não pagou o período em curso — assim ele paga o
   * valor certo. Falso quando o período já está pago e a troca só vale
   * do próximo vencimento em diante.
   */
  atualizarPendentes: boolean;
}) {
  const corpo = JSON.stringify({
    value: dados.valorCentavos / 100,
    description: dados.descricao,
    updatePendingPayments: dados.atualizarPendentes,
  });

  try {
    return await chamar<AssinaturaAsaas>(`/subscriptions/${dados.assinaturaId}`, {
      method: "PUT",
      body: corpo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!/40[45]/.test(msg)) throw err;
    return chamar<AssinaturaAsaas>(`/subscriptions/${dados.assinaturaId}`, {
      method: "POST",
      body: corpo,
    });
  }
}

export async function cancelarAssinatura(assinaturaId: string) {
  await chamar(`/subscriptions/${assinaturaId}`, { method: "DELETE" });
}

/**
 * Cobrança avulsa — uma fatura só, fora da assinatura.
 *
 * Serve para o acerto proporcional de quem sobe de plano no meio do
 * mês. Vai sem externalReference de propósito: o webhook usa esse campo
 * para achar a conta e empurrar o fim do período pago em um mês, e uma
 * cobrança de ajuste não é uma renovação.
 */
export async function criarCobrancaAvulsa(dados: {
  clienteId: string;
  valorCentavos: number;
  descricao: string;
  vencimentoEmDias: number;
}) {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + dados.vencimentoEmDias);

  return chamar<{ id: string; invoiceUrl?: string; dueDate?: string }>(
    "/payments",
    {
      method: "POST",
      body: JSON.stringify({
        customer: dados.clienteId,
        billingType: "UNDEFINED",
        value: dados.valorCentavos / 100,
        dueDate: vencimento.toISOString().slice(0, 10),
        description: dados.descricao,
      }),
    }
  );
}

/** Valor mínimo que o Asaas aceita numa cobrança. */
export const MINIMO_COBRANCA_CENTAVOS = 500;
