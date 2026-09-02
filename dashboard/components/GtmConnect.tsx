"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Container = {
  path: string;
  name: string;
  publicId: string;
  conta: string;
};

type Resultado = {
  workspace: string;
  variaveis: string[];
  acionador: string;
  tag: string | null;
  aviso?: string;
};

/**
 * Conecta a conta do Google e cria a configuração no Tag Manager do
 * cliente — o que antes era um tutorial de seis passos.
 *
 * Nada é publicado por nós: tudo nasce numa área de trabalho separada, e
 * quem revisa e publica é o dono do site.
 */
export default function GtmConnect({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const conectado = params.get("gtm") === "conectado";
  const erroNoRetorno = params.get("gtm") === "erro";

  const [containers, setContainers] = useState<Container[] | null>(null);
  const [escolhido, setEscolhido] = useState("");
  const [medida, setMedida] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const carregarContainers = useCallback(async () => {
    setErro("");

    // A cota do Google é de 30 consultas por minuto, e listar de novo a
    // cada recarga da página queimava esse limite à toa. Dentro da mesma
    // sessão do navegador, a lista é reaproveitada.
    try {
      const guardado = sessionStorage.getItem("fvw_gtm_containers");
      if (guardado) {
        const lista = JSON.parse(guardado) as Container[];
        setContainers(lista);
        if (lista.length === 1) setEscolhido(lista[0].path);
        return;
      }
    } catch {}

    setCarregando(true);
    const resposta = await fetch("/api/gtm/containers");
    const dados = await resposta.json();
    setCarregando(false);

    if (!resposta.ok) {
      setErro(dados.error ?? "Não foi possível listar seus contêineres.");
      return;
    }

    const lista = (dados.containers ?? []) as Container[];
    setContainers(lista);
    if (lista.length === 1) setEscolhido(lista[0].path);
    try {
      sessionStorage.setItem("fvw_gtm_containers", JSON.stringify(lista));
    } catch {}
  }, []);

  useEffect(() => {
    // Buscar ao voltar do Google é o ponto do efeito: não há clique
    // nenhum depois do redirecionamento, e é aí que os contêineres
    // precisam aparecer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (conectado) carregarContainers();
  }, [conectado, carregarContainers]);

  async function instalar() {
    setErro("");
    setCarregando(true);
    const resposta = await fetch("/api/gtm/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerPath: escolhido, measurementId: medida }),
    });
    const dados = await resposta.json();
    setCarregando(false);

    if (!resposta.ok) {
      setErro(dados.error ?? "Não foi possível criar a configuração.");
      return;
    }
    setResultado(dados);
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
          {carregando && !containers && (
            <p className="text-xs text-neutral-500">Buscando seus contêineres...</p>
          )}

          {containers && containers.length === 0 && (
            <p className="text-xs text-neutral-600">
              Nenhum contêiner de site encontrado nesta conta do Google.
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
                      {c.conta} — {c.name} ({c.publicId})
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

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
