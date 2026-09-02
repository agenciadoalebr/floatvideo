"use client";

import { useEffect, useState } from "react";
import GtmConnect from "@/components/GtmConnect";

export default function EmbedCodeBox({
  embedKey,
  projectId,
  gtmDisponivel,
}: {
  embedKey: string;
  projectId: string;
  /** Sem as credenciais do Google configuradas, o atalho nem aparece. */
  gtmDisponivel: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [origem, setOrigem] = useState("");

  // A origem do widget vem de configuração, não de onde o painel foi
  // aberto. Sem isso, abrir o painel por um endereço alternativo (o
  // .vercel.app, uma URL de preview) gerava um código de instalação
  // apontando pra lá — e o site do cliente ficaria preso a esse endereço.
  // Só cai no window.location.origin se a variável não estiver definida.
  // window só existe depois da hidratação; ler no render causaria
  // divergência entre servidor e cliente. Roda uma vez, na montagem.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigem(process.env.NEXT_PUBLIC_WIDGET_ORIGIN || window.location.origin);
  }, []);

  const code = `<script>window.FVW_EMBED_KEY = "${embedKey}";</script>\n<script async src="${origem}/embed.js"></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* O atalho vem antes do código: quem pode instalar em dois cliques
          não deveria precisar ler um passo a passo pra descobrir isso. */}
      {gtmDisponivel && <GtmConnect projectId={projectId} />}

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-700">
          {gtmDisponivel
            ? "Ou cole este código no seu site"
            : "Cole este código no seu site"}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Antes do fechamento do <code>&lt;/body&gt;</code>. Funciona em
          qualquer site: WordPress (Elementor ou rodapé do tema), Nuvemshop,
          VTEX, Shopify (theme.liquid), Tray, Loja Integrada, Wix — e também
          por dentro do Google Tag Manager, como tag de HTML personalizado
          disparando em todas as páginas.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-brand-ink p-3 text-xs text-neutral-100">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="btn-brand mt-3 rounded-md px-3 py-1.5 text-xs font-medium"
        >
          {copied ? "Copiado!" : "Copiar código"}
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
        <p className="font-medium text-neutral-700">Como conferir se funcionou</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Abra o site numa janela anônima.</li>
          <li>Espere o tempo configurado em &quot;Aparece depois de&quot;.</li>
          <li>
            Se você fechou o balão em algum teste, aquele vídeo some{" "}
            <strong>naquele navegador</strong> pelo tempo escolhido em
            Widget (1 hora, por padrão). Vale só para o vídeo fechado: os das
            outras páginas continuam aparecendo. Para trazer todos de volta na
            hora, abra a página com <code>?fvw_reset</code> no fim da URL —
            ex.: <code>seusite.com.br/?fvw_reset</code>.
          </li>
        </ol>
        <p className="mt-2">
          Se o projeto tem domínio definido, o widget só aparece nesse domínio.
          Em qualquer outro ele simplesmente não carrega, sem erro visível.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 text-xs text-neutral-600">
        <p className="text-sm font-semibold text-neutral-700">
          Medir conversões no Google Analytics e no Google Ads
        </p>
        <p className="mt-1">
          Não precisa mexer no site: o código acima já manda os eventos. O
          passo a passo do GTM, a lista completa de eventos e como marcar a
          conversão no Google Ads estão em{" "}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("fvw-goto-tab", { detail: "analytics" })
              )
            }
            className="font-medium text-brand-blue underline"
          >
            Analytics do site
          </button>
          .
        </p>
        <p className="mt-2 text-neutral-500">
          O que a pessoa digita num formulário <strong>não</strong> vai para o
          dataLayer — ele é visível a qualquer script da página. Esses dados
          ficam só no painel de Leads.
        </p>
      </div>

    </div>
  );
}
