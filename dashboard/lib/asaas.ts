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

export async function cancelarAssinatura(assinaturaId: string) {
  await chamar(`/subscriptions/${assinaturaId}`, { method: "DELETE" });
}

/** Só dígitos: o Asaas recusa CPF/CNPJ com ponto, traço ou barra. */
export function limparCpfCnpj(valor: string) {
  return (valor ?? "").replace(/\D/g, "");
}

/** Mesma regra para o telefone: só dígitos, com DDD. */
export function limparTelefone(valor: string) {
  return (valor ?? "").replace(/\D/g, "");
}
