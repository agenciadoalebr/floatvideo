"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Widget, WidgetCta, CtaType, BuyPlatform } from "@/lib/types";
import { PLATAFORMAS } from "@/lib/ecommerce";
import CtaPreview from "@/components/CtaPreview";
import { formatarTelefone, telefoneParaWhatsApp } from "@/lib/domain";

type Props = {
  widget: Widget | null;
  cta: WidgetCta | null;
};

/** Tipos que levam a algum lugar e portanto precisam de destino. */
const PRECISA_DESTINO: CtaType[] = ["whatsapp", "whatsapp_form", "link"];

/** Texto sugerido para cada tipo de botao. */
const ROTULO_PADRAO: Partial<Record<CtaType, string>> = {
  whatsapp: "Quer saber mais?",
  whatsapp_form: "Quer saber mais?",
  form: "Fale com a gente",
  buy: "Comprar agora",
  link: "Veja mais",
};

/** Segunda linha sugerida, usada só no estilo cartão. */
const SUBROTULO_PADRAO: Partial<Record<CtaType, string>> = {
  whatsapp: "Chame pelo WhatsApp",
  whatsapp_form: "Chame pelo WhatsApp",
  form: "Deixe seu contato",
  buy: "Ver o produto",
  link: "Abrir a página",
};

const AJUDA: Record<CtaType, string> = {
  whatsapp: "Um botão que abre a conversa no WhatsApp direto.",
  whatsapp_form:
    "Pede nome e telefone e só então manda pro WhatsApp — o contato fica registrado mesmo se a pessoa desistir no meio.",
  form: "Formulário completo. O lead fica no painel; não abre o WhatsApp.",
  buy:
    "Fecha o vídeo e leva a pessoa até o botão de compra da própria página, com um destaque piscando nele.",
  none: "O vídeo aparece sem nenhum botão.",
  link:
    "Abre o endereço que você escolher numa aba nova — página de produto, catálogo, agendamento, o que for.",
};

/**
 * Botão de ação do site inteiro. Fica numa aba própria, e não junto da
 * edição do vídeo, porque a configuração é uma só para todos os vídeos —
 * dentro do painel do widget parecia que cada vídeo tinha o seu.
 */
