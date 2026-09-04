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

const PASSOS = [
  {
    n: "01",
    t: "Envie seu vídeo",
    d: "Um arquivo do celular ou um link do YouTube. Miniatura e prévia leve saem sozinhas, sem você editar nada.",
    nota: "MP4, MOV ou WebM",
  },
  {
    n: "02",
    t: "Escolha onde ele aparece",
    d: "Regras por endereço decidem qual vídeo entra em qual página. O da página de preços fala de preço; o do produto, do produto.",
    nota: "Muda quando quiser",
  },
  {
    n: "03",
    t: "Cole uma linha no site",
    d: "No rodapé do tema ou pelo Google Tag Manager, em dois cliques. A partir daí já aparece e já mede.",
    nota: "Sem programador",
  },
];

const RECURSOS = [
  {
    titulo: "Botão de WhatsApp",
    texto:
      "Abre a conversa com a mensagem já escrita, do vídeo direto para o seu celular.",
  },
  {
    titulo: "Formulário de captura",
    texto:
      "Nome, telefone e e-mail viram um lead no painel, com a página de onde a pessoa veio. Chega no seu e-mail na hora.",
  },
  {
    titulo: "Botão de comprar para lojas",
    texto:
      "Fecha o vídeo e leva a pessoa até o botão de compra da sua própria loja, com destaque nele. VTEX, Nuvemshop, Shopify, Tray e WooCommerce.",
  },
  {
    titulo: "Retenção de verdade",
    texto:
      "Não só quantos assistiram: em que ponto pararam. Marcos de 3 segundos, 25%, metade e 75% mostram onde o vídeo perde a pessoa.",
  },
  {
    titulo: "Google Analytics e Tag Manager",
    texto:
      "Os eventos chegam prontos no seu GA4 e viram conversão no Google Ads — inclusive as conversões otimizadas, sem escrever código.",
  },
  {
    titulo: "Formato vertical 9:16",
    texto:
      "O mesmo vídeo que você já grava para Reels e TikTok, aproveitado inteiro, sem cortar as laterais.",
  },
];

