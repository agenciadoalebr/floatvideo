"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeDomain, isValidDomain } from "@/lib/domain";

/**
 * Edição do domínio direto no cabeçalho do projeto. Existe porque o
 * domínio deixou de ser decorativo: ele decide onde o widget pode rodar.
 * Sem uma forma de corrigir, um erro de digitação no cadastro deixaria o
 * widget sem funcionar em lugar nenhum, e sem recurso.
 */
export default function ProjectDomainField({
  projectId,
  domain,
}: {
  projectId: string;
  domain: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(domain ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const dominio = normalizeDomain(valor);
    if (!isValidDomain(dominio)) {
      setErro("Domínio inválido. Ex: minhaloja.com.br");
      return;
    }
    setErro("");
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ domain: dominio })
      .eq("id", projectId);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setValor(dominio);
    setEditando(false);
    router.refresh();
  }

  if (!editando) {
    return (
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
        {domain ? (
          <span className="text-neutral-500">{domain}</span>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            Sem domínio — o widget roda em qualquer site
          </span>
        )}
        <button
          onClick={() => setEditando(true)}
          className="text-xs text-neutral-400 underline hover:text-brand-blue"
        >
          {domain ? "alterar" : "definir domínio"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") salvar();
          if (e.key === "Escape") setEditando(false);
        }}
        placeholder="minhaloja.com.br"
        className="rounded-md border border-brand-blue px-2 py-1 text-sm outline-none"
      />
      <button
        onClick={salvar}
        disabled={salvando}
        className="btn-brand rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      <button
        onClick={() => {
          setEditando(false);
          setErro("");
          setValor(domain ?? "");
        }}
        className="text-xs text-neutral-400 hover:text-neutral-700"
      >
        cancelar
      </button>
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </div>
  );
}
