import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SCRIPT_DO_TEMA } from "@/components/BotaoDeTema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FloatVideo — Painel",
  description: "Vídeos flutuantes. Mais engajamento. Mais resultados.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // O script do tema escreve data-tema no <html> antes de o React
      // hidratar, então o atributo do servidor e o do cliente divergem de
      // propósito. Sem isto, o React acusa a diferença como erro.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Antes de qualquer pintura: ler a preferência depois que o
            React monta faria a tela nascer clara e escurecer na cara de
            quem escolheu o escuro. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
