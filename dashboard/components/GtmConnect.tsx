"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Conta = { path: string; nome: string };
type Container = { path: string; name: string; publicId: string };

type Resultado = {
  workspace: string;
  tag: string;
  jaExistia: boolean;
  /** Nome da versão publicada, quando a publicação foi pedida. */
  publicado?: string;
  aviso?: string;
};

/**
 * Lê a resposta com cuidado: quando a função estoura o tempo, o que volta
 * é uma página de erro, não JSON — e um JSON.parse quebrando aqui deixava
 * a tela presa em "carregando" para sempre.
 */
async function lerResposta(resposta: Response) {
  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.includes("json")) {
    throw new Error(
      resposta.status === 504
        ? "A busca demorou demais e foi interrompida. Tente de novo."
        : `O servidor respondeu ${resposta.status}. Tente de novo.`
    );
  }
  return resposta.json();
}

/**
 * Instala o widget pelo Google Tag Manager, sem ninguém precisar tocar
 * no código do site.
 *
 * Faz uma coisa só: cria a tag que carrega o vídeo, disparando em todas
 * as páginas. Medir eventos no GA4 é assunto de quem trabalha com
 * marketing e já sabe o que fazer com eles — isso fica no passo a passo
 * manual, na seção Analytics do site. Aqui o alvo é o dono de um site que
 * não mexe com código e só quer o vídeo no ar.
 *
 * A escolha é em duas etapas (conta, depois contêiner) por causa da cota
 * do Google: 30 consultas por minuto. Listar os contêineres de todas as
 * contas de uma vez custava uma chamada por conta, o que numa agência com
 * dezenas de clientes estourava o limite sempre — e nenhuma retentativa
 * resolve isso. Assim são duas chamadas, não importa o tamanho da
 * agência. De quebra, quem atende vários clientes já sabe de qual deles
 * está falando.
 *
 * Nada é publicado por nós: tudo nasce numa área de trabalho separada, e
 * quem revisa e publica é o dono do site.
 */
