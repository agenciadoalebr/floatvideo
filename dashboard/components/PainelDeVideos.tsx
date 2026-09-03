"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WidgetPreview from "@/components/WidgetPreview";
import CtaPreview from "@/components/CtaPreview";
import VideoList from "@/components/VideoList";
import type { Video, Widget, WidgetCta, PageRule, Lead } from "@/lib/types";

function numero(n: number) {
  return n.toLocaleString("pt-BR");
}

function porcento(parte: number, todo: number) {
  if (!todo) return null;
  return ((parte / todo) * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
}

function desde(iso: string) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** Como cada tipo de botão se descreve, e para onde ele manda. */
const DESTINO: Record<string, string> = {
  whatsapp: "Conversar no WhatsApp",
  whatsapp_form: "Formulário e depois WhatsApp",
  form: "Formulário de contato",
  buy: "Ir ao botão de comprar da página",
  link: "Abrir um link",
};

function irPara(secao: string) {
  window.dispatchEvent(new CustomEvent("fvw-goto-tab", { detail: secao }));
}

/**
 * A tela de Vídeos.
 *
 * Antes era só a lista. Agora ela abre respondendo as três perguntas que
 * a pessoa tem ao entrar: está no ar? quanta gente viu? o que acontece
 * quando clicam? A lista continua embaixo, que é onde ela é útil — na
 * hora de mexer, não na de conferir.
 */
export default function PainelDeVideos({
  videos,
  projectId,
  widget,
  cta,
  pageRules,
  leads,
  eventos,
  dominio,
}: {
  videos: Video[];
  projectId: string;
  widget: Widget | null;
  cta: WidgetCta | null;
  pageRules: PageRule[];
  leads: Lead[];
  eventos: Record<string, number>;
  dominio: string | null;
}) {
  const router = useRouter();
  const [alternando, setAlternando] = useState(false);

  const impressoes = eventos.impression ?? 0;
  const expansoes = eventos.expand ?? 0;
  const cliques = eventos.cta_click ?? 0;
  const taxa = porcento(expansoes, impressoes);

  const emCartaz = videos.find((v) => v.id === widget?.video_id);
  const noAr = Boolean(widget?.is_active && emCartaz && pageRules.length > 0);

  async function alternarWidget() {
    if (!widget) return;
    setAlternando(true);
    const supabase = createClient();
    await supabase
      .from("widgets")
      .update({ is_active: !widget.is_active })
      .eq("id", widget.id);
    setAlternando(false);
    router.refresh();
  }

  const metricas = [
    {
      rotulo: "Aparições do balão",
      valor: numero(impressoes),
      nota: null as string | null,
      texto: "Pessoas que viram o vídeo flutuando no canto do site.",
    },
    {
      rotulo: "Cliques para expandir",
      valor: numero(expansoes),
      nota: taxa ? `${taxa}% de abertura` : null,
      texto: "Visitantes que clicaram e assistiram ao vídeo em tela cheia.",
    },
    {
      rotulo: "Cliques no botão de ação",
      valor: numero(cliques),
      nota: leads.length ? `${numero(leads.length)} contatos` : null,
      texto: "Quem seguiu para o WhatsApp, o formulário ou a compra.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.rotulo} className="cartao p-5">
            <p className="rotulo-metrica">{m.rotulo}</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-semibold text-brand-ink">
                {m.valor}
              </span>
              {m.nota && (
                <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-brand-blue">
                  {m.nota}
                </span>
              )}
            </p>
            {/* A frase embaixo do número é o que faz a métrica servir para
                quem não sabe o que é "impressão". */}
            <p className="mt-2 text-xs text-ink-muted">{m.texto}</p>
          </div>
        ))}
      </div>

      <section className="cartao overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-soft px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-brand-ink">
            <span
              className={`h-2 w-2 rounded-full ${
                noAr ? "bg-emerald-500" : "bg-ink-faint"
              }`}
            />
            {noAr
              ? "Vídeo ativo agora no seu site"
              : "Nenhum vídeo no ar neste momento"}
          </h2>
          <span className="text-xs text-ink-faint">
            Simulação de como aparece
          </span>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {/* Navegador de mentira com o balão de verdade dentro: é o
              produto aparecendo no painel, e a única parte da tela que a
              pessoa reconhece sem ler nada. */}
          <div className="rounded-xl bg-surface-soft p-4">
            <div className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2">
              <span className="flex gap-1">
                {["bg-red-300", "bg-amber-300", "bg-emerald-300"].map((c) => (
                  <span key={c} className={`h-2 w-2 rounded-full ${c}`} />
                ))}
              </span>
              <span className="mx-auto text-xs text-ink-faint">
                {dominio ?? "seusite.com.br"}
              </span>
            </div>

            <div className="relative mt-3 h-64">
              <div className="space-y-2 opacity-60">
                <div className="h-2 w-24 rounded bg-surface-strong" />
                <div className="h-2 w-full rounded bg-surface-strong" />
                <div className="h-2 w-5/6 rounded bg-surface-strong" />
                <div className="mt-4 h-20 w-full rounded-lg bg-surface-strong" />
                <div className="h-2 w-2/3 rounded bg-surface-strong" />
              </div>

              {widget && emCartaz && (
                <div className="absolute inset-0">
                  <WidgetPreview
                    video={emCartaz}
                    shape={widget.shape}
                    size={widget.size}
                    position={widget.position}
                    borderColor={widget.border_color}
                    offsetX={widget.offset_x}
                    offsetY={widget.offset_y}
                    focalX={emCartaz.focal_x ?? 50}
                    focalY={emCartaz.focal_y ?? 50}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    noAr
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {noAr ? "Ao vivo no site" : "Fora do ar"}
                </span>
                {emCartaz && (
                  <span className="text-xs text-ink-faint">
                    Atualizado {desde(emCartaz.created_at)}
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-xl font-semibold text-brand-ink">
                {emCartaz?.name ?? "Nenhum vídeo escolhido"}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {!emCartaz
                  ? "Escolha um vídeo na lista abaixo para ele aparecer no site."
                  : pageRules.length === 0
                    ? "Falta dizer em quais páginas ele aparece — sem regra, o vídeo não entra em lugar nenhum."
                    : !widget?.is_active
                      ? "O widget está pausado, então nada aparece para o visitante."
                      : `Em ${pageRules.length} ${pageRules.length === 1 ? "regra de página" : "regras de página"}${
                          emCartaz.duration_seconds
                            ? ` · ${emCartaz.duration_seconds} segundos`
                            : ""
                        }`}
              </p>
            </div>

            {cta ? (
              <div className="rounded-xl bg-surface-soft p-4">
                <p className="rotulo-metrica">Ação configurada no clique</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-ink">
                      {DESTINO[cta.type] ?? cta.type}
                    </p>
                    <p className="truncate text-xs text-ink-faint">
                      {cta.target_url || cta.label || "sem destino definido"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => irPara("cta")}
                    className="shrink-0 rounded-lg border border-outline-soft bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                  >
                    Alterar
                  </button>
                </div>

                <div className="mt-3">
                  <CtaPreview
                    tipo={cta.type}
                    estilo={
                      (cta.button_style as "card" | "solid" | null) ?? "card"
                    }
                    rotulo={cta.label ?? ""}
                    subRotulo={cta.sublabel ?? ""}
                    cor={widget?.cta_color ?? "#22c55e"}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  Sem botão de ação, o vídeo informa mas não converte.
                </p>
                <button
                  type="button"
                  onClick={() => irPara("cta")}
                  className="mt-2 text-xs font-medium text-amber-900 underline"
                >
                  Configurar o botão
                </button>
              </div>
            )}

            <div className="mt-auto grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={alternarWidget}
                disabled={!widget || alternando}
                className="rounded-lg border border-outline-soft px-3 py-2.5 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
              >
                {widget?.is_active ? "Pausar no site" : "Ativar no site"}
              </button>
              <button
                type="button"
                onClick={() => irPara("widget")}
                className="rounded-lg border border-outline-soft px-3 py-2.5 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Editar estilo
              </button>
              <button
                type="button"
                onClick={() => irPara("upload")}
                className="rounded-lg border border-outline-soft px-3 py-2.5 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Enviar outro
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <h2 className="text-base font-semibold text-brand-ink">
            Seus vídeos
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Quem aparece em qual página, e o que cada um rendeu.
          </p>
          <div className="mt-4">
            <VideoList
              videos={videos}
              projectId={projectId}
              widget={widget}
              pageRules={pageRules}
            />
          </div>
        </section>

        <aside className="cartao h-fit p-5">
          <h2 className="text-base font-semibold text-brand-ink">
            Últimos contatos
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Gerados pelo botão de ação do vídeo.
          </p>

          {leads.length === 0 ? (
            <p className="mt-4 text-xs text-ink-faint">
              Nenhum contato ainda. Eles aparecem aqui assim que alguém
              usar o botão de ação.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-2">
                {leads.slice(0, 5).map((lead) => {
                  const dados = (lead.data ?? {}) as Record<string, string>;
                  const nome =
                    dados["Nome"] ?? dados["nome"] ?? dados["Ação"] ?? "Contato";
                  const contato =
                    dados["Telefone"] ??
                    dados["telefone"] ??
                    dados["E-mail"] ??
                    dados["Destino"] ??
                    "";
                  return (
                    <li
                      key={lead.id}
                      className="rounded-xl bg-surface-soft p-3"
                    >
                      <p className="truncate text-sm font-medium text-brand-ink">
                        {nome}
                      </p>
                      {contato && (
                        <p className="truncate text-xs text-ink-muted">
                          {contato}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {desde(lead.created_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => irPara("leads")}
                className="mt-4 w-full rounded-lg border border-outline-soft px-3 py-2 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Ver todos os {numero(leads.length)} contatos →
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
