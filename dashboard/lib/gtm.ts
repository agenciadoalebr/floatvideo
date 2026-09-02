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

async function chamar<T>(
  token: string,
  caminho: string,
  init?: RequestInit
): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
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

/** Contêineres da web aos quais a pessoa tem acesso. */
export async function listarContainers(token: string): Promise<Container[]> {
  const contas = await chamar<{
    account?: { accountId: string; name: string; path: string }[];
  }>(token, "/accounts");

  const resultado: Container[] = [];

  for (const conta of contas.account ?? []) {
    const lista = await chamar<{
      container?: {
        accountId: string;
        containerId: string;
        path: string;
        name: string;
        publicId: string;
        usageContext?: string[];
      }[];
    }>(token, `/${conta.path}/containers`);

    for (const c of lista.container ?? []) {
      // Só contêiner de site: o widget não existe em app nem em AMP.
      if (c.usageContext && !c.usageContext.includes("web")) continue;
      resultado.push({
        accountId: c.accountId,
        containerId: c.containerId,
        path: c.path,
        name: c.name,
        publicId: c.publicId,
        conta: conta.name,
      });
    }
  }

  return resultado;
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
  aviso?: string;
};

/**
 * Cria, no contêiner escolhido, tudo o que o tutorial manual pedia: as
 * duas variáveis de camada de dados, o acionador dos nossos eventos e a
 * tag do GA4 que os repassa.
 *
 * A impressão fica de fora do acionador: ela dispara em toda página onde
 * o balão aparece, e encheria o relatório do cliente.
 */
export async function instalarNoContainer(
  token: string,
  contaPath: string,
  measurementId?: string
): Promise<ResultadoInstalacao> {
  const workspace = await chamar<{ path: string; name: string }>(
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

  // A variável interna "Event" precisa estar ligada para o {{Event}} da
  // tag existir. Ligar de novo o que já está ligado não é erro.
  await chamar(token, `/${workspace.path}/built_in_variables?type=event`, {
    method: "POST",
  }).catch(() => {});

  const video = await chamar<{ name: string; variableId: string }>(
    token,
    `/${workspace.path}/variables`,
    {
      method: "POST",
      body: JSON.stringify(
        variavelDeCamadaDeDados("FV - vídeo", "floatvideo.video")
      ),
    }
  );

  const ctaType = await chamar<{ name: string; variableId: string }>(
    token,
    `/${workspace.path}/variables`,
    {
      method: "POST",
      body: JSON.stringify(
        variavelDeCamadaDeDados("FV - tipo de CTA", "floatvideo.cta_type")
      ),
    }
  );

  const acionador = await chamar<{ name: string; triggerId: string }>(
    token,
    `/${workspace.path}/triggers`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Float Video - eventos",
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

  // Sem o ID de métrica não dá para criar a tag: ela não saberia para
  // qual propriedade mandar. O acionador e as variáveis ficam prontos, e
  // o cliente conecta na tag do GA4 que ele já tiver.
  if (!measurementId) {
    return {
      workspace: workspace.name,
      variaveis: [video.name, ctaType.name],
      acionador: acionador.name,
      tag: null,
      aviso:
        "Sem o ID de métrica do GA4, a tag não foi criada. Ligue o acionador “Float Video - eventos” na sua tag do GA4.",
    };
  }

  const tag = await chamar<{ name: string }>(
    token,
    `/${workspace.path}/tags`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "GA4 - Float Video",
        type: "gaawe",
        // Espelha a tag que já funciona no contêiner da Agência do Alê:
        // os campos vieram da exportação real do GTM, não de suposição.
        tagFiringOption: "oncePerEvent",
        parameter: [
          // {{Event}} repassa ao GA4 o mesmo nome que chegou, então uma
          // tag dá conta de todos os eventos — hoje e os futuros.
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
                    value: "{{FV - vídeo}}",
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
                    value: "{{FV - tipo de CTA}}",
                  },
                ],
              },
            ],
          },
        ],
        firingTriggerId: [acionador.triggerId],
      }),
    }
  );

  return {
    workspace: workspace.name,
    variaveis: [video.name, ctaType.name],
    acionador: acionador.name,
    tag: tag.name,
  };
}
