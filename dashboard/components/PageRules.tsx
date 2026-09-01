"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PageRule } from "@/lib/types";

type Props = {
  widgetId: string | null;
  /** Vídeo atualmente selecionado — as regras são dele. */
  videoId: string;
  /** Todas as regras do widget; aqui só entram as deste vídeo. */
  rules: PageRule[];
};

/**
 * Onde este vídeo aparece. Fica logo abaixo do seletor de vídeo porque a
 * regra pertence ao vídeo, não ao widget: a pergunta que a pessoa faz é
 * "em que páginas este vídeo entra?".
 *
 * Vive dentro do <form> do widget, então todo botão precisa de
 * type="button" e o Enter precisa ser contido — senão qualquer um deles
 * dispararia o submit do formulário inteiro.
 */
export default function PageRules({ widgetId, videoId, rules }: Props) {
  const router = useRouter();
  const [matchType, setMatchType] = useState<"contains" | "exact">("contains");
  const [pattern, setPattern] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const minhas = rules.filter((r) => r.video_id === videoId);

  async function adicionar() {
    const p = pattern.trim();
    if (!p) {
      setErro("Escreva o trecho da URL.");
      return;
    }
    if (!widgetId) {
      setErro("Salve o widget antes de criar regras.");
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

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs font-medium text-neutral-700">
        Onde este vídeo aparece
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {minhas.length === 0
          ? "Sem regra, este vídeo entra nas páginas que não têm regra de nenhum outro vídeo. Havendo mais de um assim, aparece o mais recente."
          : "Este vídeo aparece só nas páginas abaixo."}
      </p>

      {minhas.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
          {minhas.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs"
            >
              <span className="text-neutral-600">
                {r.match_type === "exact" ? "URL é exatamente" : "URL contém"}{" "}
                <code className="rounded bg-neutral-100 px-1 text-neutral-800">
                  {r.pattern}
                </code>
              </span>
              <button
                type="button"
                onClick={() => remover(r.id)}
                className="shrink-0 text-red-600 hover:underline"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as "contains" | "exact")}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs"
        >
          <option value="contains">URL contém</option>
          <option value="exact">URL é exatamente</option>
        </select>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Sem isto, o Enter submeteria o formulário do widget.
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder={matchType === "exact" ? "site.com.br/contato" : "/precos"}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-brand-blue"
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={salvando}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
        >
          {salvando ? "..." : "Adicionar"}
        </button>
      </div>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
