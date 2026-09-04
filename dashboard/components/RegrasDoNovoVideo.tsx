"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RegraNova = {
  tipo: "all" | "contains" | "exact" | "not_contains";
  padrao: string;
};

const TIPOS: { valor: RegraNova["tipo"]; rotulo: string }[] = [
  { valor: "all", rotulo: "Todas as páginas do site" },
  { valor: "contains", rotulo: "A URL contém" },
  { valor: "exact", rotulo: "A URL é exatamente" },
  { valor: "not_contains", rotulo: "A URL não contém" },
];

export function descreverRegra(r: RegraNova) {
  if (r.tipo === "all") return "Todas as páginas do site";
  const rotulo = TIPOS.find((t) => t.valor === r.tipo)?.rotulo ?? "";
  return `${rotulo} "${r.padrao}"`;
}

/**
 * Grava as regras de um vídeo que acabou de nascer.
 *
 * Fica aqui, e não em cada tela de envio, porque envio de arquivo e link
 * do YouTube criam o mesmo tipo de vídeo e precisam da mesma regra.
 */
export async function salvarRegras(
  supabase: SupabaseClient,
  widgetId: string,
  videoId: string,
  regras: RegraNova[]
) {
  if (regras.length === 0) return null;

  const { error } = await supabase.from("widget_page_rules").insert(
    regras.map((r) => ({
      widget_id: widgetId,
      video_id: videoId,
      match_type: r.tipo,
      // "Todas as páginas" não tem trecho para digitar; grava um
      // marcador porque a coluna do banco não aceita vazio.
      pattern: r.tipo === "all" ? "*" : r.padrao,
    }))
  );

  return error;
}

/**
 * Onde o vídeo vai aparecer, escolhido antes de enviar.
 *
 * As regras ficam em memória até o vídeo existir: elas apontam para um
 * id que só nasce depois do envio. Perguntar antes é de propósito — um
 * vídeo sem regra nenhuma não aparece em lugar nenhum, e descobrir isso
 * depois, olhando um site sem balão, custa caro.
 */
export default function RegrasDoNovoVideo({
  regras,
  aoMudar,
}: {
  regras: RegraNova[];
  aoMudar: (r: RegraNova[]) => void;
}) {
  const [tipo, setTipo] = useState<RegraNova["tipo"]>("all");
  const [padrao, setPadrao] = useState("");
  const [erro, setErro] = useState("");

  function adicionar() {
    const p = tipo === "all" ? "" : padrao.trim();
    if (tipo !== "all" && !p) {
      setErro("Escreva o trecho da URL.");
      return;
    }
    if (regras.some((r) => r.tipo === tipo && r.padrao === p)) {
      setErro("Esta regra já está na lista.");
      return;
    }
    setErro("");
    aoMudar([...regras, { tipo, padrao: p }]);
    setPadrao("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as RegraNova["tipo"])}
          className="rounded-lg border border-outline-soft px-3 py-2 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>

        {tipo !== "all" && (
          <input
            value={padrao}
            onChange={(e) => setPadrao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="/produtos/"
            className="min-w-[180px] flex-1 rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        )}

        <button
          type="button"
          onClick={adicionar}
          className="rounded-lg border border-outline-soft px-3 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
        >
          Adicionar
        </button>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {regras.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {regras.map((r, i) => (
            <li
              key={`${r.tipo}-${r.padrao}`}
              className="flex items-center gap-2 rounded-full bg-surface-strong px-3 py-1 text-xs text-brand-ink"
            >
              {descreverRegra(r)}
              <button
                type="button"
                onClick={() => aoMudar(regras.filter((_, j) => j !== i))}
                aria-label={`Remover ${descreverRegra(r)}`}
                className="text-ink-faint hover:text-red-600"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
