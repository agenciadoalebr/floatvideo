/**
 * Conexão com o Google Tag Manager do cliente.
 *
 * Duas decisões que valem ser lidas antes do código:
 *
 * 1. Não pedimos acesso offline. O Google só devolve o token de longa
 *    duração quando ele é pedido — sem isso, vem só um token de ~1 hora,
 *    que usamos e descartamos no mesmo fluxo. Não existe token nosso
 *    guardado em banco: nada a vazar, nada a expirar, nada a limpar.
 *
 * 2. Não pedimos permissão de publicar. Criamos tudo numa área de
 *    trabalho separada e quem publica é o dono do site, depois de ver o
 *    que foi criado. Um escopo a menos e uma decisão a menos tomada no
 *    site dos outros.
 */
const API = "https://tagmanager.googleapis.com/tagmanager/v2";

export const ESCOPOS = [
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
].join(" ");

/** Nome da área de trabalho criada no contêiner do cliente. */
export const NOME_WORKSPACE = "FloatVideo";

export function gtmConfigurado() {
  return Boolean(
    process.env.GTM_OAUTH_CLIENT_ID && process.env.GTM_OAUTH_CLIENT_SECRET
  );
}

export function urlDeRedirecionamento(origem: string) {
  return process.env.GTM_OAUTH_REDIRECT ?? `${origem}/api/gtm/callback`;
}

export function urlDeAutorizacao(origem: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GTM_OAUTH_CLIENT_ID ?? "",
    redirect_uri: urlDeRedirecionamento(origem),
    response_type: "code",
    scope: ESCOPOS,
    // Sem "access_type=offline" de propósito: ver o comentário do topo.
    include_granted_scopes: "true",
    // Sempre perguntar qual conta. Sem isto o Google usa a que já está
    // logada no navegador, e quem tem duas (a pessoal e a da empresa)
    // conecta a errada sem perceber — e depois não encontra os
    // contêineres, sem entender por quê.
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function trocarCodigoPorToken(codigo: string, origem: string) {
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: process.env.GTM_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GTM_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: urlDeRedirecionamento(origem),
      grant_type: "authorization_code",
    }),
  });

  if (!resposta.ok) {
    throw new Error("Não foi possível concluir a conexão com o Google.");
  }

  const dados = (await resposta.json()) as { access_token: string };
  return dados.access_token;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A API do Tag Manager permite 30 consultas por minuto por usuário — um
 * teto baixo para quem tem conta de agência, onde listar os contêineres
 * já custa uma chamada por conta de cliente. Quando ele estoura, o
 * Google responde 429; aqui a gente espera e tenta de novo, em vez de
 * devolver um erro que a pessoa não tem como resolver.
 */
async function chamar<T>(
  token: string,
  caminho: string,
  init?: RequestInit,
  tentativa = 0
): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (resposta.status === 429 && tentativa < 2) {
    // Espera curta de propósito: a janela do Google é de um minuto, mas
    // uma função de servidor não pode ficar parada tanto tempo. Aqui a
    // gente cobre o pico de um clique repetido; o limite de verdade é
    // explicado à pessoa na mensagem abaixo.
    await espera([2000, 5000][tentativa]);
    return chamar<T>(token, caminho, init, tentativa + 1);
  }

  if (!resposta.ok) {
    const corpo = await resposta.text();
    if (resposta.status === 429) {
      throw new Error(
        "O Google limita 30 consultas por minuto nesta API e o limite foi atingido. Espere um minuto e tente de novo."
      );
    }
    throw new Error(`Tag Manager respondeu ${resposta.status}: ${corpo}`);
  }

  return (await resposta.json()) as T;
}

export type Container = {
  accountId: string;
  containerId: string;
  path: string;
  name: string;
  publicId: string;
  conta: string;
};

export type Conta = {
  path: string;
  nome: string;
};

/**
 * Contas de GTM a que a pessoa tem acesso. Uma chamada só.
 *
 * A busca é em duas etapas de propósito. A versão anterior listava os
 * contêineres de todas as contas de uma vez — o que numa agência com 30
 * clientes vira 31 chamadas e estoura a cota de 30 por minuto do Google
 * sempre, sem retentativa que resolva. Escolhendo a conta primeiro, são
 * duas chamadas no total, não importa o tamanho da agência. E quem
 * atende vários clientes já sabe de qual deles está falando.
 */
