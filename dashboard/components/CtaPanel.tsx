"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Widget, WidgetCta, CtaType, BuyPlatform } from "@/lib/types";
import { PLATAFORMAS } from "@/lib/ecommerce";
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
};

/** Segunda linha sugerida, usada só no estilo cartão. */
const SUBROTULO_PADRAO: Partial<Record<CtaType, string>> = {
  whatsapp: "Chame pelo WhatsApp",
  whatsapp_form: "Chame pelo WhatsApp",
  form: "Deixe seu contato",
  buy: "Ver o produto",
};

const AJUDA: Record<CtaType, string> = {
  whatsapp: "Um botão que abre a conversa no WhatsApp direto.",
  whatsapp_form:
    "Pede nome e telefone e só então manda pro WhatsApp — o contato fica registrado mesmo se a pessoa desistir no meio.",
  form: "Formulário completo. O lead fica no painel; não abre o WhatsApp.",
  buy:
    "Fecha o vídeo e leva a pessoa até o botão de compra da própria página, com um destaque piscando nele.",
  none: "O vídeo aparece sem nenhum botão.",
  link: "Link livre (formato antigo).",
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

  return (
    <form onSubmit={salvar} className="max-w-2xl space-y-4">
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-700">Botão de ação</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Vale para <strong>todos os vídeos</strong> deste site. Aparece
            quando alguém abre o vídeo.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600">
            O que aparece no fim do vídeo
          </label>
          <select
            value={tipo}
            onChange={(e) => trocarTipo(e.target.value as CtaType)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="whatsapp">Clique de WhatsApp</option>
            <option value="whatsapp_form">
              Formulário de WhatsApp (nome e telefone)
            </option>
            <option value="form">
              Formulário completo (nome, telefone, e-mail, assunto, mensagem)
            </option>
            <option value="buy">Botão Comprar (e-commerce)</option>
            <option value="none">Sem botão de ação</option>
          </select>
          <p className="mt-1 text-xs text-neutral-500">{AJUDA[tipo]}</p>
        </div>

        {tipo !== "none" && (
          <>
            <div>
              <label className="block text-xs font-medium text-neutral-600">
                Formato do botão
              </label>
              <select
                value={estilo}
                onChange={(e) => setEstilo(e.target.value as "card" | "solid")}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="card">Cartão com ícone (duas linhas)</option>
                <option value="solid">Barra colorida (uma linha)</option>
              </select>
            </div>

            <label className="block">
              <span className="text-xs text-neutral-600">
                {estilo === "card" ? "Primeira linha" : "Texto do botão"}
              </span>
              <input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                placeholder="Quer saber mais?"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
            </label>

            {estilo === "card" && (
              <label className="block">
                <span className="text-xs text-neutral-600">
                  Segunda linha (opcional)
                </span>
                <input
                  value={subRotulo}
                  onChange={(e) => setSubRotulo(e.target.value)}
                  placeholder="Chame pelo WhatsApp"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
                />
              </label>
            )}
          </>
        )}

        {tipo !== "none" && (
          <div>
            <label className="block text-xs font-medium text-neutral-600">
              Cor do botão
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-9 w-16 rounded-md border border-neutral-300"
              />
              <button
                type="button"
                onClick={() => setCor("#25d366")}
                className="text-xs text-neutral-500 underline hover:text-brand-blue"
              >
                voltar ao verde
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Vale para qualquer tipo de botão. O texto vira branco ou preto
              sozinho, conforme a cor escolhida.
            </p>
          </div>
        )}

        {ehComprar && (
          <>
            <label className="block">
              <span className="text-xs text-neutral-600">
                Plataforma da loja
              </span>
              <select
                value={plataforma}
                onChange={(e) => setPlataforma(e.target.value as BuyPlatform)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                {PLATAFORMAS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                {PLATAFORMAS.find((p) => p.valor === plataforma)?.ajuda}
              </p>
            </label>

            {plataforma === "custom" && (
              <label className="block">
                <span className="text-xs text-neutral-600">
                  Seletor CSS do botão de compra
                </span>
                <input
                  value={seletor}
                  onChange={(e) => setSeletor(e.target.value)}
                  placeholder="#comprar, .botao-comprar"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-blue"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Na loja, clique com o botão direito no botão de compra →
                  Inspecionar. Vale o id (<code>#comprar</code>) ou a classe
                  (<code>.botao-comprar</code>) que aparecer nele.
                </p>
              </label>
            )}

            <label className="block">
              <span className="text-xs text-neutral-600">
                Link de reserva (opcional)
              </span>
              <input
                type="url"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="https://loja.com.br/produto"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Usado só se o botão de compra não for encontrado na página —
                em vez de não acontecer nada, abre este endereço.
              </p>
            </label>
          </>
        )}

        {PRECISA_DESTINO.includes(tipo) && (
          <label className="block">
            <span className="text-xs text-neutral-600">
              {ehWhatsApp ? "Número do WhatsApp" : "Endereço de destino"}
            </span>
            <input
              value={destino}
              onChange={(e) => {
                const acao = (e.nativeEvent as InputEvent).inputType ?? "";
                setDestino(
                  ehWhatsApp
                    ? formatarTelefone(e.target.value, acao.startsWith("delete"))
                    : e.target.value
                );
              }}
              placeholder={ehWhatsApp ? "+55 (11) 96713-6667" : "https://..."}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
        )}
      </div>

      {/* Aviso só existe onde alguém deixou dados esperando retorno. No
          clique direto a pessoa já caiu na conversa. */}
      {ehFormulario && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">
              Avisar quando chegar um lead
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Só para os formulários. O clique direto no WhatsApp não dispara
              aviso — quem clica já está na conversa.
            </p>
          </div>
          <label className="block">
            <span className="text-xs text-neutral-600">E-mail (opcional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@agenciadoale.com.br"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-600">Webhook (opcional)</span>
            <input
              type="url"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://hook.make.com/..."
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
          <p className="text-xs text-neutral-400">
            O webhook recebe um POST com os dados do lead — dá pra ligar no
            Make, Zapier, n8n ou no CRM do cliente.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar botão de ação"}
        </button>
        {salvo && !erro && (
          <span role="status" className="text-xs font-medium text-emerald-700">
            Salvo — já vale no site.
          </span>
        )}
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </form>
  );
}
