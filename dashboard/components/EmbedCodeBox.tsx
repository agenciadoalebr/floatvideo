"use client";

import { useEffect, useState } from "react";

export default function EmbedCodeBox({ embedKey }: { embedKey: string }) {
  const [copied, setCopied] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    setSiteUrl(window.location.origin);
  }, []);

  const code = `<script>window.FVW_EMBED_KEY = "${embedKey}";</script>\n<script async src="${siteUrl}/embed.js"></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-neutral-700">
        Cole este código no seu site
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Funciona no WordPress (Elementor / rodapé), Shopify (theme.liquid) e Google
        Tag Manager (tag de HTML customizado).
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="btn-brand mt-3 rounded-md px-3 py-1.5 text-xs font-medium"
      >
        {copied ? "Copiado!" : "Copiar código"}
      </button>
    </div>
  );
}
