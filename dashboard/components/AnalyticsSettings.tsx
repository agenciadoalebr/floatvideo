"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Widget } from "@/lib/types";

type Props = {
  widget: Widget | null;
};

/** Cada evento que o widget manda pra fora, na ordem em que acontecem. */
const EVENTOS: { nome: string; quando: string }[] = [
  {
    nome: "floatvideo_impression",
    quando: "O balão apareceu na tela (depois do tempo de espera).",
  },
  {
    nome: "floatvideo_expand",
    quando: "A pessoa clicou no balão e abriu o vídeo.",
  },
  {
    nome: "floatvideo_play",
    quando:
      "O vídeo começou a tocar já aberto. É a base da retenção — uma vez por abertura.",
  },
  {
    nome: "floatvideo_progress_3s",
    quando: "Passou dos 3 segundos assistindo.",
  },
  { nome: "floatvideo_progress_25", quando: "Passou de 25% do vídeo." },
  { nome: "floatvideo_progress_50", quando: "Passou da metade." },
  { nome: "floatvideo_progress_75", quando: "Passou de 75%." },
  { nome: "floatvideo_complete", quando: "Assistiu até o fim." },
  {
    nome: "floatvideo_cta_click",
    quando:
      "A pessoa concluiu a ação: clicou no WhatsApp, enviou o formulário, clicou em Comprar ou abriu o link. Nos formulários é o envio que conta — abrir o formulário e desistir não dispara nada. É este que vale marcar como conversão no Google Ads.",
  },
  {
    nome: "floatvideo_close",
    quando: "Fechou o balão no X (não conta o recolher do vídeo).",
  },
];

const MODOS: { valor: Widget["analytics_mode"]; nome: string; ajuda: string }[] =
  [
    {
      valor: "auto",
      nome: "Automático (recomendado)",
      ajuda:
        "Usa o dataLayer do GTM e só chama o gtag quando não há GTM na página.",
    },
    {
      valor: "gtm",
      nome: "Só Google Tag Manager",
      ajuda: "Manda apenas pelo dataLayer.",
    },
    {
      valor: "gtag",
      nome: "Só gtag (GA4 direto)",
      ajuda: "Para sites com o GA4 instalado sem GTM.",
    },
    {
      valor: "none",
      nome: "Não enviar",
      ajuda: "Nada sai da página. As métricas deste painel continuam iguais.",
    },
  ];

/**
 * Integração com o Analytics do site do cliente. Fica numa aba própria, e
 * não junto do comportamento do widget, porque quase nunca se mexe nisso
 * ao editar o widget — mas quando se mexe, é junto com quem cuida do GTM,
 * e essa pessoa precisa da lista de eventos na mesma tela.
 */
