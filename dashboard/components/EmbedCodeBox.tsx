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
            Se você fechou o balão em algum teste, ele fica suprimido por 7 dias
            naquele navegador — a janela anônima evita isso.
          </li>
        </ol>
        <p className="mt-2">
          Se o projeto tem domínio definido, o widget só aparece nesse domínio.
          Em qualquer outro ele simplesmente não carrega, sem erro visível.
        </p>
      </div>
    </div>
  );
}
