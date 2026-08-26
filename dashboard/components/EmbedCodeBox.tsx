"use client";

import { useEffect, useState } from "react";

export default function EmbedCodeBox({ embedKey }: { embedKey: string }) {
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
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-700">
          Cole este código no seu site
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Antes do fechamento do <code>&lt;/body&gt;</code>. Funciona no WordPress
          (Elementor / rodapé), Shopify (theme.liquid) e Google Tag Manager (tag
          de HTML customizado).
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
            Se você fechou o balão em algum teste, ele fica suprimido por 7
            dias <strong>naquele navegador</strong>. Para trazer de volta,
            abra a página com <code>?fvw_reset</code> no fim da URL — ex.:{" "}
            <code>seusite.com.br/?fvw_reset</code>.
          </li>
        </ol>
        <p className="mt-2">
          Se o projeto tem domínio definido, o widget só aparece nesse domínio.
          Em qualquer outro ele simplesmente não carrega, sem erro visível.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 text-xs text-neutral-600">
        <p className="text-sm font-semibold text-neutral-700">
          Medir conversões no Google Tag Manager
        </p>
        <p className="mt-1">
          O widget empurra os eventos para o <code>dataLayer</code> da página.
          Para contar o clique no WhatsApp como conversão, no GTM crie um
          acionador de <strong>Evento personalizado</strong> com o nome:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-brand-ink p-3 text-neutral-100">
          <code>floatvideo_cta_click</code>
        </pre>
        <p className="mt-2">
          e ligue nele a sua tag de conversão (Google Ads ou GA4). Não é
          preciso mexer no site: o código de instalação acima já faz isso.
        </p>

        <p className="mt-3 font-medium text-neutral-700">Eventos disponíveis</p>
        <ul className="mt-1 space-y-0.5">
          <li><code>floatvideo_impression</code> — o balão apareceu</li>
          <li><code>floatvideo_play</code> — o vídeo começou</li>
          <li><code>floatvideo_expand</code> — clicaram para assistir</li>
          <li><code>floatvideo_complete</code> — assistiram até o fim</li>
          <li><code>floatvideo_cta_click</code> — clicaram no botão de ação</li>
          <li><code>floatvideo_close</code> — fecharam o balão</li>
        </ul>

        <p className="mt-3 font-medium text-neutral-700">
          Dados que acompanham cada evento
        </p>
        <p className="mt-1">
          Ficam em <code>floatvideo</code> dentro do evento. Para usar no GTM,
          crie uma <strong>Variável da camada de dados</strong> com o nome, por
          exemplo, <code>floatvideo.cta_type</code>.
        </p>
        <ul className="mt-1 space-y-0.5">
          <li><code>cta_type</code> — <code>whatsapp</code>, <code>link</code> ou <code>form</code></li>
          <li><code>cta_label</code> — o texto do botão</li>
          <li><code>cta_url</code> — o destino do clique</li>
          <li><code>video</code> — qual vídeo estava tocando</li>
          <li><code>page_url</code> e <code>widget_id</code></li>
        </ul>
        <p className="mt-2 text-neutral-500">
          O que a pessoa digita num CTA de formulário{" "}
          <strong>não</strong> vai para o dataLayer — ele é visível a qualquer
          script da página. Esses dados ficam só no painel de Leads.
        </p>
      </div>
    </div>
  );
}
