"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  videoId: string;
  focalX: number;
  focalY: number;
  /** Avisa o pai a cada arraste, pra prévia acompanhar ao vivo. */
  onChange: (x: number, y: number) => void;
};

/**
 * Enquadramento do vídeo dentro do balão. O balão corta o vídeo (ele é
 * redondo ou vertical, o vídeo quase nunca é), e o corte pelo centro
 * costuma pegar o peito da pessoa em vez do rosto.
 *
 * Salva ao soltar o controle, não a cada pixel do arraste: arrastar
 * dispararia uma escrita por movimento do mouse.
 */
export default function VideoFraming({ videoId, focalX, focalY, onChange }: Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function salvar(x: number, y: number) {
    setSalvando(true);
    setSalvo(false);
    const supabase = createClient();
    await supabase
      .from("videos")
      .update({ focal_x: x, focal_y: y })
      .eq("id", videoId);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
    router.refresh();
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-700">
          Enquadramento no balão
        </p>
        {salvando ? (
          <span className="text-xs text-neutral-400">salvando...</span>
        ) : salvo ? (
          <span className="text-xs text-emerald-600">salvo</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">
        O balão corta o vídeo. Use para centralizar o rosto em vez do peito.
      </p>

      <div className="mt-2 space-y-2">
        <label className="block">
          <span className="text-xs text-neutral-600">
            Horizontal {focalX === 50 ? "(centro)" : `${focalX}%`}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={focalX}
            onChange={(e) => onChange(Number(e.target.value), focalY)}
            onPointerUp={() => salvar(focalX, focalY)}
            onKeyUp={() => salvar(focalX, focalY)}
            className="mt-1 w-full accent-[var(--color-brand-blue)]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-600">
            Vertical {focalY === 50 ? "(centro)" : `${focalY}%`}
            {focalY < 50 && " — mostra mais o topo"}
            {focalY > 50 && " — mostra mais a base"}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={focalY}
            onChange={(e) => onChange(focalX, Number(e.target.value))}
            onPointerUp={() => salvar(focalX, focalY)}
            onKeyUp={() => salvar(focalX, focalY)}
            className="mt-1 w-full accent-[var(--color-brand-blue)]"
          />
        </label>
      </div>

      {(focalX !== 50 || focalY !== 50) && (
        <button
          type="button"
          onClick={() => {
            onChange(50, 50);
            salvar(50, 50);
          }}
          className="mt-2 text-xs text-neutral-400 underline hover:text-brand-blue"
        >
          voltar ao centro
        </button>
      )}
    </div>
  );
}
