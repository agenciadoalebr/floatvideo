import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import GoogleTagManager from "@/components/GoogleTagManager";

export const metadata: Metadata = {
  title: "FloatVideo — vídeo flutuante que vende no seu site",
  description:
    "Coloque um vídeo flutuante no seu site ou loja virtual, com botão de WhatsApp, formulário ou compra. Instalação em uma linha de código.",
};

const WHATSAPP =
  "https://wa.me/5511967136667?text=" +
  encodeURIComponent("Olá! Quero saber mais sobre o FloatVideo.");

const PLATAFORMAS = [
  "VTEX",
  "Nuvemshop",
  "Shopify",
  "WooCommerce",
  "Tray",
  "Loja Integrada",
  "Wix",
  "WordPress",
];

const RECURSOS = [
  {
    titulo: "Vídeo certo em cada página",
    texto:
      "Regras por endereço decidem qual vídeo aparece onde. O vídeo da página de preços fala de preço; o do produto, do produto.",
  },
  {
    titulo: "Botão de ação que converte",
    texto:
      "WhatsApp direto, formulário com captura de lead, link livre — ou o botão Comprar, que leva a pessoa até o botão de compra da sua própria loja.",
  },
  {
    titulo: "Leads no painel e no seu e-mail",
    texto:
      "Quem preenche o formulário vira um lead com nome, telefone e a página de onde veio. Chega por e-mail ou webhook, na hora.",
  },
  {
    titulo: "Retenção de verdade",
    texto:
      "Não só quantos assistiram: em que ponto pararam. Marcos de 3 segundos, 25%, metade e 75% mostram onde o vídeo perde a pessoa.",
  },
  {
    titulo: "Google Analytics e Google Ads",
    texto:
      "Os eventos chegam prontos no seu GA4 e viram conversão no Ads, sem escrever código. Um acionador no Tag Manager dá conta de todos.",
  },
  {
    titulo: "Aparece na hora certa",
    texto:
      "Depois de alguns segundos, quando a pessoa rola a página, ou na hora em que ela vai embora — a última chance antes de fechar a aba.",
  },
];

