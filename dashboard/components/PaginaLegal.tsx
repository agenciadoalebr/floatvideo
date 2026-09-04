import Link from "next/link";
import type { ReactNode } from "react";
import GoogleTagManager from "@/components/GoogleTagManager";

/**
 * Moldura das páginas legais. Existe para as duas dividirem cabeçalho,
 * largura de leitura e rodapé — e para o texto ficar num arquivo só de
 * conteúdo, sem repetir estrutura.
 */
export default function PaginaLegal({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-card">
      <GoogleTagManager />
      <header className="border-b border-outline-soft">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-floatvideo.webp"
              alt="FloatVideo"
              className="h-8 w-auto"
            />
          </Link>
          <Link href="/" className="text-sm text-ink-muted hover:text-brand-blue">
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-brand-ink">{titulo}</h1>
        <p className="mt-2 text-sm text-ink-faint">
          Última atualização: {atualizadoEm}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink [&_a]:text-brand-blue [&_a:hover]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-brand-ink [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1">
          {children}
        </div>
      </main>

      <footer className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-8 text-xs text-ink-faint sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} FloatVideo — Agência do Alê</span>
        <div className="flex gap-4">
          <Link href="/privacidade" className="hover:text-brand-blue">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:text-brand-blue">
            Termos de uso
          </Link>
          <a
            href="mailto:contato@floatvideo.com.br"
            className="hover:text-brand-blue"
          >
            contato@floatvideo.com.br
          </a>
        </div>
      </footer>
    </div>
  );
}