export async function listarContas(token: string): Promise<Conta[]> {
  const contas = await chamar<{
    account?: { name: string; path: string }[];
  }>(token, "/accounts");

  return (contas.account ?? []).map((c) => ({ path: c.path, nome: c.name }));
}

/** Contêineres de site de uma conta. Também uma chamada só. */
export async function listarContainersDaConta(
  token: string,
  contaPath: string
): Promise<Container[]> {
  const lista = await chamar<{
    container?: {
      accountId: string;
      containerId: string;
      path: string;
      name: string;
      publicId: string;
      usageContext?: string[];
    }[];
  }>(token, `/${contaPath}/containers`);

  return (lista.container ?? [])
    // Só contêiner de site: o widget não existe em app nem em AMP.
    .filter((c) => !c.usageContext || c.usageContext.includes("web"))
    .map((c) => ({
      accountId: c.accountId,
      containerId: c.containerId,
      path: c.path,
      name: c.name,
      publicId: c.publicId,
      conta: "",
    }));
}

type Parametro = {
  type: string;
  key: string;
  value?: string;
  list?: unknown[];
  map?: Parametro[];
};

function variavelDeCamadaDeDados(nome: string, caminho: string) {
  return {
    name: nome,
    type: "v",
    parameter: [
      { type: "integer", key: "dataLayerVersion", value: "2" },
      { type: "boolean", key: "setDefaultValue", value: "false" },
      { type: "template", key: "name", value: caminho },
    ] as Parametro[],
  };
}

export type ResultadoInstalacao = {
  workspace: string;
  variaveis: string[];
  acionador: string;
  tag: string | null;
  reaproveitados: string[];
  aviso?: string;
};

/** Acha uma entidade pelo nome, ignorando maiúsculas e espaços à toa. */
function acharPorNome<T extends { name?: string }>(
  lista: T[] | undefined,
  nome: string
): T | undefined {
  const alvo = nome.trim().toLowerCase();
  return (lista ?? []).find((i) => (i.name ?? "").trim().toLowerCase() === alvo);
}

/**
 * Cria, no contêiner escolhido, tudo o que o tutorial manual pedia: as
 * duas variáveis de camada de dados, o acionador dos nossos eventos e a
 * tag do GA4 que os repassa.
 *
 * Tudo é feito de forma repetível. Uma área de trabalho nova no GTM nasce
 * como cópia do contêiner atual, então ela já traz o que o cliente
 * configurou antes — e o Google recusa nome repetido. Por isso, antes de
 * criar qualquer coisa, procuramos pelo nome: o que já existe é
 * reaproveitado, não duplicado. Assim clicar duas vezes, ou configurar
 * depois de ter feito à mão, não quebra nada.
 *
 * A impressão fica de fora do acionador: ela dispara em toda página onde
 * o balão aparece, e encheria o relatório do cliente.
 */
