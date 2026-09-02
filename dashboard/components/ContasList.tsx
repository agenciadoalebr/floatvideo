"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Conta = {
  id: string;
  nome: string;
  plano: string;
  plano_nome: string;
  excecao_sites: number | null;
  limite_sites: number | null;
  sites: number;
  pessoas: number;
  dono: string | null;
  criada_em: string;
};

export type Plano = {
  id: string;
  nome: string;
  preco_centavos: number;
  max_projects: number | null;
};

export default function ContasList({
  contas,
  planos,
}: {
  contas: Conta[];
  planos: Plano[];
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function trocarPlano(orgId: string, plano: string) {
    setErro("");
    setSalvando(orgId);
    const supabase = createClient();
    const { error } = await supabase.rpc("definir_plano", {
      p_org: orgId,
      p_plano: plano,
    });
    setSalvando(null);
    if (error) {
      setErro(error.message);
      return;
    }
    router.refresh();
  }

  if (contas.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        Nenhuma conta ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Conta</th>
              <th className="px-4 py-2 font-medium">Dono</th>
              <th className="px-4 py-2 font-medium">Sites</th>
              <th className="px-4 py-2 font-medium">Pessoas</th>
              <th className="px-4 py-2 font-medium">Desde</th>
              <th className="px-4 py-2 font-medium">Plano</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {contas.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-brand-ink">{c.nome}</td>
                <td className="px-4 py-2 text-neutral-600">{c.dono ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {c.sites}
                  <span className="text-neutral-400">
                    {" "}
                    / {c.limite_sites ?? "∞"}
                  </span>
                  {/* Exceção negociada aparece marcada: sem isso, um número
                      diferente do plano viraria mistério meses depois. */}
                  {c.excecao_sites !== null && (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                      exceção
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-600">{c.pessoas}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {new Date(c.criada_em).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={c.plano}
                    disabled={salvando === c.id}
                    onChange={(e) => trocarPlano(c.id, e.target.value)}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {planos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.preco_centavos > 0
                          ? ` — R$ ${(p.preco_centavos / 100).toFixed(0)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
