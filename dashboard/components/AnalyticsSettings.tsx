"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Widget } from "@/lib/types";
import Copiavel from "@/components/Copiavel";

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
          <ol className="list-decimal space-y-4 pl-4 text-xs text-neutral-600">
            <li>
              <strong>Crie o acionador.</strong> No menu à esquerda, clique em{" "}
              <em>Acionadores</em> → <em>Novo</em>. Dê o nome{" "}
              <Copiavel texto="Float Video Event" /> no topo da tela. Clique na
              caixa <em>Configuração do acionador</em>, escolha{" "}
              <em>Evento personalizado</em> (fica no fim da lista, em
              &quot;Outros&quot;).
              <ul className="mt-2 list-disc space-y-1 pl-4 text-neutral-500">
                <li>
                  Em <em>Nome do evento</em>, escreva{" "}
                  <Copiavel texto="floatvideo_.*" />
                </li>
                <li>
                  Marque a caixinha{" "}
                  <em>Usar correspondência de expressão regular</em> — é ela que
                  faz um acionador só valer para todos os nossos eventos
                </li>
                <li>
                  Deixe <em>Este acionador é ativado em: Todos os eventos
                  personalizados</em>
                </li>
                <li>Clique em Salvar</li>
              </ul>
            </li>

            <li>
              <strong>Ligue a variável do nome do evento.</strong> Ainda no
              menu à esquerda, vá em <em>Variáveis</em> → em &quot;Variáveis
              integradas&quot;, clique em <em>Configurar</em> e marque{" "}
              <strong>Event</strong>. Sem isso o{" "}
              <Copiavel texto="{{Event}}" /> do passo seguinte não existe na
              sua conta.
            </li>

            <li>
              <strong>Crie a tag.</strong> Menu <em>Tags</em> → <em>Novo</em>.
              Dê o nome <Copiavel texto="GA4 - Float Video" />. Em{" "}
              <em>Configuração da tag</em>, escolha{" "}
              <em>Google Analytics: evento do GA4</em>.
              <ul className="mt-2 list-disc space-y-1 pl-4 text-neutral-500">
                <li>
                  Aponte para a sua configuração do GA4 (a tag de configuração
                  que já existe na conta, ou o ID de métrica{" "}
                  <code className="rounded bg-neutral-100 px-1">G-XXXXXXX</code>
                  )
                </li>
                <li>
                  Em <em>Nome do evento</em>, escreva{" "}
                  <Copiavel texto="{{Event}}" /> — assim a tag repassa ao GA4 o mesmo nome que chegou, e você
                  não precisa de uma tag por evento
                </li>
                <li>
                  Mais abaixo, em <em>Acionamento</em>, escolha{" "}
                  <strong>Float Video Event</strong>
                </li>
                <li>Salve</li>
              </ul>
            </li>

            <li>
              <strong>Teste antes de publicar.</strong> Clique em{" "}
              <em>Visualizar</em> (canto superior direito), informe o endereço
              do site e abra. Na janela que abrir, acrescente{" "}
              <Copiavel texto="?fvw_reset" /> no fim da URL, espere o balão aparecer, clique nele e clique no botão
              de ação. Os eventos{" "}
              <code className="rounded bg-neutral-100 px-1">floatvideo_...</code>{" "}
              vão aparecendo na coluna da esquerda do painel de depuração, e ao
              clicar em cada um dá para conferir se a tag disparou.
            </li>

            <li>
              <strong>Publique.</strong> De volta ao GTM, clique em{" "}
              <em>Enviar</em> → dê um nome à versão (ex.: &quot;Float
              Video&quot;) → <em>Publicar</em>. Antes disso, nada do que você
              configurou está valendo no site de verdade.
            </li>

            <li>
              <strong>Marque a conversão.</strong> No GA4: Administrador →{" "}
              <em>Eventos</em> → encontre{" "}
              <Copiavel texto="floatvideo_cta_click" /> e ligue a chave <em>Marcar como evento principal</em>. Ele só
              aparece nessa lista depois de acontecer pelo menos uma vez — se
              ainda não estiver lá, faça o teste do passo 4 e volte mais tarde.
              No Google Ads, importe esse evento como conversão.
            </li>
          </ol>

          <details className="rounded-md border border-neutral-200 bg-neutral-50 p-3 [&[open]>summary>span]:rotate-90">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-700 marker:content-none">
              <span className="inline-block transition-transform">›</span>
              Opcional: saber de qual vídeo veio cada clique
            </summary>
            <p className="mt-2 text-xs text-neutral-600">
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
                exatamente <Copiavel texto="floatvideo.video" /> — com o
                ponto, que é como o GTM entra dentro do objeto. Dê o nome{" "}
                <Copiavel texto="FV - vídeo" /> à variável e salve.
              </li>
              <li>
                Repita com <Copiavel texto="floatvideo.cta_type" />,
                chamando de <Copiavel texto="FV - tipo de CTA" />.
              </li>
              <li>
                Na tag do GA4 → <strong>Parâmetros do evento</strong>, adicione
                duas linhas: <Copiavel texto="video" /> com o valor{" "}
                <Copiavel texto="{{FV - vídeo}}" />, e{" "}
                <Copiavel texto="cta_type" /> com{" "}
                <Copiavel texto="{{FV - tipo de CTA}}" />.
              </li>
              <li>
                Este último é no painel do GA4, não no GTM (vale igual para
                quem usa gtag): Administrador → Definições personalizadas →
                Criar dimensão personalizada, escopo <em>Evento</em>, para os
                parâmetros <Copiavel texto="video" /> e{" "}
                <Copiavel texto="cta_type" />.
              </li>
            </ol>
            <p className="mt-2 text-xs text-neutral-500">
              Pular esse último passo não quebra nada: os eventos continuam
              chegando, sendo contados e servindo como conversão. O que ele
              muda é poder abrir um relatório e ver <em>qual vídeo</em> gerou
              os cliques, em vez de só o total. Mas o GA4 não preenche o que
              passou — feito depois, vale só dali para frente.
            </p>
          </details>
          <p className="text-xs text-neutral-400">
            Para conferir se está chegando: abra o Preview do GTM, ou digite{" "}
            <code className="rounded bg-neutral-100 px-1">dataLayer</code> no
            console do navegador na página do cliente.
          </p>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs text-neutral-600">
              <strong>Se o GA4 ficar poluído:</strong> a impressão dispara em
              toda página onde o balão aparece, então é o evento mais frequente
              de longe. Para deixá-la de fora, troque o nome do evento no
              acionador por{" "}
              <Copiavel
                bloco
                texto="floatvideo_(expand|play|progress_3s|progress_25|progress_50|progress_75|complete|cta_click|close)"
              />
              <span className="mt-1 block">
                Ou, mais curto e valendo também para eventos futuros:
              </span>
              <Copiavel bloco texto="^floatvideo_(?!impression)" />
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Lembre que essa lista é fixa: evento novo que criarmos aqui não
              entra no GA4 até ser acrescentado nela. As métricas deste painel
              não mudam — nelas a impressão é o denominador de tudo.
            </p>
          </div>
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
              <Copiavel texto={e.nome} />
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
