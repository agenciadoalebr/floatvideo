"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Video, Widget } from "@/lib/types";
import { videoLabel } from "@/lib/video";
import WidgetPreview from "@/components/WidgetPreview";
import VideoFraming from "@/components/VideoFraming";

type Props = {
  projectId: string;
  videos: Video[];
  widget: Widget | null;
};

const readyVideos = (videos: Video[]) => videos.filter((v) => v.status === "ready");


export default function WidgetPanel({ projectId, videos, widget }: Props) {
  const router = useRouter();
  // Qual aparelho a prévia está simulando. Só visual: não muda nada
  // do que é salvo.
  const [aparelho, setAparelho] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [salvo, setSalvo] = useState(false);

  // Dois vídeos diferentes, de propósito:
  //
  // videoId  — o padrão do widget, configuração global do site: é o que
  //            aparece nas páginas sem regra de outro vídeo.
  // videoFocoId — apenas qual vídeo está sendo enquadrado no momento.
  //            Trocar aqui não muda o que vai ao ar; serve pra ajustar o
  //            recorte de cada vídeo sem mexer na configuração do site.
  const videoId = widget?.video_id ?? readyVideos(videos)[0]?.id ?? "";
  const [videoFocoId, setVideoFocoId] = useState(
    widget?.video_id ?? readyVideos(videos)[0]?.id ?? ""
  );

  const videoFoco = videos.find((v) => v.id === videoFocoId);
  const [focalX, setFocalX] = useState(videoFoco?.focal_x ?? 50);
  const [focalY, setFocalY] = useState(videoFoco?.focal_y ?? 50);

  // Ao trocar o vídeo em enquadramento, os controles precisam mostrar o
  // ajuste daquele vídeo. Feito durante o render (padrão do React para
  // estado derivado de prop) em vez de efeito, que renderizaria duas
  // vezes e deixaria os controles um passo atrás.
  const [focoAnterior, setFocoAnterior] = useState(videoFocoId);
  if (focoAnterior !== videoFocoId) {
    setFocoAnterior(videoFocoId);
    setFocalX(videoFoco?.focal_x ?? 50);
    setFocalY(videoFoco?.focal_y ?? 50);
  }
  const [shape, setShape] = useState<Widget["shape"]>(widget?.shape ?? "round");
  const [size, setSize] = useState<Widget["size"]>(widget?.size ?? "md");
  const [position, setPosition] = useState<Widget["position"]>(
    widget?.position ?? "bottom-right"
  );
  const [borderColor, setBorderColor] = useState(widget?.border_color ?? "#000000");
  const [offsetX, setOffsetX] = useState(widget?.offset_x ?? 24);
  const [offsetY, setOffsetY] = useState(widget?.offset_y ?? 24);
  const [autoplay, setAutoplay] = useState(widget?.autoplay ?? true);
  const [delaySeconds, setDelaySeconds] = useState(widget?.delay_seconds ?? 3);
  const [gatilho, setGatilho] = useState<Widget["trigger_mode"]>(
    widget?.trigger_mode ?? "time"
  );
  const [scrollPct, setScrollPct] = useState(widget?.trigger_scroll ?? 50);
  const [reappearHours, setReappearHours] = useState(widget?.reappear_hours ?? 1);
  const [isActive, setIsActive] = useState(widget?.is_active ?? true);


  const [customMobile, setCustomMobile] = useState(
    !!(widget?.mobile_size || widget?.mobile_position || widget?.mobile_offset_x || widget?.mobile_offset_y)
  );
  const [mobileSize, setMobileSize] = useState<Widget["size"]>(widget?.mobile_size ?? size);
  const [mobilePosition, setMobilePosition] = useState<Widget["position"]>(
    widget?.mobile_position ?? position
  );
  const [mobileOffsetX, setMobileOffsetX] = useState(widget?.mobile_offset_x ?? 12);
  const [mobileOffsetY, setMobileOffsetY] = useState(widget?.mobile_offset_y ?? 12);

  // A lista de vídeos pode mudar (upload novo, exclusão) depois que este
  // componente já montou — sem isso o enquadramento ficaria preso num
  // vídeo que não existe mais.
  useEffect(() => {
    const existe = readyVideos(videos).some((v) => v.id === videoFocoId);
    if (!existe) {
      setVideoFocoId(readyVideos(videos)[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSalvo(false);

    // O vídeo padrão não é escolhido aqui — esta coluna é só do site.
    // Ao criar o widget pela primeira vez, assume o primeiro vídeo
    // pronto; depois disso quem troca é o botão na seção Vídeos.
    const videoPadrao = widget?.video_id ?? readyVideos(videos)[0]?.id ?? null;
    if (!videoPadrao) {
      setError("Adicione um vídeo antes de salvar.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const widgetPayload = {
      project_id: projectId,
      video_id: videoPadrao,
      shape,
      size,
      position,
      border_color: borderColor,
      offset_x: offsetX,
      offset_y: offsetY,
      mobile_size: customMobile ? mobileSize : null,
      mobile_position: customMobile ? mobilePosition : null,
      mobile_offset_x: customMobile ? mobileOffsetX : null,
      mobile_offset_y: customMobile ? mobileOffsetY : null,
      autoplay,
      muted_start: true,
      delay_seconds: delaySeconds,
      trigger_mode: gatilho,
      trigger_scroll: scrollPct,
      reappear_hours: reappearHours,
      is_active: isActive,
    };

    let widgetId = widget?.id;

    if (widgetId) {
      const { error: updateError } = await supabase
        .from("widgets")
        .update(widgetPayload)
        .eq("id", widgetId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: created, error: insertError } = await supabase
        .from("widgets")
        .insert(widgetPayload)
        .select("id")
        .single();
      if (insertError || !created) {
        setError(insertError?.message ?? "Erro ao criar widget.");
        setSaving(false);
        return;
      }
      widgetId = created.id;
    }


    setSaving(false);
    setSalvo(true);
    // O aviso some sozinho: some depois de alguns segundos em vez de
    // ficar preso na tela sugerindo que o estado atual foi salvo.
    setTimeout(() => setSalvo(false), 4000);
    router.refresh();
  }


  if (readyVideos(videos).length === 0) {
    return (
      <p className="cartao p-4 text-sm text-ink-muted">
        Envie um vídeo primeiro — é ele que aparece dentro do balão.
      </p>
    );
  }

  const PX = { sm: 96, md: 128, lg: 160 } as const;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Personalização do widget
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Defina como e onde a bolha de vídeo aparece para quem visita o
            seu site. Vale para todos os vídeos deste site.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {salvo && (
            <span className="text-xs font-medium text-emerald-700">
              Alterações salvas
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="space-y-5">
          <Etapa
            numero={1}
            titulo="Formato e dimensões"
            descricao="O formato visual da bolha flutuante"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["round", "Círculo clássico", "Proporção 1:1, discreto"],
                  [
                    "rectangular",
                    "Retângulo arredondado",
                    "Estilo card, mais presença",
                  ],
                ] as const
              ).map(([valor, nome, nota]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setShape(valor)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    shape === valor
                      ? "border-brand-blue bg-surface-soft"
                      : "border-outline-soft hover:border-outline"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center bg-gradient-to-br from-brand-blue to-brand-violet text-white ${
                      valor === "round" ? "rounded-full" : "rounded-lg"
                    }`}
                  >
                    ▶
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-brand-ink">
                      {nome}
                    </span>
                    <span className="block text-xs text-ink-faint">{nota}</span>
                  </span>
                </button>
              ))}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-ink-muted">
                  Tamanho da bolha
                </span>
                <span className="text-xs text-ink-faint">{PX[size]} px</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["sm", "Pequeno"],
                    ["md", "Médio"],
                    ["lg", "Grande"],
                  ] as const
                ).map(([valor, nome]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setSize(valor)}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                      size === valor
                        ? "border-brand-blue bg-surface-soft font-medium text-brand-ink"
                        : "border-outline-soft text-ink-muted hover:border-outline"
                    }`}
                  >
                    {nome}
                    <span className="block text-[11px] text-ink-faint">
                      {PX[valor]}px
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-soft p-3">
              <input
                type="checkbox"
                checked={shape === "vertical"}
                onChange={(e) => setShape(e.target.checked ? "vertical" : "round")}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-brand-ink">
                  Formato vertical 9:16
                </span>
                <span className="block text-xs text-ink-muted">
                  Para vídeo gravado no celular, em pé. Ocupa o balão inteiro
                  sem cortar as laterais.
                </span>
              </span>
            </label>
          </Etapa>

          <Etapa
            numero={2}
            titulo="Posição na tela"
            descricao="Onde o balão fica fixado"
          >
            <div>
              <span className="text-xs font-medium text-ink-muted">
                Canto de exibição
              </span>
              <div className="mt-2 grid max-w-[220px] grid-cols-2 gap-2">
                {(
                  [
                    ["bottom-left", "Inferior esquerdo"],
                    ["bottom-right", "Inferior direito"],
                  ] as const
                ).map(([valor, nome]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setPosition(valor)}
                    className={`rounded-lg border p-3 text-xs transition ${
                      position === valor
                        ? "border-brand-blue bg-surface-soft font-medium text-brand-ink"
                        : "border-outline-soft text-ink-muted hover:border-outline"
                    }`}
                  >
                    <span
                      className={`mb-2 flex h-8 rounded bg-surface-muted ${
                        valor === "bottom-right"
                          ? "justify-end"
                          : "justify-start"
                      } items-end p-1`}
                    >
                      <span className="h-3 w-3 rounded-full bg-brand-blue" />
                    </span>
                    {nome}
                  </button>
                ))}
              </div>
              {position === "bottom-right" && (
                <p className="mt-2 text-xs text-ink-faint">
                  O canto inferior direito é o mais usado — mas confira se ele
                  não cobre um botão da sua página.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Numero
                rotulo="Distância horizontal"
                valor={offsetX}
                aoMudar={setOffsetX}
              />
              <Numero
                rotulo="Distância vertical"
                valor={offsetY}
                aoMudar={setOffsetY}
              />
            </div>

            <label className="block">
              <span className="text-xs font-medium text-ink-muted">
                Cor da borda
              </span>
              <span className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-outline-soft bg-surface-card p-1"
                />
                <input
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="w-28 rounded-lg border border-outline-soft px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-blue"
                />
              </span>
            </label>
          </Etapa>

          <Etapa
            numero={3}
            titulo="Comportamento"
            descricao="Quando o balão aparece e como ele começa"
          >
            <div>
              <span className="text-xs font-medium text-ink-muted">
                Quando o widget deve aparecer
              </span>
              <div className="mt-2 space-y-2">
                {(
                  [
                    [
                      "time",
                      "Depois de alguns segundos",
                      "Espera a pessoa começar a ler a página",
                    ],
                    [
                      "scroll",
                      "Quando a pessoa rolar a página",
                      "Dispara quando ela desce até certo ponto",
                    ],
                    [
                      "exit",
                      "Quando a pessoa for embora",
                      "O cursor sobe em direção a fechar a aba",
                    ],
                    [
                      "any",
                      "O que acontecer primeiro",
                      "Combina os três acima",
                    ],
                  ] as const
                ).map(([valor, nome, nota]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setGatilho(valor)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      gatilho === valor
                        ? "border-brand-blue bg-surface-soft"
                        : "border-outline-soft hover:border-outline"
                    }`}
                  >
                    <span
                      className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                        gatilho === valor
                          ? "border-brand-blue bg-brand-blue"
                          : "border-outline"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-brand-ink">
                        {nome}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {nota}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(gatilho === "time" || gatilho === "any") && (
                <Numero
                  rotulo="Segundos de espera"
                  valor={delaySeconds}
                  aoMudar={setDelaySeconds}
                  unidade="s"
                />
              )}
              {(gatilho === "scroll" || gatilho === "any") && (
                <Numero
                  rotulo="Rolagem da página"
                  valor={scrollPct}
                  aoMudar={setScrollPct}
                  unidade="%"
                />
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-soft p-3">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-brand-ink">
                  Reprodução automática
                </span>
                <span className="block text-xs text-ink-muted">
                  O vídeo já começa rodando, sem som, para prender a atenção.
                  O som entra quando a pessoa clica.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-soft p-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-brand-ink">
                  Widget ligado
                </span>
                <span className="block text-xs text-ink-muted">
                  Desligado, nada aparece no site — e nada é apagado.
                </span>
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink-muted">
                Se a pessoa fechar o vídeo, esconder por
              </span>
              <select
                value={reappearHours}
                onChange={(e) => setReappearHours(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm"
              >
                <option value={1}>1 hora</option>
                <option value={6}>6 horas</option>
                <option value={24}>1 dia</option>
                <option value={72}>3 dias</option>
                <option value={168}>7 dias</option>
              </select>
              <span className="mt-1 block text-xs text-ink-faint">
                Vale só para o vídeo fechado. Outros produtos continuam
                mostrando o deles.
              </span>
            </label>
          </Etapa>

          <Etapa
            numero={4}
            titulo="Aparência no celular"
            descricao="Onde o dedo alcança e o que não pode ser coberto"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-soft p-3">
              <input
                type="checkbox"
                checked={customMobile}
                onChange={(e) => setCustomMobile(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-brand-ink">
                  Regras próprias para o celular
                </span>
                <span className="block text-xs text-ink-muted">
                  Sem isso, o celular usa a mesma configuração do computador.
                </span>
              </span>
            </label>

            {customMobile && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">
                    Tamanho no celular
                  </span>
                  <select
                    value={mobileSize}
                    onChange={(e) =>
                      setMobileSize(e.target.value as Widget["size"])
                    }
                    className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm"
                  >
                    <option value="sm">Pequeno (96px)</option>
                    <option value="md">Médio (128px)</option>
                    <option value="lg">Grande (160px)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">
                    Canto no celular
                  </span>
                  <select
                    value={mobilePosition}
                    onChange={(e) =>
                      setMobilePosition(e.target.value as Widget["position"])
                    }
                    className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm"
                  >
                    <option value="bottom-right">Inferior direito</option>
                    <option value="bottom-left">Inferior esquerdo</option>
                  </select>
                </label>
                <Numero
                  rotulo="Distância horizontal"
                  valor={mobileOffsetX}
                  aoMudar={setMobileOffsetX}
                />
                <Numero
                  rotulo="Distância vertical"
                  valor={mobileOffsetY}
                  aoMudar={setMobileOffsetY}
                />
                <p className="text-xs text-ink-faint sm:col-span-2">
                  Muita loja tem barra fixa embaixo no celular. Subir a
                  distância vertical evita o balão cobrir o botão de comprar.
                </p>
              </div>
            )}
          </Etapa>
        </div>

        {/* A prévia acompanha a rolagem: o formulário é longo, e ajustar
            um campo lá embaixo sem enxergar o resultado era o que tornava
            a edição às cegas. */}
        <div className="space-y-4 xl:sticky xl:top-[85px]">
          <div className="cartao overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-outline-soft px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-brand-ink">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Prévia ao vivo
              </span>
              <div className="flex gap-1 rounded-lg bg-surface-soft p-0.5">
                {(
                  [
                    ["desktop", "Computador"],
                    ["mobile", "Celular"],
                  ] as const
                ).map(([valor, nome]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setAparelho(valor)}
                    className={`rounded-md px-2.5 py-1 text-xs transition ${
                      aparelho === valor
                        ? "bg-surface-card font-medium text-brand-ink shadow-sm"
                        : "text-ink-muted"
                    }`}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              <div
                className={`mx-auto ${aparelho === "mobile" ? "max-w-[260px]" : ""}`}
              >
                <WidgetPreview
                  video={videoFoco}
                  focalX={focalX}
                  focalY={focalY}
                  shape={shape}
                  size={aparelho === "mobile" && customMobile ? mobileSize : size}
                  position={
                    aparelho === "mobile" && customMobile
                      ? mobilePosition
                      : position
                  }
                  borderColor={borderColor}
                  offsetX={
                    aparelho === "mobile" && customMobile
                      ? mobileOffsetX
                      : offsetX
                  }
                  offsetY={
                    aparelho === "mobile" && customMobile
                      ? mobileOffsetY
                      : offsetY
                  }
                />
              </div>
            </div>

            {/* O peso é o do arquivo que está no ar, medido na build —
                não uma estimativa simpática. */}
            <p className="flex items-center justify-between gap-2 border-t border-outline-soft bg-surface-soft px-4 py-2.5 text-xs text-ink-muted">
              <span>Peso do widget no site do cliente</span>
              <strong className="text-brand-ink">34 KB</strong>
            </p>
          </div>

          <div className="cartao space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">
                Enquadramento por vídeo
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                Escolha o vídeo para ajustar como ele fica dentro do balão.
                Trocar aqui não muda o vídeo que vai ao ar.
              </p>
            </div>

            <select
              value={videoFocoId}
              onChange={(e) => setVideoFocoId(e.target.value)}
              className="w-full rounded-lg border border-outline-soft px-3 py-2 text-sm"
            >
              {readyVideos(videos).map((v) => (
                <option key={v.id} value={v.id}>
                  {videoLabel(v)}
                </option>
              ))}
            </select>

            {videoFocoId && (
              <VideoFraming
                videoId={videoFocoId}
                focalX={focalX}
                focalY={focalY}
                onChange={(x, y) => {
                  setFocalX(x);
                  setFocalY(y);
                }}
              />
            )}
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
      <div className="flex items-start justify-between gap-3 border-b border-outline-soft pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-semibold text-white">
            {numero}
          </span>
          <div>
            <h2 className="text-base font-semibold text-brand-ink">{titulo}</h2>
            <p className="text-xs text-ink-muted">{descricao}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Campo numérico com os botões de menos e mais. */
function Numero({
  rotulo,
  valor,
  aoMudar,
  unidade = "px",
}: {
  rotulo: string;
  valor: number;
  aoMudar: (n: number) => void;
  unidade?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-muted">{rotulo}</span>
      <span className="mt-1 flex items-center rounded-lg border border-outline-soft">
        <button
          type="button"
          onClick={() => aoMudar(Math.max(0, valor - 1))}
          aria-label={`Diminuir ${rotulo}`}
          className="px-3 py-2 text-ink-faint hover:text-brand-blue"
        >
          −
        </button>
        <input
          type="number"
          value={valor}
          onChange={(e) => aoMudar(Number(e.target.value))}
          className="w-full border-x border-outline-soft px-2 py-2 text-center text-sm outline-none"
        />
        <span className="px-2 text-xs text-ink-faint">{unidade}</span>
        <button
          type="button"
          onClick={() => aoMudar(valor + 1)}
          aria-label={`Aumentar ${rotulo}`}
          className="px-3 py-2 text-ink-faint hover:text-brand-blue"
        >
          +
        </button>
      </span>
    </label>
  );
}
