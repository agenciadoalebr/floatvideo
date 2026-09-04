"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

export type Plano = {
  id: string;
  nome: string;
  preco_centavos: number;
  max_projects: number | null;
};

const SITUACAO: Record<string, { texto: string; cor: string }> = {
  trialing: { texto: "Em teste", cor: "bg-blue-100 text-blue-800" },
  active: { texto: "Ativa", cor: "bg-emerald-100 text-emerald-800" },
  overdue: { texto: "Em atraso", cor: "bg-amber-100 text-amber-900" },
  suspended: { texto: "Suspensa", cor: "bg-red-100 text-red-800" },
  canceled: { texto: "Cancelada", cor: "bg-surface-muted text-ink-muted" },
  // Contas internas e cortesias, que nunca passaram pelo Asaas.
  sem_assinatura: {
    texto: "Sem assinatura",
    cor: "bg-surface-soft text-ink-faint",
  },
};

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : null;
}

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** Tira pontuação e acento para o "joao" achar o "João" e o CPF ser
 *  encontrado com ou sem pontos. */
function achatar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.\-/()\s]/g, "");
}

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
  const [situacao, setSituacao] = useState("todas");
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const precoDoPlano = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of planos) mapa[p.id] = p.preco_centavos;
    return mapa;
  }, [planos]);

  const resumo = useMemo(() => {
    const quantas = (s: string) =>
      contas.filter((c) => c.situacao === s).length;
    // Receita recorrente: só o que está de fato sendo cobrado. Teste e
    // atraso não entram — somar quem ainda não pagou infla justamente o
    // número que deveria servir para decidir.
    const mrr = contas
      .filter((c) => c.situacao === "active")
      .reduce((s, c) => s + (precoDoPlano[c.plano] ?? 0), 0);
    return {
      total: contas.length,
      ativas: quantas("active"),
      teste: quantas("trialing"),
      atraso: quantas("overdue"),
      suspensas: quantas("suspended"),
      canceladas: quantas("canceled"),
      mrr,
    };
  }, [contas, precoDoPlano]);

  // A lista de contas é pequena e já veio inteira do servidor; filtrar
  // aqui responde a cada tecla sem uma ida ao banco por letra digitada.
  const visiveis = useMemo(() => {
    const alvo = achatar(busca.trim());
    return contas.filter((c) => {
      if (situacao !== "todas" && c.situacao !== situacao) return false;
      if (!alvo) return true;
      return [c.nome, c.dono, c.titular, c.cpf_cnpj].some(
        (campo) => campo && achatar(campo).includes(alvo)
      );
    });
  }, [contas, busca, situacao]);

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

  async function excluir(conta: Conta) {
    // Digitar o nome, e não um "tem certeza?": aqui somem sites, vídeos,
    // métricas e leads de um cliente, e a assinatura dele é cancelada.
    const confirmacao = prompt(
      `Isto apaga a conta "${conta.nome}" e tudo dentro dela — ${conta.sites} site(s), vídeos, métricas e leads — e cancela a assinatura no Asaas. Não há como desfazer.\n\nPara confirmar, digite o nome da conta:`
    );

    if (confirmacao === null) return;

    if (confirmacao.trim() !== conta.nome.trim()) {
      setErro("O nome digitado não confere. Nada foi excluído.");
      return;
    }

    setErro("");
    setExcluindo(conta.id);
    try {
      const resposta = await fetch("/api/admin/excluir-conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: conta.id }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível excluir agora.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setExcluindo(null);
    }
  }

  function exportarCsv() {
    const header = [
      "Conta",
      "Dono",
      "Titular",
      "CPF/CNPJ",
      "Situação",
      "Plano",
      "Sites",
      "Pessoas",
      "Cliente desde",
    ];
    const linhas = visiveis.map((c) => [
      c.nome,
      c.dono ?? "",
      c.titular ?? "",
      c.cpf_cnpj ?? "",
      (SITUACAO[c.situacao] ?? SITUACAO.sem_assinatura).texto,
      c.plano_nome,
      `${c.sites}/${c.limite_sites ?? "ilimitado"}`,
      String(c.pessoas),
      data(c.criada_em) ?? "",
    ]);
    const csv = [header, ...linhas]
      .map((linha) =>
        linha
          .map((v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v))
          .join(",")
      )
      .join("\r\n");

    // BOM no início pra o Excel reconhecer UTF-8 e não bagunçar acentos.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const filtros: [string, string, number][] = [
    ["todas", "Todas", contas.length],
    ["active", "Ativas", resumo.ativas],
    ["trialing", "Em teste", resumo.teste],
    ["overdue", "Em atraso", resumo.atraso],
    ["suspended", "Suspensas", resumo.suspensas],
    ["canceled", "Canceladas", resumo.canceladas],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Contas
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Todos os clientes do FloatVideo, com a situação da assinatura de
            cada um.
          </p>
        </div>
        <button
          type="button"
          onClick={exportarCsv}
          disabled={visiveis.length === 0}
          className="rounded-lg border border-outline-soft bg-surface-card px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Contas", resumo.total, "cadastradas na plataforma"],
          [
            "Ativas",
            resumo.ativas,
            resumo.total
              ? `${Math.round((resumo.ativas / resumo.total) * 100)}% da base`
              : "—",
          ],
          ["Em teste", resumo.teste, "ainda não pagaram"],
          [
            "Em atraso ou suspensas",
            resumo.atraso + resumo.suspensas,
            resumo.atraso + resumo.suspensas > 0
              ? "precisam de atenção"
              : "nenhuma pendência",
          ],
        ].map(([rotulo, valor, nota]) => (
          <div key={rotulo as string} className="cartao p-4">
            <p className="rotulo-metrica">{rotulo as string}</p>
            <p className="mt-1.5 text-2xl font-semibold text-brand-ink">
              {(valor as number).toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 text-xs text-ink-faint">{nota as string}</p>
          </div>
        ))}
      </div>

      {/* Receita recorrente num cartão próprio: é o número que resume a
          operação, e ele não é uma contagem como os de cima. */}
      <div className="cartao flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="rotulo-metrica">Receita recorrente</p>
          <p className="mt-1 text-3xl font-semibold text-brand-ink">
            R$ {reais(resumo.mrr)}
            <span className="text-sm font-normal text-ink-faint">/mês</span>
          </p>
        </div>
        <p className="max-w-sm text-xs text-ink-muted">
          Soma dos planos das contas <strong>ativas</strong>. Teste e atraso
          ficam de fora — somar quem ainda não pagou infla justamente o número
          que serve para decidir.
        </p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="cartao">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg bg-surface-soft px-3 py-2">
            <span aria-hidden className="text-ink-faint">
              &#8981;
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail, CPF ou CNPJ"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {filtros.map(([valor, nome, quantos]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setSituacao(valor)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  situacao === valor
                    ? "bg-surface-strong font-medium text-brand-ink"
                    : "text-ink-muted hover:bg-surface-soft"
                }`}
              >
                {nome}
                <span className="ml-1 text-xs text-ink-faint">{quantos}</span>
              </button>
            ))}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <p className="border-t border-outline-soft px-5 py-10 text-center text-sm text-ink-muted">
            {contas.length === 0
              ? "Nenhuma conta ainda."
              : "Nenhuma conta com esses filtros."}
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-outline-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-soft text-ink-faint">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Conta</th>
                  <th className="px-3 py-2.5 font-medium">Situação</th>
                  <th className="px-3 py-2.5 font-medium">Sites</th>
                  <th className="px-3 py-2.5 font-medium">Pessoas</th>
                  <th className="px-3 py-2.5 font-medium">Desde</th>
                  <th className="px-3 py-2.5 font-medium">Plano</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-soft">
                {visiveis.map((c) => {
                  const estado =
                    SITUACAO[c.situacao] ?? SITUACAO.sem_assinatura;
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-xs font-semibold text-brand-blue">
                            {iniciais(c.nome)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/contas/${c.id}`}
                              className="block font-medium text-brand-ink hover:text-brand-blue hover:underline"
                            >
                              {c.nome}
                            </Link>
                            <span className="block truncate text-xs text-ink-faint">
                              {c.dono ?? "—"}
                            </span>
                            {/* O titular só aparece quando é diferente do
                                e-mail: repetir atrapalha a leitura. */}
                            {c.titular && c.titular !== c.dono && (
                              <span className="block truncate text-xs text-ink-faint">
                                {c.titular}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.cor}`}
                        >
                          {estado.texto}
                        </span>
                        {c.situacao === "trialing" && data(c.vence_em) && (
                          <span className="mt-0.5 block text-[11px] text-ink-faint">
                            até {data(c.vence_em)}
                          </span>
                        )}
                        {(c.situacao === "overdue" ||
                          c.situacao === "suspended") &&
                          data(c.atrasada_desde) && (
                            <span className="mt-0.5 block text-[11px] text-amber-700">
                              vencida em {data(c.atrasada_desde)}
                            </span>
                          )}
                        {c.situacao === "active" && data(c.vence_em) && (
                          <span className="mt-0.5 block text-[11px] text-ink-faint">
                            renova {data(c.vence_em)}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="text-brand-ink">{c.sites}</span>
                        <span className="text-ink-faint">
                          {" "}
                          / {c.limite_sites ?? "∞"}
                        </span>
                        {/* Exceção negociada aparece marcada: sem isso, um
                            número diferente do plano viraria mistério
                            meses depois. */}
                        {c.excecao_sites !== null && (
                          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                            exceção
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-ink-muted">{c.pessoas}</td>

                      <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                        {data(c.criada_em)}
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={c.plano}
                          disabled={salvando === c.id}
                          onChange={(e) => trocarPlano(c.id, e.target.value)}
                          className="rounded-lg border border-outline-soft bg-surface-card px-2 py-1.5 text-xs disabled:opacity-50"
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

                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <Link
                          href={`/dashboard/contas/${c.id}`}
                          className="rounded-lg border border-outline-soft px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                        >
                          Abrir
                        </Link>
                        <button
                          type="button"
                          onClick={() => excluir(c)}
                          disabled={excluindo === c.id}
                          className="ml-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          {excluindo === c.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-outline-soft px-5 py-3 text-xs text-ink-faint">
          Trocar o plano aqui vale na hora: o limite de sites passa a ser o do
          plano novo. Para abrir exceção a um cliente sem mudar o plano dele, o
          campo é o limite de sites, na ficha da conta.
        </p>
      </div>
    </div>
  );
}
