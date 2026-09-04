"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GtmConnect from "@/components/GtmConnect";

/** Onde colar o código em cada plataforma. */
const PLATAFORMAS: { nome: string; onde: string }[] = [
  {
    nome: "Nuvemshop",
    onde: "Painel → Configurações → Códigos externos. Cole no campo do corpo da página e salve.",
  },
  {
    nome: "Shopify",
    onde: "Loja virtual → Temas → Ações → Editar código → theme.liquid, logo antes de </body>.",
  },
  {
    nome: "WordPress",
    onde: "Um plugin de inserir código no cabeçalho e rodapé, no campo do rodapé. Sem plugin, o footer.php do tema filho.",
  },
  {
    nome: "Tray",
    onde: "Configurações → Scripts → novo script, com posição no fim do corpo da página.",
  },
  {
    nome: "VTEX",
    onde: "CMS → Configurações da loja → Código do rodapé (footer).",
  },
  {
    nome: "Loja Integrada",
    onde: "Configurações → Scripts → adicionar script no rodapé.",
  },
  {
    nome: "Wix",
    onde: "Configurações → Código personalizado → adicionar código no fim do corpo (body end).",
  },
];

export default function EmbedCodeBox({
  embedKey,
  projectId,
  gtmDisponivel,
  sinais = 0,
}: {
  embedKey: string;
  projectId: string;
  /** Sem as credenciais do Google configuradas, o atalho nem aparece. */
  gtmDisponivel: boolean;
  /** Exibições já registradas. Zero significa que o código ainda não rodou. */
  sinais?: number;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [origem, setOrigem] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

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

  // "Verificar" aqui é recarregar a página e reler o contador de
  // exibições. Não existe outra prova: o sinal só chega quando alguém de
  // verdade abre o site com o código instalado.
  function verificar() {
    setConferindo(true);
    router.refresh();
    setTimeout(() => setConferindo(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Instalação
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Uma linha no seu site, ou dois cliques pelo Google Tag Manager.
            Depois disso o vídeo entra sozinho nas páginas que você escolheu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              sinais > 0
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                sinais > 0 ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {sinais > 0
              ? "Instalado e recebendo dados"
              : "Aguardando o primeiro sinal"}
          </span>
          <button
            type="button"
            onClick={verificar}
            disabled={conferindo}
            className="rounded-lg border border-outline-soft bg-surface-card px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
          >
            {conferindo ? "Conferindo..." : "Verificar instalação"}
          </button>
        </div>
      </div>

      <section className="cartao p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-brand-ink">
              Código de instalação
              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-brand-blue">
                funciona em qualquer site
              </span>
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Cole antes do fechamento da tag <code>&lt;/body&gt;</code>.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-brand-ink">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
            <span className="flex items-center gap-2">
              <span className="flex gap-1.5">
                {["bg-red-400", "bg-amber-400", "bg-emerald-400"].map((c) => (
                  <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
                ))}
              </span>
              <span className="ml-2 font-mono text-xs text-white/60">
                floatvideo.html
              </span>
            </span>
            <button
              onClick={handleCopy}
              className="btn-brand rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              {copied ? "Copiado!" : "Copiar código"}
            </button>
          </div>
          <pre className="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-neutral-100">
            <code>{code}</code>
          </pre>
          {/* Números medidos, não estimados: o peso é o do arquivo gerado
              na build, e o carregamento é assíncrono por construção. */}
          <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/60">
            <span>34 KB, com o CSS embutido</span>
            <span>Carregamento assíncrono: não segura a página</span>
            <span>Roda só no domínio deste site</span>
          </p>
        </div>

        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            [
              "Copie o código acima",
              "Ele já vem com a chave deste site. Não precisa editar nada.",
            ],
            [
              "Cole no seu site",
              "Nas configurações de scripts da sua plataforma, ou no rodapé do tema.",
            ],
            [
              "Abra o site e confira",
              "Numa janela anônima, espere o tempo configurado e o balão aparece.",
            ],
          ].map(([titulo, texto], i) => (
            <li key={titulo} className="rounded-xl bg-surface-soft p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-semibold text-white">
                {i + 1}
              </span>
              <p className="mt-3 text-sm font-medium text-brand-ink">
                {titulo}
              </p>
              <p className="mt-1 text-xs text-ink-muted">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* O atalho do GTM vem depois do código, mas com destaque próprio:
          quem tem GTM instala sem tocar em código nenhum. */}
      {gtmDisponivel && <GtmConnect projectId={projectId} />}

      <section className="cartao p-5">
        <h2 className="text-base font-semibold text-brand-ink">
          Onde colar em cada plataforma
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          O caminho muda de nome, mas o lugar é sempre o mesmo: o fim do
          corpo da página.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PLATAFORMAS.map((p) => (
            <button
              key={p.nome}
              type="button"
              onClick={() => setAberta(aberta === p.nome ? null : p.nome)}
              aria-expanded={aberta === p.nome}
              className={`rounded-xl border p-3 text-left transition ${
                aberta === p.nome
                  ? "border-brand-blue bg-surface-soft"
                  : "border-outline-soft hover:border-outline"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-brand-ink">
                  {p.nome}
                </span>
                <span aria-hidden className="text-ink-faint">
                  {aberta === p.nome ? "−" : "+"}
                </span>
              </span>
              {aberta === p.nome && (
                <span className="mt-2 block text-xs text-ink-muted">
                  {p.onde}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="cartao p-5">
        <h2 className="text-base font-semibold text-brand-ink">
          Se o vídeo não aparecer
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          <li>
            <strong className="text-brand-ink">
              Confira o domínio deste site.
            </strong>{" "}
            O widget só roda no endereço cadastrado. Em qualquer outro ele
            simplesmente não carrega — de propósito, para ninguém copiar seu
            código e usar em outro lugar.
          </li>
          <li>
            <strong className="text-brand-ink">
              Cada vídeo precisa de uma regra de página.
            </strong>{" "}
            Sem dizer onde ele aparece, o vídeo não entra em lugar nenhum.
          </li>
          <li>
            <strong className="text-brand-ink">
              Você pode ter fechado o balão num teste.
            </strong>{" "}
            Ele some naquele navegador pelo tempo escolhido em Widget. Para
            trazê-lo de volta na hora, abra a página com{" "}
            <code className="rounded bg-surface-muted px-1">?fvw_reset</code>{" "}
            no fim da URL.
          </li>
        </ul>

        <p className="mt-4 border-t border-outline-soft pt-4 text-sm text-ink-muted">
          Para medir conversões no Google Analytics e no Google Ads, não
          precisa mexer no site — o código acima já manda os eventos. O passo
          a passo está em{" "}
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
      </section>
    </div>
  );
}
