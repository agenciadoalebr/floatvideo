"use client";

import { useMemo, useState } from "react";
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
  situacao: string;
  titular: string | null;
  cpf_cnpj: string | null;
  vence_em: string | null;
  atrasada_desde: string | null;
};

const SITUACAO: Record<string, { texto: string; cor: string }> = {
  trialing: { texto: "Em teste", cor: "bg-blue-100 text-blue-800" },
  active: { texto: "Ativa", cor: "bg-emerald-100 text-emerald-800" },
  overdue: { texto: "Em atraso", cor: "bg-amber-100 text-amber-900" },
  suspended: { texto: "Suspensa", cor: "bg-red-100 text-red-800" },
  canceled: { texto: "Cancelada", cor: "bg-neutral-200 text-neutral-700" },
  // Contas internas e cortesias, que nunca passaram pelo Asaas.
  sem_assinatura: { texto: "Sem assinatura", cor: "bg-neutral-100 text-neutral-500" },
};

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : null;
}

/** Tira pontuação e acento para o "joao" achar o "João" e o CPF ser
 *  encontrado com ou sem pontos. */
function achatar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\-/()\s]/g, "");
}

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
  const [busca, setBusca] = useState("");

  // A lista de contas é pequena e já veio inteira do servidor; filtrar
  // aqui responde a cada tecla sem uma ida ao banco por letra digitada.
  const visiveis = useMemo(() => {
    const alvo = achatar(busca.trim());
    if (!alvo) return contas;
    return contas.filter((c) =>
      [c.nome, c.dono, c.titular, c.cpf_cnpj].some(
        (campo) => campo && achatar(campo).includes(alvo)
      )
    );
  }, [contas, busca]);

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

      <div className="flex items-center gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, CPF ou CNPJ"
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-blue"
        />
        <span className="whitespace-nowrap text-xs text-neutral-400">
          {visiveis.length} de {contas.length}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Conta</th>
              <th className="px-4 py-2 font-medium">Dono</th>
              <th className="px-4 py-2 font-medium">Situação</th>
              <th className="px-4 py-2 font-medium">Sites</th>
              <th className="px-4 py-2 font-medium">Pessoas</th>
              <th className="px-4 py-2 font-medium">Desde</th>
              <th className="px-4 py-2 font-medium">Plano</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma conta com &ldquo;{busca}&rdquo;.
                </td>
              </tr>
            )}
            {visiveis.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-brand-ink">{c.nome}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {c.dono ?? "—"}
                  {/* O titular só aparece quando é diferente do e-mail:
                      repetir a mesma informação duas vezes atrapalha. */}
                  {c.titular && c.titular !== c.dono && (
                    <span className="block text-neutral-400">{c.titular}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      (SITUACAO[c.situacao] ?? SITUACAO.sem_assinatura).cor
                    }`}
                  >
                    {(SITUACAO[c.situacao] ?? SITUACAO.sem_assinatura).texto}
                  </span>
                  {c.situacao === "trialing" && data(c.vence_em) && (
                    <span className="block text-[11px] text-neutral-400">
                      até {data(c.vence_em)}
                    </span>
                  )}
                  {(c.situacao === "overdue" || c.situacao === "suspended") &&
                    data(c.atrasada_desde) && (
                      <span className="block text-[11px] text-neutral-400">
                        vencida em {data(c.atrasada_desde)}
                      </span>
                    )}
                  {c.situacao === "active" && data(c.vence_em) && (
                    <span className="block text-[11px] text-neutral-400">
                      renova {data(c.vence_em)}
                    </span>
                  )}
                </td>
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