const PERGUNTAS = [
  {
    q: "Preciso saber programar?",
    a: "Não. É uma linha de código copiada com um clique e colada nas configurações de scripts da sua plataforma — ou instalada pelo Google Tag Manager, sem tocar em código nenhum. Se travar, a gente instala junto com você pelo WhatsApp.",
  },
  {
    q: "Funciona na minha plataforma de loja?",
    a: "Funciona em qualquer site onde você consiga colar um script: " +
      PLATAFORMAS.join(", ") +
      " e outros. O botão de comprar reconhece automaticamente o botão de compra das principais plataformas brasileiras.",
  },
  {
    q: "Deixa meu site lento?",
    a: "O widget tem 34 KB e carrega depois da sua página, nunca antes. O vídeo só é baixado quando o balão vai aparecer — e, enquanto ele está recolhido, roda uma prévia leve em vez do arquivo inteiro.",
  },
  {
    q: "Posso usar vídeo do YouTube?",
    a: "Pode. Cole o link e pronto. Ou envie o arquivo, se preferir que o vídeo não tenha marca de player nenhum.",
  },
  {
    q: "E se eu já tiver um botão de WhatsApp no site?",
    a: "Convivem bem: o balão aparece no canto que você escolher, com a distância que você definir. E o botão de ação dele pode ser o mesmo WhatsApp.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode, pelo próprio painel, sem multa e sem fidelidade. O acesso continua até o fim do período já pago, e seus vídeos, métricas e leads não são apagados.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: planos } = await supabase
    .from("plans")
    .select("id, nome, preco_centavos, max_projects, descricao, trial_dias")
    .eq("publico", true)
    .order("ordem");

  const lista = planos ?? [];

  return (
    <div className="min-h-screen bg-surface-card">
      <GoogleTagManager />

      <header className="sticky top-0 z-40 border-b border-outline-soft bg-surface-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-floatvideo.webp"
            alt="FloatVideo"
            className="h-8 w-auto"
          />
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#como" className="text-ink-muted hover:text-brand-blue">
              Como funciona
            </a>
            <a href="#recursos" className="text-ink-muted hover:text-brand-blue">
              Recursos
            </a>
            <a href="#precos" className="text-ink-muted hover:text-brand-blue">
              Preços
            </a>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-ink-muted hover:text-brand-blue">
              Entrar
            </Link>
            <Link
              href="/assinar"
              className="btn-brand rounded-lg px-4 py-2 text-sm font-medium"
            >
              Assinar agora
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------- topo ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-brand-blue">
                Vídeo que fala com quem está na página
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-brand-ink sm:text-5xl">
                Quem vê seu rosto
                <br />
                compra mais rápido.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-ink-muted">
                Um vídeo curto flutuando no canto da página, que abre em tela
                cheia num clique e termina com o botão que você quiser —
                WhatsApp, formulário ou compra.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/assinar"
                  className="btn-brand rounded-lg px-6 py-3 text-sm font-medium"
                >
                  Começar com 7 dias grátis
                </Link>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-outline-soft px-6 py-3 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                >
                  Falar no WhatsApp
                </a>
              </div>

              <p className="mt-4 text-xs text-ink-faint">
                Sem cartão para começar. Cancele pelo painel, sem multa.
              </p>

              {/* Números medidos, não adjetivos: qualquer um deles pode ser
                  conferido por quem desconfiar. */}
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-outline-soft pt-6 text-xs">
                {[
                  ["34 KB", "peso do widget"],
                  ["1 linha", "para instalar"],
                  ["Ilimitadas", "visualizações"],
                ].map(([valor, rotulo]) => (
                  <div key={rotulo}>
                    <dt className="font-semibold text-brand-ink">{valor}</dt>
                    <dd className="text-ink-faint">{rotulo}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Ilustração do balão. Vale mais que uma imagem estática: é o
                próprio formato do produto, no tamanho e no canto em que ele
                aparece de verdade. */}
            <div className="relative mx-auto hidden h-[440px] w-full max-w-md rounded-2xl border border-outline-soft bg-surface p-1 shadow-[0_12px_40px_-12px_rgba(0,9,45,0.15)] lg:block">
              <div className="flex items-center gap-2 rounded-t-xl px-3 py-2.5">
                <span className="flex gap-1.5">
                  {["bg-red-300", "bg-amber-300", "bg-emerald-300"].map((c) => (
                    <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
                  ))}
                </span>
                <span className="mx-auto rounded-md bg-surface-card px-3 py-1 text-[11px] text-ink-faint">
                  sualoja.com.br
                </span>
              </div>
              <div className="relative h-[calc(100%-40px)] rounded-xl bg-surface-card p-6">
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded bg-surface-muted" />
                  <div className="h-3 w-full rounded bg-surface-muted" />
                  <div className="h-3 w-5/6 rounded bg-surface-muted" />
                  <div className="mt-6 h-40 w-full rounded-xl bg-surface-muted" />
                  <div className="h-3 w-2/3 rounded bg-surface-muted" />
                  <div className="h-3 w-1/2 rounded bg-surface-muted" />
                </div>

                <div className="absolute bottom-5 right-5">
                  <div className="ml-auto h-36 w-[81px] rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet shadow-[0_8px_24px_-4px_rgba(0,127,255,0.4)]" />
                  <div className="mt-2 flex w-[210px] items-center gap-2 rounded-2xl bg-white/85 p-2 shadow-lg backdrop-blur">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25d366]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34M12.05 21.8h-.01c-1.77 0-3.51-.48-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.9-9.88 9.9" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold leading-tight text-neutral-900">
                        Quer saber mais?
                      </span>
                      <span className="block text-[12px] leading-tight text-neutral-600">
                        Chame pelo WhatsApp
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- como funciona ---------------- */}
        <section id="como" className="border-y border-outline-soft bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="rotulo-metrica">Passo a passo</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-ink">
              Do vídeo no ar em três passos
            </h2>
            <p className="mt-2 max-w-2xl text-ink-muted">
              Sem desenvolvedor, sem mexer no tema do site e sem depender de
              ninguém para trocar o vídeo depois.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PASSOS.map((p) => (
                <div key={p.n} className="cartao p-6">
                  <div className="flex items-start justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-semibold text-white">
                      {p.n.slice(1)}
                    </span>
                    <span className="text-2xl font-semibold text-surface-strong">
                      {p.n}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-brand-ink">{p.t}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{p.d}</p>
                  <p className="mt-4 text-xs font-medium text-brand-blue">
                    {p.nota}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-ink-faint">
              Compatível com{" "}
              <span className="text-ink-muted">{PLATAFORMAS.join(" · ")}</span>{" "}
              — e com qualquer site onde você consiga colar um script.
            </p>
          </div>
        </section>

        {/* ---------------- recursos ---------------- */}
        <section id="recursos" className="mx-auto max-w-6xl px-4 py-16">
          <p className="rotulo-metrica">O que vem junto</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-brand-ink">
            Tudo o que o vídeo precisa para virar venda
          </h2>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Feito para o mercado brasileiro, sem termos técnicos e sem
            configuração demorada.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="cartao p-6">
                <h3 className="font-semibold text-brand-ink">{r.titulo}</h3>
                <p className="mt-2 text-sm text-ink-muted">{r.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- preços ---------------- */}
        <section id="precos" className="border-y border-outline-soft bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="text-center">
              <p className="inline-flex rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-brand-blue">
                Sem limite de vídeos e sem limite de visualizações
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-brand-ink">
                Preços simples e transparentes
              </h2>
              <p className="mt-2 text-ink-muted">
                Escolha o plano ideal para a sua operação. Sem contrato de
                fidelidade e sem surpresa na fatura.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {lista.map((p, i) => {
                const destaque = i === lista.length - 1 && lista.length > 1;
                return (
                  <div
                    key={p.id}
                    className={`relative flex flex-col rounded-2xl p-7 ${
                      destaque
                        ? "border-2 border-brand-blue bg-surface-card shadow-[0_12px_40px_-12px_rgba(0,127,255,0.25)]"
                        : "cartao"
                    }`}
                  >
                    {destaque && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet px-3 py-1 text-[11px] font-semibold text-white">
                        Mais completo
                      </span>
                    )}

                    <h3 className="text-lg font-semibold text-brand-ink">
                      {p.nome}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {p.descricao}
                    </p>

                    <p className="mt-5">
                      <span className="text-sm text-ink-faint">R$ </span>
                      <span className="text-5xl font-semibold tracking-tight text-brand-ink">
                        {(p.preco_centavos / 100).toFixed(0)}
                      </span>
                      <span className="text-sm text-ink-faint">/mês</span>
                    </p>

                    <ul className="mt-6 space-y-2.5 text-sm text-ink-muted">
                      {[
                        p.max_projects === 1
                          ? "1 site"
                          : `Até ${p.max_projects} sites`,
                        "Vídeos ilimitados",
                        "Visualizações ilimitadas",
                        "Botão de ação e captura de leads",
                        "Métricas de retenção",
                        "Google Analytics e Tag Manager",
                        "Suporte no WhatsApp",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-0.5 text-brand-blue">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={`/assinar?plano=${p.id}`}
                      className={`mt-7 rounded-lg px-4 py-3 text-center text-sm font-medium ${
                        destaque
                          ? "btn-brand"
                          : "border border-outline-soft text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                      }`}
                    >
                      {p.trial_dias > 0
                        ? `Começar com ${p.trial_dias} dias grátis`
                        : `Assinar o ${p.nome}`}
                    </Link>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-center text-xs text-ink-faint">
              Pague por Pix, boleto ou cartão. Cancele pelo painel a qualquer
              momento, sem multa.
            </p>
          </div>
        </section>

        {/* ---------------- dúvidas ---------------- */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-brand-ink">
            Perguntas frequentes
          </h2>
          <div className="mt-8 space-y-3">
            {PERGUNTAS.map((p) => (
              <details key={p.q} className="cartao group p-5">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium text-brand-ink">
                  {p.q}
                  <span
                    aria-hidden
                    className="text-ink-faint transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ink-muted">{p.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- chamada final ---------------- */}
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-5xl rounded-3xl bg-gradient-to-br from-brand-blue to-brand-violet px-6 py-14 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Pronto para colocar seu rosto no seu site?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              Instale em minutos e teste sete dias de graça. Se travar em
              algum passo, a gente configura o primeiro vídeo junto com você.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/assinar"
                className="rounded-lg bg-white px-6 py-3 text-sm font-medium text-brand-ink hover:bg-neutral-100"
              >
                Começar meus 7 dias grátis
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-soft bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-floatvideo.webp"
              alt="FloatVideo"
              className="h-7 w-auto"
            />
            <p className="mt-3 max-w-xs text-xs text-ink-faint">
              Vídeo flutuante para sites e lojas virtuais. Feito no Brasil,
              pela Agência do Alê.
            </p>
          </div>

          {[
            {
              titulo: "Navegação",
              itens: [
                ["Como funciona", "#como"],
                ["Recursos", "#recursos"],
                ["Preços", "#precos"],
              ],
            },
            {
              titulo: "Conta",
              itens: [
                ["Entrar no painel", "/login"],
                ["Criar conta", "/assinar"],
              ],
            },
            {
              titulo: "Legal",
              itens: [
                ["Termos de uso", "/termos"],
                ["Política de privacidade", "/privacidade"],
              ],
            },
          ].map((coluna) => (
            <div key={coluna.titulo}>
              <p className="rotulo-metrica">{coluna.titulo}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {coluna.itens.map(([nome, href]) => (
                  <li key={nome}>
                    <Link
                      href={href}
                      className="text-ink-muted hover:text-brand-blue"
                    >
                      {nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-outline-soft">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-faint sm:flex-row">
            <span>© {new Date().getFullYear()} FloatVideo — Agência do Alê</span>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-blue"
            >
              Falar com a gente no WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