export default function GtmConnect({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const conectado = params.get("gtm") === "conectado";
  const erroNoRetorno = params.get("gtm") === "erro";

  const [contas, setContas] = useState<Conta[] | null>(null);
  const [conta, setConta] = useState("");
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [escolhido, setEscolhido] = useState("");
  // Publicar coloca no ar na hora, no site do cliente. Fica desligado por
  // padrão: quem aperta esse botão deve saber que está apertando.
  const [publicar, setPublicar] = useState(params.get("publicar") === "1");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const buscar = useCallback(async (url: string) => {
    const resposta = await fetch(url, {
      // Rede travada não pode virar tela girando.
      signal: AbortSignal.timeout(30000),
    });
    const dados = await lerResposta(resposta);
    if (!resposta.ok) throw new Error(dados.error ?? "Falha na consulta.");
    return dados;
  }, []);

  const carregarContainers = useCallback(
    async (contaPath: string) => {
      setErro("");
      setContainers(null);
      setEscolhido("");
      setCarregando(true);
      try {
        const dados = await buscar(
          `/api/gtm/containers?conta=${encodeURIComponent(contaPath)}`
        );
        const lista = (dados.containers ?? []) as Container[];
        setContainers(lista);
        if (lista.length === 1) setEscolhido(lista[0].path);
      } catch (e) {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível listar os contêineres."
        );
      } finally {
        setCarregando(false);
      }
    },
    [buscar]
  );

  const carregarContas = useCallback(async () => {
    setErro("");
    setCarregando(true);
    try {
      const dados = await buscar("/api/gtm/containers");
      const lista = (dados.contas ?? []) as Conta[];
      setContas(lista);

      // Conta única já vem escolhida — e os contêineres dela precisam vir
      // junto. Antes a busca dependia do evento de troca do campo, que
      // nunca acontecia: a pessoa via a conta selecionada e nenhum
      // contêiner, e só destravava mudando o valor e voltando.
      if (lista.length === 1) {
        setConta(lista[0].path);
        await carregarContainers(lista[0].path);
      }
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível listar suas contas."
      );
    } finally {
      setCarregando(false);
    }
  }, [buscar, carregarContainers]);

  useEffect(() => {
    // Buscar ao voltar do Google é o ponto do efeito: não há clique
    // nenhum depois do redirecionamento.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (conectado && !contas) carregarContas();
  }, [conectado, contas, carregarContas]);

  /**
   * Encerra a conexão deste navegador. Como não guardamos token em banco,
   * desconectar é apagar o cookie de curta duração — e voltar a tela ao
   * estado inicial para a pessoa poder entrar com outra conta.
   */
  async function desconectar() {
    setErro("");
    await fetch("/api/gtm/desconectar", { method: "POST" }).catch(() => {});
    setContas(null);
    setConta("");
    setContainers(null);
    setEscolhido("");
    setResultado(null);
    // Tira o "?gtm=conectado" da URL, senão a tela voltaria a achar que
    // ainda há conexão ao recarregar.
    router.replace(pathname + "?secao=instalacao");
  }

  async function instalar() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/gtm/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerPath: escolhido,
          projectId,
          publicar,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const dados = await lerResposta(resposta);
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível criar a configuração.");
        return;
      }
      setResultado(dados);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível criar a configuração."
      );
    } finally {
      setCarregando(false);
    }
  }

  if (resultado) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-900">
          {resultado.jaExistia
            ? "O vídeo já estava instalado neste contêiner"
            : "Vídeo instalado no seu Tag Manager"}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-emerald-900">
          <li>Tag: {resultado.tag}</li>
          <li>Dispara em: todas as páginas</li>
          <li>Área de trabalho: {resultado.workspace}</li>
        </ul>
        {resultado.aviso && (
          <p className="mt-2 text-xs text-emerald-800">{resultado.aviso}</p>
        )}
        {resultado.publicado ? (
          <p className="mt-3 text-xs text-emerald-800">
            <strong>Publicado.</strong> O vídeo já está no ar. Se algo sair
            diferente do esperado, o Tag Manager permite voltar à versão
            anterior a qualquer momento.
          </p>
        ) : (
          <p className="mt-3 text-xs text-emerald-800">
            <strong>Falta publicar.</strong> O vídeo só aparece no site
            depois disso. No Tag Manager, troque a área de trabalho no
            seletor do topo da coluna esquerda (costuma estar em
            &ldquo;Default Workspace&rdquo;) para{" "}
            <strong>{resultado.workspace}</strong>, confira a tag e clique em
            Enviar → Publicar.
          </p>
        )}
        <button
          type="button"
          onClick={desconectar}
          className="mt-3 text-xs font-medium text-emerald-800 underline"
        >
          Desconectar do Google
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-outline-soft bg-surface-soft p-4">
      <p className="text-sm font-medium text-ink">
        Instalar pelo Google Tag Manager
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Se o seu site usa o Google Tag Manager, conecte a conta e nós criamos a
        tag do vídeo para você — sem mexer no código do site.
      </p>

      {erroNoRetorno && !erro && (
        <p className="mt-2 text-xs text-red-600">
          A conexão não foi concluída. Tente de novo.
        </p>
      )}

      {!conectado && (
        <div className="mt-3 space-y-3">
          <label className="flex items-start gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={publicar}
              onChange={(e) => setPublicar(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Publicar automaticamente ao terminar
              <span className="mt-0.5 block text-ink-faint">
                Coloca o vídeo no ar na hora. Sem marcar, deixamos tudo pronto
                numa área de trabalho e você publica quando quiser. A permissão
                de publicar só é pedida ao Google se você marcar aqui.
              </span>
            </span>
          </label>

          <a
            href={`/api/gtm/start?projectId=${projectId}${
              publicar ? "&publicar=1" : ""
            }`}
            className="btn-brand inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Conectar ao Google Tag Manager
          </a>
        </div>
      )}

      {conectado && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-outline-soft bg-surface-card px-3 py-2">
            <span className="text-xs text-ink-muted">
              Conta do Google conectada
            </span>
            <button
              type="button"
              onClick={desconectar}
              className="text-xs font-medium text-ink-faint underline hover:text-brand-blue"
            >
              Desconectar
            </button>
          </div>

          <p className="text-xs text-ink-faint">
            Desconectar encerra a conexão aqui e permite entrar com outra
            conta. Para tirar a permissão do FloatVideo por completo, o
            caminho é a{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brand-blue"
            >
              sua conta do Google
            </a>
            .
          </p>

          {carregando && !contas && (
            <p className="text-xs text-ink-faint">Buscando suas contas...</p>
          )}

          {contas && contas.length === 0 && (
            <p className="text-xs text-ink-muted">
              Nenhuma conta do Tag Manager nesta conta do Google.
            </p>
          )}

          {contas && contas.length > 0 && (
            <label className="block">
              <span className="text-xs text-ink-muted">Conta</span>
              <select
                value={conta}
                onChange={(e) => {
                  setConta(e.target.value);
                  if (e.target.value) carregarContainers(e.target.value);
                }}
                className="mt-1 w-full rounded-md border border-outline px-3 py-2 text-sm"
              >
                <option value="">Escolha a conta...</option>
                {contas.map((c) => (
                  <option key={c.path} value={c.path}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          )}

          {carregando && contas && (
            <p className="text-xs text-ink-faint">
              Buscando os contêineres...
            </p>
          )}

          {containers && containers.length === 0 && (
            <p className="text-xs text-ink-muted">
              Esta conta não tem contêiner de site.
            </p>
          )}

          {containers && containers.length > 0 && (
            <>
              <label className="block">
                <span className="text-xs text-ink-muted">Contêiner</span>
                <select
                  value={escolhido}
                  onChange={(e) => setEscolhido(e.target.value)}
                  className="mt-1 w-full rounded-md border border-outline px-3 py-2 text-sm"
                >
                  <option value="">Escolha...</option>
                  {containers.map((c) => (
                    <option key={c.path} value={c.path}>
                      {c.name} ({c.publicId})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={instalar}
                disabled={!escolhido || carregando}
                className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {carregando ? "Instalando..." : "Instalar o vídeo"}
              </button>
            </>
          )}
        </div>
      )}

      {erro && (
        <div className="mt-2">
          <p className="text-xs text-red-600">{erro}</p>
          {conectado && (
            <button
              type="button"
              onClick={() =>
                conta ? carregarContainers(conta) : carregarContas()
              }
              className="mt-1 text-xs font-medium text-brand-blue hover:underline"
            >
              Tentar de novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