export default function CtaPanel({ widget, cta }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<CtaType>(cta?.type ?? "whatsapp");
  const [rotulo, setRotulo] = useState(cta?.label ?? "Quer saber mais?");
  const [subRotulo, setSubRotulo] = useState(
    cta?.sublabel ?? "Chame pelo WhatsApp"
  );
  const [estilo, setEstilo] = useState<"card" | "solid">(
    cta?.button_style ?? "card"
  );
  const [destino, setDestino] = useState(() => {
    const salvo = cta?.target_url ?? "";
    return salvo.includes("wa.me/") ? formatarTelefone(salvo) : salvo;
  });
  const [plataforma, setPlataforma] = useState<BuyPlatform>(
    cta?.buy_platform ?? "auto"
  );
  const [seletor, setSeletor] = useState(cta?.buy_selector ?? "");
  const [cor, setCor] = useState(widget?.cta_color ?? "#25d366");
  const [email, setEmail] = useState(widget?.notify_email ?? "");
  const [webhook, setWebhook] = useState(widget?.notify_webhook_url ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  const ehWhatsApp = tipo === "whatsapp" || tipo === "whatsapp_form";
  const ehComprar = tipo === "buy";
  // E-mail e webhook so aparecem em quem gera lead no painel.
  const recebeLead = tipo === "form" || tipo === "whatsapp_form";
  const ehFormulario = tipo === "form" || tipo === "whatsapp_form";

  // Trocar de tipo troca tambem o texto do botao, desde que ele ainda
  // seja um dos nossos padroes: "Fale no WhatsApp" num botao Comprar era
  // o erro mais facil de cometer aqui.
  function trocarTipo(novo: CtaType) {
    setTipo(novo);
    const padrao = ROTULO_PADRAO[novo];
    const eraPadrao =
      !rotulo.trim() || Object.values(ROTULO_PADRAO).includes(rotulo.trim());
    if (padrao && eraPadrao) setRotulo(padrao);

    const subPadrao = SUBROTULO_PADRAO[novo];
    const subEraPadrao =
      !subRotulo.trim() ||
      Object.values(SUBROTULO_PADRAO).includes(subRotulo.trim());
    if (subPadrao && subEraPadrao) setSubRotulo(subPadrao);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);

    if (!widget) return;

    if (PRECISA_DESTINO.includes(tipo) && !destino.trim()) {
      setErro(ehWhatsApp ? "Informe o número do WhatsApp." : "Informe o destino.");
      return;
    }

    if (ehComprar && plataforma === "custom" && !seletor.trim()) {
      setErro("Informe o seletor CSS do botão de compra.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();

    const { error: erroWidget } = await supabase
      .from("widgets")
      .update({
        cta_color: cor,
        notify_email: email.trim() || null,
        notify_webhook_url: webhook.trim() || null,
      })
      .eq("id", widget.id);

    if (erroWidget) {
      setErro(erroWidget.message);
      setSalvando(false);
      return;
    }

    // "Sem botão" apaga o CTA: senão o widget seguiria exibindo o antigo.
    if (tipo === "none") {
      if (cta) await supabase.from("widget_ctas").delete().eq("id", cta.id);
    } else {
      const payload = {
        widget_id: widget.id,
        type: tipo,
        label: rotulo,
        sublabel: estilo === "card" && subRotulo.trim() ? subRotulo.trim() : null,
        button_style: estilo,
        // No Comprar o destino é opcional: só entra em cena quando o
        // botão de compra não é encontrado na página.
        target_url: ehComprar
          ? destino.trim() || null
          : PRECISA_DESTINO.includes(tipo)
            ? ehWhatsApp
              ? "https://wa.me/" + telefoneParaWhatsApp(destino)
              : destino
            : null,
        buy_platform: ehComprar ? plataforma : null,
        buy_selector: ehComprar && seletor.trim() ? seletor.trim() : null,
      };
      const { error: erroCta } = cta
        ? await supabase.from("widget_ctas").update(payload).eq("id", cta.id)
        : await supabase.from("widget_ctas").insert(payload);
      if (erroCta) {
        setErro(erroCta.message);
        setSalvando(false);
        return;
      }
    }

    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 4000);
    router.refresh();
  }

  if (!widget) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        Configure o widget primeiro — o botão de ação aparece dentro dele.
      </p>
    );
  }

  const TIPOS: { valor: CtaType; nome: string; nota: string }[] = [
    {
      valor: "whatsapp",
      nome: "WhatsApp direto",
      nota: "Abre a conversa com a mensagem já escrita",
    },
    {
      valor: "whatsapp_form",
      nome: "WhatsApp + contato",
      nota: "Pede nome e telefone antes de abrir o chat",
    },
    {
      valor: "form",
      nome: "Formulário de contato",
      nota: "O lead fica no painel e vai para o seu e-mail",
    },
    {
      valor: "buy",
      nome: "Comprar (e-commerce)",
      nota: "Leva a pessoa até o botão de compra da página",
    },
    {
      valor: "link",
      nome: "Link personalizado",
      nota: "Abre qualquer endereço numa aba nova",
    },
    {
      valor: "none",
      nome: "Sem botão",
      nota: "O vídeo aparece sozinho, sem nada por cima",
    },
  ];

  const CORES = [
    ["#25d366", "Verde WhatsApp"],
    ["#007fff", "Azul da marca"],
    ["#3f1afb", "Violeta da marca"],
    ["#f97316", "Laranja"],
    ["#00092d", "Escuro"],
  ] as const;

  return (
    <form onSubmit={salvar} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Botão de ação
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            O que acontece quando o visitante clica. Vale para todos os
            vídeos deste site.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {salvo && !erro && (
            <span role="status" className="text-xs font-medium text-emerald-700">
              Salvo — já vale no site
            </span>
          )}
          <button
            type="submit"
            disabled={salvando}
            className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="space-y-5">
          <Etapa
            numero={1}
            titulo="Tipo de ação"
            descricao="O que acontece quando o visitante clica no botão"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => trocarTipo(t.valor)}
                  className={`relative rounded-xl border p-4 text-left transition ${
                    tipo === t.valor
                      ? "border-brand-blue bg-surface-soft"
                      : "border-outline-soft hover:border-outline"
                  }`}
                >
                  {tipo === t.valor && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-[11px] text-white">
                      ✓
                    </span>
                  )}
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-strong">
                    <IconeDoTipo tipo={t.valor} />
                  </span>
                  <span className="mt-3 block text-sm font-medium text-brand-ink">
                    {t.nome}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {t.nota}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">{AJUDA[tipo]}</p>
          </Etapa>

          {tipo !== "none" && (
            <>
              <Etapa
                numero={2}
                titulo="Destino"
                descricao="Para onde a pessoa vai, e o que chega até você"
              >
                {PRECISA_DESTINO.includes(tipo) && (
                  <label className="block">
                    <span className="text-xs font-medium text-ink-muted">
                      {ehWhatsApp
                        ? "Número do WhatsApp com DDD"
                        : "Endereço de destino"}
                    </span>
                    <input
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      placeholder={
                        ehWhatsApp ? "(11) 96713-6667" : "https://..."
                      }
                      className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
                    />
                    {ehWhatsApp && (
                      <span className="mt-1 block text-xs text-ink-faint">
                        Com DDD. O +55 entra sozinho.
                      </span>
                    )}
                  </label>
                )}

                {ehComprar && (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium text-ink-muted">
                        Plataforma da loja
                      </span>
                      <select
                        value={plataforma}
                        onChange={(e) =>
                          setPlataforma(e.target.value as BuyPlatform)
                        }
                        className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm"
                      >
                        {PLATAFORMAS.map((p) => (
                          <option key={p.valor} value={p.valor}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs text-ink-faint">
                        {PLATAFORMAS.find((p) => p.valor === plataforma)?.ajuda}
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-ink-muted">
                        Seletor do botão de comprar (opcional)
                      </span>
                      <input
                        value={seletor}
                        onChange={(e) => setSeletor(e.target.value)}
                        placeholder="#comprar, .botao-comprar"
                        className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 font-mono text-sm outline-none focus:border-brand-blue"
                      />
                      <span className="mt-1 block text-xs text-ink-faint">
                        Só se a busca automática não achar o botão da sua loja.
                      </span>
                    </label>
                  </>
                )}

                {recebeLead && (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium text-ink-muted">
                        Avisar por e-mail quando chegar um lead
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@suaempresa.com.br"
                        className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-ink-muted">
                        Enviar para um sistema (opcional)
                      </span>
                      <input
                        value={webhook}
                        onChange={(e) => setWebhook(e.target.value)}
                        placeholder="https://hook.make.com/..."
                        className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 font-mono text-sm outline-none focus:border-brand-blue"
                      />
                      <span className="mt-1 block text-xs text-ink-faint">
                        Recebe um POST com os dados do lead — Make, Zapier, n8n
                        ou o CRM do cliente.
                      </span>
                    </label>
                  </>
                )}

                {!PRECISA_DESTINO.includes(tipo) &&
                  !ehComprar &&
                  !recebeLead && (
                    <p className="text-sm text-ink-muted">
                      Este tipo não precisa de destino.
                    </p>
                  )}
              </Etapa>

              <Etapa
                numero={3}
                titulo="Aparência e textos"
                descricao="As duas linhas que aparecem ao lado do vídeo"
              >
                <div>
                  <span className="text-xs font-medium text-ink-muted">
                    Cor do botão
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {CORES.map(([valor, nome]) => (
                      <button
                        key={valor}
                        type="button"
                        title={nome}
                        aria-label={nome}
                        onClick={() => setCor(valor)}
                        style={{ background: valor }}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm text-white transition ${
                          cor.toLowerCase() === valor
                            ? "ring-2 ring-brand-blue ring-offset-2"
                            : ""
                        }`}
                      >
                        {cor.toLowerCase() === valor ? "✓" : ""}
                      </button>
                    ))}
                    <span className="flex items-center gap-2 rounded-lg border border-outline-soft px-2 py-1.5">
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => setCor(e.target.value)}
                        className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        value={cor}
                        onChange={(e) => setCor(e.target.value)}
                        className="w-20 bg-transparent font-mono text-xs uppercase outline-none"
                      />
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-ink-muted">
                    Formato
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["card", "Cartão com ícone", "duas linhas"],
                        ["solid", "Barra colorida", "uma linha"],
                      ] as const
                    ).map(([valor, nome, nota]) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setEstilo(valor)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          estilo === valor
                            ? "border-brand-blue bg-surface-soft font-medium text-brand-ink"
                            : "border-outline-soft text-ink-muted hover:border-outline"
                        }`}
                      >
                        {nome}
                        <span className="block text-[11px] text-ink-faint">
                          {nota}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-ink-muted">
                      Primeira linha{" "}
                      <span className="text-ink-faint">(em negrito)</span>
                    </span>
                    <span className="text-xs text-ink-faint">
                      {rotulo.length} / 45
                    </span>
                  </span>
                  <input
                    value={rotulo}
                    maxLength={45}
                    onChange={(e) => setRotulo(e.target.value)}
                    placeholder={ROTULO_PADRAO[tipo] ?? "Quer saber mais?"}
                    className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
                  />
                </label>

                {estilo === "card" && (
                  <label className="block">
                    <span className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-ink-muted">
                        Segunda linha{" "}
                        <span className="text-ink-faint">(texto de apoio)</span>
                      </span>
                      <span className="text-xs text-ink-faint">
                        {subRotulo.length} / 60
                      </span>
                    </span>
                    <input
                      value={subRotulo}
                      maxLength={60}
                      onChange={(e) => setSubRotulo(e.target.value)}
                      placeholder={SUBROTULO_PADRAO[tipo] ?? ""}
                      className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
                    />
                  </label>
                )}
              </Etapa>
            </>
          )}
        </div>

        <div className="xl:sticky xl:top-[85px]">
          <div className="cartao overflow-hidden">
            <div className="flex items-center gap-2 border-b border-outline-soft px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-brand-ink">
                Prévia ao vivo
              </span>
            </div>
            <div className="bg-surface-soft p-4">
              {tipo !== "none" ? (
                <CtaPreview
                  tipo={tipo}
                  estilo={estilo}
                  rotulo={rotulo}
                  subRotulo={estilo === "card" ? subRotulo : ""}
                  cor={cor}
                />
              ) : (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Sem botão de ação: o vídeo aparece sozinho.
                </p>
              )}
            </div>
            <p className="border-t border-outline-soft px-4 py-2.5 text-xs text-ink-muted">
              É o mesmo desenho que o visitante vê — usa o CSS de produção,
              não uma imitação.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Um passo do formulário, numerado. */
function Etapa({
  numero,
  titulo,
  descricao,
  children,
}: {
  numero: number;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cartao p-5">
      <div className="flex items-start gap-3 border-b border-outline-soft pb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-semibold text-white">
          {numero}
        </span>
        <div>
          <h2 className="text-base font-semibold text-brand-ink">{titulo}</h2>
          <p className="text-xs text-ink-muted">{descricao}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Desenho de cada tipo, no mesmo traço do menu lateral. */
function IconeDoTipo({ tipo }: { tipo: CtaType }) {
  const comum = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5 text-brand-blue",
    "aria-hidden": true,
  };
  if (tipo === "whatsapp" || tipo === "whatsapp_form") {
    return (
      <svg {...comum}>
        <path d="M21 11.5a8.5 8.5 0 01-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1121 11.5z" />
      </svg>
    );
  }
  if (tipo === "form") {
    return (
      <svg {...comum}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </svg>
    );
  }
  if (tipo === "buy") {
    return (
      <svg {...comum}>
        <path d="M6 7h12l-1 12H7L6 7z" />
        <path d="M9 7a3 3 0 016 0" />
      </svg>
    );
  }
  if (tipo === "link") {
    return (
      <svg {...comum}>
        <path d="M14 4h6v6M20 4l-8 8" />
        <path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
    </svg>
  );
}
