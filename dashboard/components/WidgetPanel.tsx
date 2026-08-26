"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Video, Widget, WidgetCta } from "@/lib/types";
import { videoLabel } from "@/lib/video";
import WidgetPreview from "@/components/WidgetPreview";
import EmbedCodeBox from "@/components/EmbedCodeBox";

type Props = {
  projectId: string;
  embedKey: string;
  videos: Video[];
  widget: Widget | null;
  cta: WidgetCta | null;
};

const readyVideos = (videos: Video[]) => videos.filter((v) => v.status === "ready");

export default function WidgetPanel({ projectId, embedKey, videos, widget, cta }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [salvo, setSalvo] = useState(false);

  const [videoId, setVideoId] = useState(widget?.video_id ?? readyVideos(videos)[0]?.id ?? "");
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
  const [isActive, setIsActive] = useState(widget?.is_active ?? true);

  const [ctaType, setCtaType] = useState<"link" | "whatsapp">(
    (cta?.type as "link" | "whatsapp") ?? "whatsapp"
  );
  const [ctaLabel, setCtaLabel] = useState(cta?.label ?? "Fale no WhatsApp");
  const [ctaUrl, setCtaUrl] = useState(cta?.target_url ?? "");

  const [customMobile, setCustomMobile] = useState(
    !!(widget?.mobile_size || widget?.mobile_position || widget?.mobile_offset_x || widget?.mobile_offset_y)
  );
  const [mobileSize, setMobileSize] = useState<Widget["size"]>(widget?.mobile_size ?? size);
  const [mobilePosition, setMobilePosition] = useState<Widget["position"]>(
    widget?.mobile_position ?? position
  );
  const [mobileOffsetX, setMobileOffsetX] = useState(widget?.mobile_offset_x ?? 12);
  const [mobileOffsetY, setMobileOffsetY] = useState(widget?.mobile_offset_y ?? 12);

  // Troca imediata quando o card do vídeo pede: o refresh do servidor
  // confirma depois (e a key remonta o painel), mas o seletor já mostra
  // o vídeo certo no instante do clique.
  useEffect(() => {
    function handle(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id) setVideoId(id);
    }
    window.addEventListener("fvw-set-widget-video", handle);
    return () => window.removeEventListener("fvw-set-widget-video", handle);
  }, []);

  // A lista de vídeos pode mudar (upload novo, exclusão) depois que este
  // componente já montou — sem isso, o formulário ficava "preso" num
  // vídeo que não existe mais e o salvamento quebrava com erro de FK.
  useEffect(() => {
    const stillExists = readyVideos(videos).some((v) => v.id === videoId);
    if (!stillExists) {
      setVideoId(readyVideos(videos)[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSalvo(false);

    if (!videoId) {
      setError("Selecione um vídeo antes de salvar.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const widgetPayload = {
      project_id: projectId,
      video_id: videoId || null,
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

    if (ctaUrl) {
      const ctaPayload = {
        widget_id: widgetId,
        type: ctaType,
        label: ctaLabel,
        target_url: ctaType === "whatsapp" ? toWhatsAppLink(ctaUrl) : ctaUrl,
      };
      if (cta) {
        await supabase.from("widget_ctas").update(ctaPayload).eq("id", cta.id);
      } else {
        await supabase.from("widget_ctas").insert(ctaPayload);
      }
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
        <Bloco titulo="Conteúdo">
        <div>
          <label className="block text-xs font-medium text-neutral-600">Vídeo</label>
          <select
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {readyVideos(videos).map((v) => (
              <option key={v.id} value={v.id}>
                {videoLabel(v)}
              </option>
            ))}
          </select>
        </div>
        </Bloco>

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

        <Bloco titulo="Botão de ação">
        <div>
          <label className="block text-xs font-medium text-neutral-600">
            Botão de ação (CTA) — só aparece quando o vídeo é expandido
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select
              value={ctaType}
              onChange={(e) => setCtaType(e.target.value as "link" | "whatsapp")}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="link">Link (ex: comprar)</option>
            </select>
            <input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Texto do botão"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder={
              ctaType === "whatsapp" ? "Número: 5511999999999" : "https://..."
            }
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
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
      {/* A prévia acompanha a rolagem; o código de instalação vem logo
          abaixo dela, porque instalar é o passo seguinte natural de quem
          acabou de configurar o widget. */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <WidgetPreview
          video={videos.find((v) => v.id === videoId)}
          shape={shape}
          size={size}
          position={position}
          borderColor={borderColor}
          offsetX={offsetX}
          offsetY={offsetY}
        />
        <EmbedCodeBox embedKey={embedKey} />
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

function toWhatsAppLink(value: string) {
  if (value.startsWith("http")) return value;
  const digits = value.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}
