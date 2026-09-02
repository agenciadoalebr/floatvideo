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
 * 2. A permissão de publicar é opcional e só é pedida quando a pessoa
 *    marca a opção. Por padrão criamos tudo numa área de trabalho
 *    separada e quem publica é o dono do site, depois de ver o que foi
 *    criado — publicar coloca no ar, na hora, e essa decisão é dele.
 */
const API = "https://tagmanager.googleapis.com/tagmanager/v2";

const ESCOPOS_BASE = [
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
];

/**
 * Publicar é pedido à parte, e só quando a pessoa marca a opção.
 * Permissão que não se usa não se pede: cada escopo a mais aparece na
 * tela de consentimento do cliente e precisa ser justificado na
 * verificação do Google.
 */
const ESCOPO_PUBLICAR = "https://www.googleapis.com/auth/tagmanager.publish";

export function escopos(comPublicacao: boolean) {
  return (
    comPublicacao ? [...ESCOPOS_BASE, ESCOPO_PUBLICAR] : ESCOPOS_BASE
  ).join(" ");
}

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

export function urlDeAutorizacao(
  origem: string,
  state: string,
  comPublicacao = false
) {
  const params = new URLSearchParams({
    client_id: process.env.GTM_OAUTH_CLIENT_ID ?? "",
    redirect_uri: urlDeRedirecionamento(origem),
    response_type: "code",
    scope: escopos(comPublicacao),
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

/**
 * Acha uma entidade pelo nome, ignorando maiúsculas e espaços à toa.
 */
function acharPorNome<T extends { name?: string }>(
  lista: T[] | undefined,
  nome: string
): T | undefined {
  const alvo = nome.trim().toLowerCase();
  return (lista ?? []).find((i) => (i.name ?? "").trim().toLowerCase() === alvo);
}

/**
 * Acionador interno "All Pages" do GTM. O id é o mesmo em todo contêiner
 * — é o que a exportação do contêiner da Agência do Alê mostrou na tag
 * do widget, e é o que evita criar um acionador nosso para algo que já
 * existe em qualquer conta.
 */
const TODAS_AS_PAGINAS = "2147479553";

export const NOME_TAG_WIDGET = "FloatVideo — vídeo flutuante";

export type ResultadoInstalacao = {
  workspace: string;
  workspacePath: string;
  tag: string;
  jaExistia: boolean;
  /** Nome da versão publicada, quando a publicação foi pedida. */
  publicado?: string;
  aviso?: string;
};

/**
 * Cria uma versão a partir da área de trabalho e publica.
 *
 * Separado da criação de propósito: publicar coloca no ar, na hora, no
 * site do cliente. Ficar num passo próprio deixa claro no código — e na
 * tela — que é uma decisão diferente de "montar a configuração".
 */
export async function publicarWorkspace(token: string, workspacePath: string) {
  const versao = await chamar<{
    containerVersion?: { path: string; name: string };
  }>(token, `/${workspacePath}:create_version`, {
    method: "POST",
    body: JSON.stringify({
      name: "FloatVideo — instalação do widget",
      notes: "Tag do FloatVideo criada pelo painel do FloatVideo.",
    }),
  });

  if (!versao.containerVersion?.path) {
    throw new Error(
      "O Google não gerou a versão. Publique pelo Tag Manager, se quiser."
    );
  }

  await chamar(token, `/${versao.containerVersion.path}:publish`, {
    method: "POST",
  });

  return versao.containerVersion.name;
}

/**
 * Instala o widget no contêiner: uma tag de HTML personalizado com o
 * mesmo código que a pessoa colaria no site, disparando em todas as
 * páginas.
 *
 * É só isso de propósito. Medição de eventos no GA4 é assunto de quem
 * trabalha com marketing e já sabe o que fazer com os eventos — está no
 * passo a passo manual do painel. Aqui o objetivo é o dono de um site,
 * sem conhecimento técnico, colocar o vídeo no ar sem tocar no tema.
 *
 * A operação é repetível: se a tag já existir, ela é aproveitada em vez
 * de duplicada — e não é sobrescrita, porque o cliente pode ter ajustado
 * onde ela dispara.
 */
export async function instalarWidgetNoContainer(
  token: string,
  contaPath: string,
  embedKey: string,
  origem: string
): Promise<ResultadoInstalacao> {
  const workspaces = await chamar<{
    workspace?: { path: string; name: string }[];
  }>(token, `/${contaPath}/workspaces`);

  let workspace = acharPorNome(workspaces.workspace, NOME_WORKSPACE);

  if (!workspace) {
    workspace = await chamar<{ path: string; name: string }>(
      token,
      `/${contaPath}/workspaces`,
      {
        method: "POST",
        body: JSON.stringify({
          name: NOME_WORKSPACE,
          description:
            "Instalação do FloatVideo. Revise e publique quando quiser.",
        }),
      }
    );
  }

  const base = `/${workspace.path}`;

  const tags = await chamar<{ tag?: { name: string }[] }>(token, `${base}/tags`);
  const existente = acharPorNome(tags.tag, NOME_TAG_WIDGET);

  if (existente) {
    return {
      workspace: workspace.name,
      workspacePath: workspace.path,
      tag: existente.name,
      jaExistia: true,
      aviso:
        "A tag já existia neste contêiner e foi mantida como está — não sobrescrevemos o que você possa ter ajustado.",
    };
  }

  const html =
    `<script>window.FVW_EMBED_KEY = ${JSON.stringify(embedKey)};</script>
` +
    `<script async src="${origem}/embed.js"></script>`;

  const tag = await chamar<{ name: string }>(token, `${base}/tags`, {
    method: "POST",
    body: JSON.stringify({
      name: NOME_TAG_WIDGET,
      type: "html",
      parameter: [
        { type: "template", key: "html", value: html },
        { type: "boolean", key: "supportDocumentWrite", value: "false" },
      ],
      firingTriggerId: [TODAS_AS_PAGINAS],
      tagFiringOption: "oncePerEvent",
    }),
  });

  return {
    workspace: workspace.name,
    workspacePath: workspace.path,
    tag: tag.name,
    jaExistia: false,
  };
}
