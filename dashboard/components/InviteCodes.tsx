"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type InviteCode = {
  id: string;
  code: string;
  batch: string;
  created_at: string;
  used_email: string | null;
  used_at: string | null;
};

const QUANTIDADES = [1, 10, 50, 100];

export default function InviteCodes({ codigos }: { codigos: InviteCode[] }) {
  const router = useRouter();
  const [quantidade, setQuantidade] = useState(10);
  const [lote, setLote] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [novos, setNovos] = useState<string[]>([]);
  const [loteAberto, setLoteAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setNovos([]);
    setGerando(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("gerar_invite_codes", {
      p_quantidade: quantidade,
      p_lote: lote.trim() || "Sem nome",
    });

    setGerando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setNovos((data as string[]) ?? []);
    setLote("");
    router.refresh();
  }

  // Agrupa por lote para a lista não virar uma parede de 100 linhas.
  const lotes = new Map<string, InviteCode[]>();
  for (const c of codigos) {
    const atual = lotes.get(c.batch) ?? [];
    atual.push(c);
    lotes.set(c.batch, atual);
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto).catch(() => {});
  }

  const total = codigos.length;
  const usados = codigos.filter((c) => c.used_at).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Códigos gerados", total, "desde o início"],
          [
            "Já utilizados",
            usados,
            total ? `${Math.round((usados / total) * 100)}% do total` : "—",
          ],
          ["Disponíveis", total - usados, "prontos para distribuir"],
          ["Lotes", lotes.size, "campanhas ou parcerias"],
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

      <form onSubmit={gerar} className="cartao p-5">
        <div>
          <h2 className="text-base font-semibold text-brand-ink">
            Novo lote de convites
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Os códigos saem no formato{" "}
            <code className="rounded bg-surface-muted px-1 font-mono text-xs">
              FV-XXXX-XXXX
            </code>{" "}
            e dão 30 dias de teste em vez de 7 para quem se cadastrar com
            eles.
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">
              Nome ou finalidade do lote
            </span>
            <input
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Ex.: Feira do e-commerce, Indicações do João"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Serve só para você achar o lote depois e saber de onde veio o
              cliente.
            </span>
          </label>

          <div>
            <span className="text-xs font-medium text-ink-muted">
              Quantos códigos
            </span>
            <div className="mt-1 flex gap-1 rounded-lg bg-surface-soft p-1">
              {QUANTIDADES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantidade(q)}
                  className={`w-14 rounded-md px-3 py-2 text-sm transition ${
                    quantidade === q
                      ? "bg-surface-card font-medium text-brand-ink shadow-sm"
                      : "text-ink-muted hover:text-brand-ink"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={gerando}
            className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {gerando ? "Gerando..." : "Gerar códigos"}
          </button>
          {erro && <span className="text-sm text-red-600">{erro}</span>}
        </div>

        {novos.length > 0 && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-emerald-900">
                {novos.length}{" "}
                {novos.length === 1 ? "código gerado" : "códigos gerados"}
              </p>
              <button
                type="button"
                onClick={() => copiar(novos.join("\n"))}
                className="rounded-lg border border-emerald-300 bg-surface-card px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                Copiar todos
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {novos.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => copiar(c)}
                  title="Copiar"
                  className="rounded-lg bg-surface-card px-2 py-2 text-center font-mono text-xs text-brand-ink hover:text-brand-blue"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">
              Lotes gerados
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Quantos de cada lote já viraram conta.
            </p>
          </div>
          {lotes.size > 1 && (
            <label className="flex min-w-[220px] items-center gap-2 rounded-lg bg-surface-soft px-3 py-2">
              <span aria-hidden className="text-ink-faint">
                &#8981;
              </span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar lote, código ou e-mail..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              />
            </label>
          )}
        </div>

        {lotes.size === 0 ? (
          <div className="cartao p-10 text-center">
            <p className="text-base font-medium text-brand-ink">
              Nenhum lote criado ainda
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Gere o primeiro lote no formulário acima. Os códigos ficam
              organizados por lote, e aqui você acompanha quantos viraram
              cliente.
            </p>
          </div>
        ) : (
          [...lotes.entries()].map(([nome, itens]) => {
            const usadosNoLote = itens.filter((c) => c.used_at).length;
            const proporcao = Math.round((usadosNoLote / itens.length) * 100);
            const aberto = loteAberto === nome;

            // A busca vale dentro do lote: o filtro esconde as linhas, mas
            // mantém o lote visível para não sumir o contexto do resultado.
            const alvo = busca.trim().toLowerCase();
            const visiveis = alvo
              ? itens.filter(
                  (c) =>
                    c.code.toLowerCase().includes(alvo) ||
                    (c.used_email ?? "").toLowerCase().includes(alvo) ||
                    nome.toLowerCase().includes(alvo)
                )
              : itens;

            if (alvo && visiveis.length === 0) return null;

            return (
              <div key={nome} className="cartao overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-ink">{nome}</p>
                    <p className="text-xs text-ink-faint">
                      {itens.length}{" "}
                      {itens.length === 1 ? "código" : "códigos"} · criado em{" "}
                      {new Date(
                        itens[itens.length - 1].created_at
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-40">
                      <p className="flex justify-between text-xs">
                        <span className="text-ink-muted">
                          {usadosNoLote} de {itens.length} usados
                        </span>
                        <span className="font-medium text-brand-ink">
                          {proporcao}%
                        </span>
                      </p>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet"
                          style={{ width: `${Math.max(2, proporcao)}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLoteAberto(aberto ? null : nome)}
                      aria-expanded={aberto}
                      className="rounded-lg border border-outline-soft px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                    >
                      {aberto ? "Recolher" : "Ver códigos"}
                    </button>
                  </div>
                </div>

                {(aberto || alvo) && (
                  <div className="overflow-x-auto border-t border-outline-soft">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-soft text-ink-faint">
                        <tr>
                          <th className="px-4 py-2 font-medium">Código</th>
                          <th className="px-3 py-2 font-medium">Situação</th>
                          <th className="px-3 py-2 font-medium">Usado por</th>
                          <th className="px-4 py-2 font-medium">Quando</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-soft">
                        {visiveis.map((c) => (
                          <tr key={c.id}>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() => copiar(c.code)}
                                title="Copiar"
                                disabled={!!c.used_at}
                                className={`font-mono text-xs ${
                                  c.used_at
                                    ? "text-ink-faint"
                                    : "text-brand-ink hover:text-brand-blue"
                                }`}
                              >
                                {c.code}
                              </button>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  c.used_at
                                    ? "bg-surface-muted text-ink-muted"
                                    : "bg-emerald-50 text-emerald-800"
                                }`}
                              >
                                {c.used_at ? "Utilizado" : "Disponível"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-ink-muted">
                              {c.used_email ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-ink-faint">
                              {c.used_at
                                ? new Date(c.used_at).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
