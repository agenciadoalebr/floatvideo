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

  return (
    <div className="space-y-6">
      <form
        onSubmit={gerar}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
      >
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">
            Gerar códigos de convite
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Cada código cria uma conta nova, com organização própria, e só pode
            ser usado uma vez.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-xs text-neutral-600">Nome do lote</span>
            <input
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Ex: Feira do e-commerce, Indicações do João"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-600">Quantidade</span>
            <select
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-32"
            >
              {QUANTIDADES.map((q) => (
                <option key={q} value={q}>
                  {q} {q === 1 ? "convite" : "convites"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={gerando}
          className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {gerando ? "Gerando..." : "Gerar"}
        </button>
        {erro && <p className="text-xs text-red-600">{erro}</p>}

        {novos.length > 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-900">
                {novos.length} código(s) gerado(s)
              </p>
              <button
                type="button"
                onClick={() => copiar(novos.join("\n"))}
                className="text-xs font-medium text-emerald-800 underline"
              >
                copiar todos
              </button>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto text-xs text-emerald-900">
              {novos.join("\n")}
            </pre>
          </div>
        )}
      </form>

      {lotes.size === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Nenhum código gerado ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {[...lotes.entries()].map(([nome, itens]) => {
            const usados = itens.filter((c) => c.used_at).length;
            const aberto = loteAberto === nome;
            return (
              <div
                key={nome}
                className="rounded-lg border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setLoteAberto(aberto ? null : nome)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left"
                >
                  <span className="text-sm font-medium text-brand-ink">{nome}</span>
                  <span className="text-xs text-neutral-500">
                    {usados} de {itens.length} usados
                  </span>
                </button>

                {aberto && (
                  <div className="border-t border-neutral-100">
                    <div className="flex justify-end px-5 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          copiar(
                            itens
                              .filter((c) => !c.used_at)
                              .map((c) => c.code)
                              .join("\n")
                          )
                        }
                        className="text-xs text-neutral-500 underline hover:text-brand-blue"
                      >
                        copiar os não usados
                      </button>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-500">
                        <tr>
                          <th className="px-5 py-2 font-medium">Código</th>
                          <th className="px-5 py-2 font-medium">Situação</th>
                          <th className="px-5 py-2 font-medium">Usado por</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {itens.map((c) => (
                          <tr key={c.id}>
                            <td className="px-5 py-2">
                              <button
                                type="button"
                                onClick={() => copiar(c.code)}
                                title="Copiar"
                                className="font-mono text-neutral-800 hover:text-brand-blue"
                              >
                                {c.code}
                              </button>
                            </td>
                            <td className="px-5 py-2">
                              {c.used_at ? (
                                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] text-neutral-700">
                                  usado
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                                  disponível
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-2 text-neutral-600">
                              {c.used_email ?? "—"}
                              {c.used_at && (
                                <span className="ml-2 text-neutral-400">
                                  {new Date(c.used_at).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
