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
  const [reappearHours, setReappearHours] = useState(widget?.reappear_hours ?? 1);
  const [analytics, setAnalytics] = useState<Widget["analytics_mode"]>(
    widget?.analytics_mode ?? "auto"
  );
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
    // pronto; depois disso quem troca é o botão na aba Vídeos.
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
      reappear_hours: reappearHours,
      analytics_mode: analytics,
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
      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        Adicione um vídeo acima para poder configurar o widget.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
      >
        <div className="border-b border-neutral-100 pb-3">
          <h3 className="text-sm font-semibold text-neutral-700">
            Edição global
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Vale para <strong>todos os vídeos</strong> deste site.
          </p>
        </div>

        <Bloco titulo="Aparência">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600">Formato</label>
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value as Widget["shape"])}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="round">Redondo</option>
              <option value="rectangular">Retangular</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">Tamanho</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as Widget["size"])}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="sm">Pequeno</option>
              <option value="md">Médio</option>
              <option value="lg">Grande</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">Posição</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Widget["position"])}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="bottom-right">Direita</option>
              <option value="bottom-left">Esquerda</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">
              Cor da borda
            </label>
            <input
              type="color"
              value={borderColor}
              onChange={(e) => setBorderColor(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-neutral-300"
            />
          </div>
        </div>

        </Bloco>

        <Bloco titulo="Posição na tela">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600">
              Distância da lateral (px)
            </label>
            <input
              type="number"
              min={0}
              value={offsetX}
              onChange={(e) => setOffsetX(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">
              Distância de baixo (px)
            </label>
            <input
              type="number"
              min={0}
              value={offsetY}
              onChange={(e) => setOffsetY(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        </Bloco>

        <Bloco titulo="Comportamento">
        <div>
          <label className="block text-xs font-medium text-neutral-600">
            Aparece depois de (segundos)
          </label>
          <input
            type="number"
            min={0}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600">
            Se a pessoa fechar, volta a aparecer em
          </label>
          <select
            value={reappearHours}
            onChange={(e) => setReappearHours(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value={1}>1 hora</option>
            <option value={6}>6 horas</option>
            <option value={24}>1 dia</option>
            <option value={72}>3 dias</option>
            <option value={168}>7 dias</option>
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            Vale só para o vídeo que a pessoa fechou. Os vídeos das outras
            páginas continuam aparecendo normalmente.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600">
            Enviar eventos para o Analytics do site
          </label>
          <select
            value={analytics}
            onChange={(e) =>
              setAnalytics(e.target.value as Widget["analytics_mode"])
            }
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="auto">Automático (recomendado)</option>
            <option value="gtm">Só Google Tag Manager</option>
            <option value="gtag">Só gtag (GA4 direto)</option>
            <option value="none">Não enviar</option>
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            No automático, o widget usa o dataLayer do GTM e só chama o gtag
            se não houver GTM na página — com os dois, o mesmo evento
            chegaria duas vezes no GA4. As métricas deste painel não dependem
            disso.
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm text-neutral-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
            />
            Autoplay
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Widget ativo
          </label>
        </div>

        </Bloco>

        <Bloco titulo="Celular">
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
            <input
              type="checkbox"
              checked={customMobile}
              onChange={(e) => setCustomMobile(e.target.checked)}
            />
            Usar layout diferente no celular
          </label>
          {customMobile && (
            <div className="mt-2 space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600">
                    Tamanho (mobile)
                  </label>
                  <select
                    value={mobileSize}
                    onChange={(e) => setMobileSize(e.target.value as Widget["size"])}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="sm">Pequeno</option>
                    <option value="md">Médio</option>
                    <option value="lg">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600">
                    Posição (mobile)
                  </label>
                  <select
                    value={mobilePosition}
                    onChange={(e) => setMobilePosition(e.target.value as Widget["position"])}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="bottom-right">Direita</option>
                    <option value="bottom-left">Esquerda</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600">
                    Distância da lateral (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={mobileOffsetX}
                    onChange={(e) => setMobileOffsetX(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600">
                    Distância de baixo (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={mobileOffsetY}
                    onChange={(e) => setMobileOffsetY(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        </Bloco>


        <button
          type="submit"
          disabled={saving}
          className="btn-brand w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar widget"}
        </button>
        {salvo && !error && (
          <p
            role="status"
            className="rounded-md bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700"
          >
            Widget salvo — as mudanças já valem no site.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      {/* A prévia acompanha a rolagem: o formulário é longo, e ajustar
          um campo lá embaixo sem enxergar o resultado era justamente o
          que tornava a edição às cegas. */}
      {/* A prévia acompanha a rolagem: o formulário é longo, e ajustar um
          campo lá embaixo sem enxergar o resultado era o que tornava a
          edição às cegas. */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">
              Enquadramento por vídeo
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Escolha o vídeo para ajustar como ele fica dentro do balão.
              Trocar aqui não muda o vídeo que vai ao ar.
            </p>
          </div>

          <select
            value={videoFocoId}
            onChange={(e) => setVideoFocoId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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

        <WidgetPreview
          video={videoFoco}
          focalX={focalX}
          focalY={focalY}
          shape={shape}
          size={size}
          position={position}
          borderColor={borderColor}
          offsetX={offsetX}
          offsetY={offsetY}
        />
      </div>
    </div>
  );
}

/** Agrupa campos sob um titulo, pra o formulario deixar de ser uma
 *  lista corrida de controles sem hierarquia. */
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

