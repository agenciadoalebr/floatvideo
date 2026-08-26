"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PageRule, Video } from "@/lib/types";
import { videoLabel } from "@/lib/video";

type Props = {
  widgetId: string | null;
  videos: Video[];
  rules: PageRule[];
  /** Vídeo do widget, usado quando nenhuma regra casa. */
  defaultVideoId: string | null;
};

/**
 * Regras por página: o mesmo código de instalação exibe vídeos
 * diferentes conforme a URL. Quem decide qual vídeo vale é o servidor,
 * na RPC — aqui é só o cadastro das regras.
 */
export default function PageRules({ widgetId, videos, rules, defaultVideoId }: Props) {
  const router = useRouter();
  const prontos = videos.filter((v) => v.status === "ready");

  const [videoId, setVideoId] = useState(prontos[0]?.id ?? "");
  const [matchType, setMatchType] = useState<"contains" | "exact">("contains");
  const [pattern, setPattern] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!widgetId) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        Salve o widget primeiro para poder criar regras por página.
      </p>
    );
  }

  async function adicionar() {
    const p = pattern.trim();
    if (!p) {
      setErro("Escreva o trecho da URL.");
      return;
    }
    if (!videoId) {
      setErro("Escolha um vídeo.");
      return;
    }
    setErro("");
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.from("widget_page_rules").insert({
      widget_id: widgetId,
      video_id: videoId,
      match_type: matchType,
      pattern: p,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setPattern("");
    router.refresh();
  }

  async function remover(id: string) {
    const supabase = createClient();
    await supabase.from("widget_page_rules").delete().eq("id", id);
    router.refresh();
  }

  const nomeDoVideo = (id: string) => {
    const v = videos.find((x) => x.id === id);
    return v ? videoLabel(v) : "vídeo removido";
  };

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h3 className="text-sm font-semibold text-neutral-700">
          Vídeo por página
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          O site usa um código de instalação só. Aqui você define qual vídeo
          aparece em cada página. Sem regra, vale o vídeo padrão do widget
          {defaultVideoId && (
            <> — hoje <strong>{nomeDoVideo(defaultVideoId)}</strong></>
          )}
          .
        </p>
      </div>

      {rules.length > 0 && (
        <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-100">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
            >
              <span className="text-neutral-600">
                {r.match_type === "exact" ? "URL é exatamente" : "URL contém"}{" "}
                <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-800">
                  {r.pattern}
                </code>{" "}
                → <strong className="text-brand-ink">{nomeDoVideo(r.video_id)}</strong>
              </span>
              <button
                onClick={() => remover(r.id)}
                className="text-red-600 hover:underline"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as "contains" | "exact")}
          className="rounded-md border border-neutral-300 px-2 py-2 text-xs"
        >
          <option value="contains">URL contém</option>
          <option value="exact">URL é exatamente</option>
        </select>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") adicionar();
          }}
          placeholder={matchType === "exact" ? "site.com.br/contato" : "/precos"}
          className="rounded-md border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-blue"
        />
        <select
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-2 text-xs"
        >
          {prontos.map((v) => (
            <option key={v.id} value={v.id}>
              {videoLabel(v)}
            </option>
          ))}
        </select>
        <button
          onClick={adicionar}
          disabled={salvando}
          className="btn-brand rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          {salvando ? "..." : "Adicionar"}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <p className="text-xs text-neutral-400">
        Quando mais de uma regra serve, vale a mais específica: &quot;é
        exatamente&quot; ganha de &quot;contém&quot;, e entre as de
        &quot;contém&quot; ganha o trecho mais longo.
      </p>
    </div>
  );
}