const PERGUNTAS = [
  {
    q: "Funciona na minha loja?",
    a: "Funciona em qualquer site. É uma linha de código antes do fechamento do </body>, e dá para colar pelo Google Tag Manager se você preferir não mexer no tema.",
  },
  {
    q: "Deixa meu site mais lento?",
    a: "O widget comprimido tem 10 KB e carrega depois da sua página, nunca antes. O vídeo só é baixado quando o balão vai aparecer — e, enquanto ele está recolhido, roda uma prévia leve em vez do arquivo inteiro.",
  },
  {
    q: "Posso usar vídeo do YouTube?",
    a: "Pode. Cole o link e pronto. Ou envie o arquivo, se preferir que o vídeo não tenha marca de player nenhum.",
  },
  {
    q: "E se eu já tiver um botão de WhatsApp no site?",
    a: "Convivem bem: o widget aparece no canto que você escolher, com a distância que você definir. E o botão de ação dele pode ser o mesmo WhatsApp.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: planos } = await supabase
    .from("plans")
    .select("id, nome, preco_centavos, max_projects, descricao, trial_dias")
    .eq("publico", true)
    .order("ordem");

  return (
    <div className="min-h-screen bg-white">
      <GoogleTagManager />
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-floatvideo.webp" alt="FloatVideo" className="h-8 w-auto" />
          <div className="flex items-center gap-4 text-sm">
            <a href="#precos" className="hidden text-neutral-600 hover:text-brand-blue sm:block">
              Preços
            </a>
            <Link href="/login" className="text-neutral-600 hover:text-brand-blue">
              Entrar
            </Link>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brand rounded-lg px-4 py-2 text-sm font-medium"
            >
              Falar com a gente
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------- topo ---------------- */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-brand-blue">
                Vídeo flutuante para sites e lojas virtuais
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-brand-ink sm:text-5xl">
                Quem vê seu rosto
                <br />
                compra mais rápido.
              </h1>
              <p className="mt-5 text-lg text-neutral-600">
                Um vídeo curto flutuando no canto da página, que abre em tela
                cheia num clique e termina com o botão que você quiser —
                WhatsApp, formulário ou compra.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-brand rounded-lg px-6 py-3 text-sm font-medium"
                >
                  Quero no meu site
                </a>
                <Link
                  href="/assinar"
                  className="rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700 hover:border-brand-blue hover:text-brand-blue"
                >
                  Assinar agora
                </Link>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Instalação em uma linha de código. Funciona com o vídeo que
                você já tem.
              </p>
            </div>

            {/* Ilustração do balão. Vale mais que uma imagem estática: é o
                próprio formato do produto, no tamanho e no canto em que ele
                aparece de verdade. */}
            <div className="relative mx-auto hidden h-[420px] w-full max-w-md rounded-2xl border border-neutral-200 bg-neutral-50 lg:block">
              <div className="space-y-3 p-6">
                <div className="h-3 w-24 rounded bg-neutral-200" />
                <div className="h-3 w-full rounded bg-neutral-200" />
                <div className="h-3 w-5/6 rounded bg-neutral-200" />
                <div className="mt-6 h-32 w-full rounded-lg bg-neutral-200" />
                <div className="h-3 w-2/3 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-200" />
              </div>
              <div className="absolute bottom-5 right-5">
                <div className="h-36 w-[81px] rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet shadow-xl" />
                <div className="mt-2 flex w-[190px] items-center gap-2 rounded-2xl bg-white/85 p-2 shadow-lg backdrop-blur">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25d366]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34M12.05 21.8h-.01c-1.77 0-3.51-.48-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.9-9.88 9.9" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold leading-tight text-neutral-900">
                      Quer saber mais?
                    </span>
                    <span className="block text-[13px] leading-tight text-neutral-900">
                      Chame pelo WhatsApp
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- como funciona ---------------- */}
        <section className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-2xl font-semibold text-brand-ink">
              Três passos, e está no ar
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {[
                {
                  n: "1",
                  t: "Suba o vídeo",
                  d: "Envie o arquivo ou cole um link do YouTube. Miniatura e prévia leve são geradas sozinhas.",
                },
                {
                  n: "2",
                  t: "Escolha o botão",
                  d: "WhatsApp, formulário, link ou Comprar. Cor, texto e formato do balão são seus.",
                },
                {
                  n: "3",
                  t: "Cole uma linha no site",
                  d: "No rodapé do tema ou pelo Google Tag Manager. Pronto: já aparece e já mede.",
                },
              ].map((p) => (
                <div key={p.n} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink text-sm font-semibold text-white">
                    {p.n}
                  </span>
                  <h3 className="mt-3 font-medium text-brand-ink">{p.t}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{p.d}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-neutral-500">
              Compatível com{" "}
              <span className="text-neutral-700">{PLATAFORMAS.join(" · ")}</span>{" "}
              — e com qualquer site onde você consiga colar um script.
            </p>
          </div>
        </section>

        {/* ---------------- recursos ---------------- */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold text-brand-ink">
            O que vem junto
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div key={r.titulo}>
                <h3 className="font-medium text-brand-ink">{r.titulo}</h3>
                <p className="mt-1 text-sm text-neutral-600">{r.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- preços ---------------- */}
        <section id="precos" className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-2xl font-semibold text-brand-ink">Preços</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Sem limite de vídeos e sem limite de visualizações, em qualquer
              plano.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {(planos ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col rounded-xl border border-neutral-200 bg-white p-6"
                >
                  <h3 className="text-lg font-semibold text-brand-ink">
                    {p.nome}
                  </h3>
                  <p className="mt-2">
                    <span className="text-3xl font-semibold text-brand-ink">
                      R$ {(p.preco_centavos / 100).toFixed(0)}
                    </span>
                    <span className="text-sm text-neutral-500">/mês</span>
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">{p.descricao}</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-neutral-600">
                    <li>
                      {p.max_projects === 1
                        ? "1 site"
                        : `Até ${p.max_projects} sites`}
                    </li>
                    <li>Vídeos ilimitados</li>
                    <li>Visualizações ilimitadas</li>
                    <li>Botão de ação e captura de leads</li>
                    <li>Métricas, retenção e integração com o GA4</li>
                    <li>Suporte no WhatsApp</li>
                  </ul>
                  {/* Leva o plano escolhido junto: quem clicou no card
                      do Agência não deve cair numa tela pedindo para
                      escolher de novo. */}
                  <Link
                    href={`/assinar?plano=${p.id}`}
                    className="btn-brand mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium"
                  >
                    {p.trial_dias > 0
                      ? `Começar com ${p.trial_dias} dias grátis`
                      : "Assinar"}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- dúvidas ---------------- */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-semibold text-brand-ink">
            Perguntas frequentes
          </h2>
          <div className="mt-6 divide-y divide-neutral-200">
            {PERGUNTAS.map((p) => (
              <details key={p.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-brand-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  {p.q}
                  <span className="text-neutral-400 transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <p className="mt-2 text-sm text-neutral-600">{p.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- chamada final ---------------- */}
        <section className="border-t border-neutral-200 bg-brand-ink">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Coloque seu vídeo pra trabalhar
            </h2>
            <p className="mt-3 text-neutral-300">
              A gente instala junto com você e configura o primeiro vídeo.
            </p>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-lg bg-white px-6 py-3 text-sm font-medium text-brand-ink hover:bg-neutral-100"
            >
              Falar no WhatsApp
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-neutral-500 sm:flex-row">
        <span>© {new Date().getFullYear()} FloatVideo — Agência do Alê</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/privacidade" className="hover:text-brand-blue">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:text-brand-blue">
            Termos de uso
          </Link>
          <Link href="/login" className="hover:text-brand-blue">
            Entrar no painel
          </Link>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-blue"
          >
            Contato
          </a>
        </div>
      </footer>
    </div>
  );
}