export async function instalarNoContainer(
  token: string,
  contaPath: string,
  measurementId?: string
): Promise<ResultadoInstalacao> {
  const reaproveitados: string[] = [];

  // 1. Área de trabalho: reaproveita a nossa, se já existir.
  const workspaces = await chamar<{
    workspace?: { path: string; name: string }[];
  }>(token, `/${contaPath}/workspaces`);

  let workspace = acharPorNome(workspaces.workspace, NOME_WORKSPACE);

  if (workspace) {
    reaproveitados.push(`área de trabalho ${workspace.name}`);
  } else {
    workspace = await chamar<{ path: string; name: string }>(
      token,
      `/${contaPath}/workspaces`,
      {
        method: "POST",
        body: JSON.stringify({
          name: NOME_WORKSPACE,
          description:
            "Configuração criada pelo FloatVideo. Revise e publique quando quiser.",
        }),
      }
    );
  }

  const base = `/${workspace.path}`;

  // A variável interna "Event" precisa estar ligada para o {{Event}} da
  // tag existir. Ligar de novo o que já está ligado não é erro.
  await chamar(token, `${base}/built_in_variables?type=event`, {
    method: "POST",
  }).catch(() => {});

  // 2. Variáveis de camada de dados.
  const variaveisExistentes = await chamar<{
    variable?: { name: string; variableId: string }[];
  }>(token, `${base}/variables`);

  async function garantirVariavel(nome: string, caminho: string) {
    const existente = acharPorNome(variaveisExistentes.variable, nome);
    if (existente) {
      reaproveitados.push(nome);
      return existente;
    }
    return chamar<{ name: string; variableId: string }>(
      token,
      `${base}/variables`,
      {
        method: "POST",
        body: JSON.stringify(variavelDeCamadaDeDados(nome, caminho)),
      }
    );
  }

  const video = await garantirVariavel("FV - vídeo", "floatvideo.video");
  const ctaType = await garantirVariavel(
    "FV - tipo de CTA",
    "floatvideo.cta_type"
  );

  // 3. Acionador.
  const gatilhosExistentes = await chamar<{
    trigger?: { name: string; triggerId: string }[];
  }>(token, `${base}/triggers`);

  const NOME_ACIONADOR = "Float Video - eventos";
  let acionador = acharPorNome(gatilhosExistentes.trigger, NOME_ACIONADOR);

  if (acionador) {
    reaproveitados.push(NOME_ACIONADOR);
  } else {
    acionador = await chamar<{ name: string; triggerId: string }>(
      token,
      `${base}/triggers`,
      {
        method: "POST",
        body: JSON.stringify({
          name: NOME_ACIONADOR,
          type: "customEvent",
          customEventFilter: [
            {
              type: "matchRegex",
              parameter: [
                { type: "template", key: "arg0", value: "{{_event}}" },
                {
                  type: "template",
                  key: "arg1",
                  value: "^floatvideo_(?!impression)",
                },
              ],
            },
          ],
        }),
      }
    );
  }

  // Sem o ID de métrica não dá para criar a tag: ela não saberia para
  // qual propriedade mandar. O acionador e as variáveis ficam prontos, e
  // o cliente conecta na tag do GA4 que ele já tiver.
  if (!measurementId) {
    return {
      workspace: workspace.name,
      variaveis: [video.name, ctaType.name],
      acionador: acionador.name,
      tag: null,
      reaproveitados,
      aviso:
        "Sem o ID de métrica do GA4, a tag não foi criada. Ligue o acionador “Float Video - eventos” na sua tag do GA4.",
    };
  }

  // 4. Tag do GA4.
  const tagsExistentes = await chamar<{ tag?: { name: string }[] }>(
    token,
    `${base}/tags`
  );

  const NOME_TAG = "GA4 - Float Video";
  const tagExistente = acharPorNome(tagsExistentes.tag, NOME_TAG);

  if (tagExistente) {
    reaproveitados.push(NOME_TAG);
    return {
      workspace: workspace.name,
      variaveis: [video.name, ctaType.name],
      acionador: acionador.name,
      tag: tagExistente.name,
      reaproveitados,
      aviso:
        "A tag já existia e foi mantida como está — não sobrescrevemos configuração que você pode ter ajustado.",
    };
  }

  const tag = await chamar<{ name: string }>(token, `${base}/tags`, {
    method: "POST",
    body: JSON.stringify({
      name: NOME_TAG,
      type: "gaawe",
      // Espelha a tag que já funciona no contêiner da Agência do Alê: os
      // campos vieram da exportação real do GTM, não de suposição.
      tagFiringOption: "oncePerEvent",
      parameter: [
        // {{Event}} repassa ao GA4 o mesmo nome que chegou, então uma tag
        // dá conta de todos os eventos — hoje e os futuros.
        { type: "template", key: "eventName", value: "{{Event}}" },
        { type: "boolean", key: "sendEcommerceData", value: "false" },
        {
          type: "template",
          key: "measurementIdOverride",
          value: measurementId,
        },
        {
          type: "list",
          key: "eventSettingsTable",
          list: [
            {
              type: "map",
              map: [
                { type: "template", key: "parameter", value: "video" },
                {
                  type: "template",
                  key: "parameterValue",
                  value: `{{${video.name}}}`,
                },
              ],
            },
            {
              type: "map",
              map: [
                { type: "template", key: "parameter", value: "cta_type" },
                {
                  type: "template",
                  key: "parameterValue",
                  value: `{{${ctaType.name}}}`,
                },
              ],
            },
          ],
        },
      ],
      firingTriggerId: [acionador.triggerId],
    }),
  });

  return {
    workspace: workspace.name,
    variaveis: [video.name, ctaType.name],
    acionador: acionador.name,
    tag: tag.name,
    reaproveitados,
  };
}
