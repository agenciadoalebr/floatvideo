"use client";

import type { Lead } from "@/lib/types";

type Props = {
  leads: Lead[];
};

export default function LeadsPanel({ leads }: Props) {
  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        Nenhum lead capturado ainda. Quando alguém preencher o formulário do
        widget, aparece aqui.
      </p>
    );
  }

  const allKeys = Array.from(
    leads.reduce((set, lead) => {
      Object.keys(lead.data || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  function downloadCsv() {
    const header = ["Data", ...allKeys, "Página"];
    const rows = leads.map((lead) => [
      new Date(lead.created_at).toLocaleString("pt-BR"),
      ...allKeys.map((k) => String(lead.data?.[k] ?? "")),
      lead.page_url ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");

    // BOM no início pra o Excel reconhecer UTF-8 e não bagunçar acentos.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">{leads.length} lead(s)</p>
        <button
          onClick={downloadCsv}
          className="btn-brand rounded-md px-3 py-1.5 text-xs font-medium"
        >
          Baixar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Data</th>
              {allKeys.map((k) => (
                <th key={k} className="px-3 py-2 font-medium">
                  {k}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Página</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                  {new Date(lead.created_at).toLocaleString("pt-BR")}
                </td>
                {allKeys.map((k) => (
                  <td key={k} className="px-3 py-2 text-neutral-800">
                    {String(lead.data?.[k] ?? "—")}
                  </td>
                ))}
                <td className="px-3 py-2 text-neutral-600">
                  {lead.page_url ? (
                    <a
                      href={lead.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      // O endereco inteiro no title: numa loja ele passa
                      // fácil dos 100 caracteres e esticaria a tabela.
                      title={lead.page_url}
                      className="hover:text-brand-blue hover:underline"
                    >
                      {caminhoDaUrl(lead.page_url)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Só o caminho da URL: o domínio é o mesmo em todas as linhas. */
function caminhoDaUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url;
  }
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
