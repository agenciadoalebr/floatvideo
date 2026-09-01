"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Widget, WidgetCta, CtaType } from "@/lib/types";
import { formatarTelefone, telefoneParaWhatsApp } from "@/lib/domain";

type Props = {
  widget: Widget | null;
  cta: WidgetCta | null;
};

/** Tipos que levam a algum lugar e portanto precisam de destino. */
const PRECISA_DESTINO: CtaType[] = ["whatsapp", "whatsapp_form", "link", "buy"];

const AJUDA: Record<CtaType, string> = {
  whatsapp: "Um botão que abre a conversa no WhatsApp direto.",
  whatsapp_form:
    "Pede nome e telefone e só então manda pro WhatsApp — o contato fica registrado mesmo se a pessoa desistir no meio.",
  form: "Formulário completo. O lead fica no painel; não abre o WhatsApp.",
  buy: "Em breve.",
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
  const [rotulo, setRotulo] = useState(cta?.label ?? "Fale no WhatsApp");
  const [destino, setDestino] = useState(() => {
    const salvo = cta?.target_url ?? "";
    return salvo.includes("wa.me/") ? formatarTelefone(salvo) : salvo;
  });
  const [email, setEmail] = useState(widget?.notify_email ?? "");
  const [webhook, setWebhook] = useState(widget?.notify_webhook_url ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  const ehWhatsApp = tipo === "whatsapp" || tipo === "whatsapp_form";
  const ehFormulario = tipo === "form" || tipo === "whatsapp_form";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvo(false);

    if (!widget) return;

    if (PRECISA_DESTINO.includes(tipo) && !destino.trim()) {
      setErro(ehWhatsApp ? "Informe o número do WhatsApp." : "Informe o destino.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();

    const { error: erroWidget } = await supabase
      .from("widgets")
      .update({
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
        target_url: PRECISA_DESTINO.includes(tipo)
          ? ehWhatsApp
            ? "https://wa.me/" + telefoneParaWhatsApp(destino)
            : destino
          : null,
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
            onChange={(e) => setTipo(e.target.value as CtaType)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="whatsapp">Clique de WhatsApp</option>
            <option value="whatsapp_form">
              Formulário de WhatsApp (nome e telefone)
            </option>
            <option value="form">
              Formulário completo (nome, telefone, e-mail, assunto, mensagem)
            </option>
            <option value="buy" disabled>
              Botão Comprar — em breve
            </option>
            <option value="none">Sem botão de ação</option>
          </select>
          <p className="mt-1 text-xs text-neutral-500">{AJUDA[tipo]}</p>
        </div>

        {tipo !== "none" && tipo !== "buy" && (
          <label className="block">
            <span className="text-xs text-neutral-600">Texto do botão</span>
            <input
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Fale no WhatsApp"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
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