export default function AnalyticsSettings({ widget }: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<Widget["analytics_mode"]>(
    widget?.analytics_mode ?? "auto"
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!widget) return;
    setErro("");
    setSalvando(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("widgets")
      .update({ analytics_mode: modo })
      .eq("id", widget.id);

    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 4000);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">
              Enviar eventos para o Analytics do site
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              O widget avisa o site a cada passo de quem assiste. Quem escuta
              esses avisos é o Google Tag Manager (ou o GA4 direto) do próprio
              cliente.
            </p>
          </div>

          <div>
            <select
              value={modo}
              onChange={(e) =>
                setModo(e.target.value as Widget["analytics_mode"])
              }
              disabled={!widget}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {MODOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              {MODOS.find((m) => m.valor === modo)?.ajuda}
            </p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900">
              <strong>Por que existe o automático:</strong> o gtag e o GTM
              dividem o mesmo dataLayer. Num site com os dois, mandar pelos
              dois caminhos faria o mesmo evento chegar duas vezes no GA4 — e a
              conversão apareceria dobrada.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !widget}
              className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            {salvo && !erro && (
              <span role="status" className="text-xs font-medium text-emerald-700">
                Salvo — já vale no site.
              </span>
            )}
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">
              Como ligar no Google Tag Manager
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Um gatilho só dá conta de todos os eventos, inclusive os que
              criarmos no futuro.
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs text-neutral-600">
              <strong>Precisa mesmo fazer isso?</strong> Com o script
              instalado, os eventos já chegam sozinhos na página. Mas o GTM
              ignora por padrão eventos que ele não conhece — sem um acionador,
              ele não repassa nada ao GA4. E não dá para configurarmos isso
              daqui: as tags vivem dentro da conta do cliente.
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Em site com GA4 direto, <strong>sem</strong> GTM, não há esse
              passo: o evento já entra no GA4 sozinho.
            </p>
          </div>
          <ol className="list-decimal space-y-2 pl-4 text-xs text-neutral-600">
            <li>
              No GTM, crie um <strong>Acionador</strong> do tipo &quot;Evento
              personalizado&quot;.
            </li>
            <li>
              No nome do evento, escreva{" "}
              <code className="rounded bg-neutral-100 px-1">floatvideo_.*</code>{" "}
              e marque <strong>&quot;Usar correspondência de expressão
              regular&quot;</strong>.
            </li>
            <li>
              Crie uma <strong>Tag</strong> do GA4 (Evento) e use{" "}
              <code className="rounded bg-neutral-100 px-1">{"{{Event}}"}</code>{" "}
              como nome do evento — assim ele repassa o nome que chegou.
            </li>
            <li>
              Para marcar conversão no Google Ads, use o{" "}
              <code className="rounded bg-neutral-100 px-1">
                floatvideo_cta_click
              </code>
              .
            </li>
          </ol>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs font-medium text-neutral-700">
              Opcional: saber de qual vídeo veio cada clique
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Com os passos acima você já mede <em>quantos</em> cliques houve.
              Os detalhes (qual vídeo, qual tipo de botão) vêm dentro do evento,
              mas o GTM só os enxerga se você apontar um dedo para cada campo —
              é o que ele chama de variável de camada de dados.
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-neutral-600">
              <li>
                <strong>Variáveis</strong> → em &quot;Variáveis definidas pelo
                usuário&quot;, <strong>Novo</strong> → tipo{" "}
                <strong>Variável de camada de dados</strong>.
              </li>
              <li>
                Em &quot;Nome da variável da camada de dados&quot;, escreva
                exatamente{" "}
                <code className="rounded bg-neutral-100 px-1">
                  floatvideo.video
                </code>{" "}
                — com o ponto, que é como o GTM entra dentro do objeto. Dê o
                nome <strong>FV - vídeo</strong> à variável e salve.
              </li>
              <li>
                Repita com{" "}
                <code className="rounded bg-neutral-100 px-1">
                  floatvideo.cta_type
                </code>
                , chamando de <strong>FV - tipo de CTA</strong>.
              </li>
              <li>
                Na tag do GA4 → <strong>Parâmetros do evento</strong>, adicione
                duas linhas: <code className="rounded bg-neutral-100 px-1">video</code>{" "}
                com o valor{" "}
                <code className="rounded bg-neutral-100 px-1">
                  {"{{FV - vídeo}}"}
                </code>
                , e{" "}
                <code className="rounded bg-neutral-100 px-1">cta_type</code> com{" "}
                <code className="rounded bg-neutral-100 px-1">
                  {"{{FV - tipo de CTA}}"}
                </code>
                .
              </li>
              <li>
                <strong>No GA4</strong> (não no GTM): Administrador →
                Definições personalizadas → Criar dimensão personalizada, escopo{" "}
                <em>Evento</em>, para os parâmetros{" "}
                <code className="rounded bg-neutral-100 px-1">video</code> e{" "}
                <code className="rounded bg-neutral-100 px-1">cta_type</code>.
              </li>
            </ol>
            <p className="mt-2 text-xs text-neutral-500">
              Esse último passo é o mais esquecido: sem ele o parâmetro chega no
              GA4, mas não aparece em nenhum relatório. E o GA4 não preenche o
              que passou — vale fazer antes de começar a campanha.
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            Para conferir se está chegando: abra o Preview do GTM, ou digite{" "}
            <code className="rounded bg-neutral-100 px-1">dataLayer</code> no
            console do navegador na página do cliente.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-700">
            Eventos que o widget envia
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Na ordem em que acontecem. Todos levam junto um objeto{" "}
            <code className="rounded bg-neutral-100 px-1">floatvideo</code> com
            o widget, a página e o vídeo.
          </p>
        </div>
        <ul className="divide-y divide-neutral-100 text-xs">
          {EVENTOS.map((e) => (
            <li key={e.nome} className="py-2">
              <code className="rounded bg-neutral-100 px-1 text-neutral-800">
                {e.nome}
              </code>
              <p className="mt-1 text-neutral-600">{e.quando}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-400">
          No <code className="rounded bg-neutral-100 px-1">cta_click</code> vão
          também <code className="rounded bg-neutral-100 px-1">cta_type</code> e{" "}
          <code className="rounded bg-neutral-100 px-1">cta_label</code>; no
          botão Comprar, mais um{" "}
          <code className="rounded bg-neutral-100 px-1">botao_encontrado</code>,
          que diz se o botão de compra da loja foi localizado.
        </p>
        <p className="text-xs text-neutral-400">
          Dados de lead (nome, telefone, e-mail) <strong>nunca</strong> entram
          aí: o dataLayer é visível para qualquer script da página.
        </p>
      </div>
    </div>
  );
}
