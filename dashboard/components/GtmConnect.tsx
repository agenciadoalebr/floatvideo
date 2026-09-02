"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Conta = { path: string; nome: string };
type Container = { path: string; name: string; publicId: string };

type Resultado = {
  workspace: string;
  variaveis: string[];
  acionador: string;
  tag: string | null;
  /** O que já existia e foi aproveitado em vez de duplicado. */
  reaproveitados?: string[];
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
 * Conecta a conta do Google e cria a configuração no Tag Manager do
 * cliente — o que antes era um tutorial de seis passos.
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
  const params = useSearchParams();
  const conectado = params.get("gtm") === "conectado";
  const erroNoRetorno = params.get("gtm") === "erro";

  const [contas, setContas] = useState<Conta[] | null>(null);
  const [conta, setConta] = useState("");
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [escolhido, setEscolhido] = useState("");
  const [medida, setMedida] = useState("");
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

  const carregarContas = useCallback(async () => {
    setErro("");
    setCarregando(true);
    try {
      const dados = await buscar("/api/gtm/containers");
      const lista = (dados.contas ?? []) as Conta[];
      setContas(lista);
      if (lista.length === 1) setConta(lista[0].path);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível listar suas contas."
      );
    } finally {
      setCarregando(false);
    }
  }, [buscar]);

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

  useEffect(() => {
    // Buscar ao voltar do Google é o ponto do efeito: não há clique
    // nenhum depois do redirecionamento.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (conectado && !contas) carregarContas();
  }, [conectado, contas, carregarContas]);

  async function instalar() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/gtm/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerPath: escolhido,
          measurementId: medida,
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
          Configuração criada no seu Tag Manager
        </p>
        <ul className="mt-2 space-y-1 text-xs text-emerald-900">
          <li>Área de trabalho: {resultado.workspace}</li>
          <li>Variáveis: {resultado.variaveis.join(", ")}</li>
          <li>Acionador: {resultado.acionador}</li>
          {resultado.tag && <li>Tag: {resultado.tag}</li>}
        </ul>
        {resultado.reaproveitados && resultado.reaproveitados.length > 0 && (
          <p className="mt-2 text-xs text-emerald-800">
            Já existia e foi aproveitado, sem duplicar:{" "}
            {resultado.reaproveitados.join(", ")}.
          </p>
        )}
        {resultado.aviso && (
          <p className="mt-2 text-xs text-emerald-800">{resultado.aviso}</p>
        )}
        <p className="mt-3 text-xs text-emerald-800">
          <strong>Falta você publicar.</strong> Abra o Tag Manager, revise a
          área de trabalho <em>{resultado.workspace}</em> e clique em Enviar →
          Publicar. Não publicamos nada por conta própria.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm font-medium text-neutral-700">
        Configurar automaticamente
      </p>
      <p className="mt-1 text-xs text-neutral-600">
        Conecte sua conta do Google e criamos o acionador, as variáveis e a tag
        do GA4 no seu contêiner — em vez de você seguir o passo a passo abaixo.
      </p>

      {erroNoRetorno && !erro && (
        <p className="mt-2 text-xs text-red-600">
          A conexão não foi concluída. Tente de novo.
        </p>
      )}

      {!conectado && (
        <a
          href={`/api/gtm/start?projectId=${projectId}`}
          className="btn-brand mt-3 inline-block rounded-md px-4 py-2 text-sm font-medium"
        >
          Conectar ao Google Tag Manager
        </a>
      )}

      {conectado && (
        <div className="mt-3 space-y-3">
          {carregando && !contas && (
            <p className="text-xs text-neutral-500">Buscando suas contas...</p>
          )}

          {contas && contas.length === 0 && (
            <p className="text-xs text-neutral-600">
              Nenhuma conta do Tag Manager nesta conta do Google.
            </p>
          )}

          {contas && contas.length > 0 && (
            <label className="block">
              <span className="text-xs text-neutral-600">Conta</span>
              <select
                value={conta}
                onChange={(e) => {
                  setConta(e.target.value);
                  if (e.target.value) carregarContainers(e.target.value);
                }}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
            <p className="text-xs text-neutral-500">
              Buscando os contêineres...
            </p>
          )}

          {containers && containers.length === 0 && (
            <p className="text-xs text-neutral-600">
              Esta conta não tem contêiner de site.
            </p>
          )}

          {containers && containers.length > 0 && (
            <>
              <label className="block">
                <span className="text-xs text-neutral-600">Contêiner</span>
                <select
                  value={escolhido}
                  onChange={(e) => setEscolhido(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Escolha...</option>
                  {containers.map((c) => (
                    <option key={c.path} value={c.path}>
                      {c.name} ({c.publicId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-neutral-600">
                  ID de métrica do GA4 (opcional)
                </span>
                <input
                  value={medida}
                  onChange={(e) => setMedida(e.target.value.trim())}
                  placeholder="G-XXXXXXXXXX"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-blue"
                />
                <span className="mt-1 block text-xs text-neutral-500">
                  Com ele criamos também a tag do GA4. Sem ele, criamos só o
                  acionador e as variáveis, e você liga na tag que já tiver.
                </span>
              </label>

              <button
                type="button"
                onClick={instalar}
                disabled={!escolhido || carregando}
                className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {carregando ? "Criando..." : "Criar configuração"}
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
