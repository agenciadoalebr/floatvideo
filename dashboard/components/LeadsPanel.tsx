"use client";

import { useMemo, useState } from "react";
import type { Lead, Video } from "@/lib/types";
import { videoLabel } from "@/lib/video";

type Props = {
  leads: Lead[];
  videos: Video[];
};

const PERIODOS = [
  [1, "Hoje"],
  [7, "7 dias"],
  [30, "30 dias"],
  [90, "90 dias"],
  [0, "Tudo"],
] as const;

/** Iniciais para o círculo, quando não há foto nenhuma — e não há. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function quando(iso: string) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Só o caminho da URL: o domínio é o mesmo em todas as linhas. */
function caminhoDaUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
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

/**
 * Os quatro jeitos de um lead chegar, e como cada um se chama na tela.
 *
 * O tipo vem do campo "Ação" que o player grava no clique. Antes a tela
 * só perguntava se esse campo existia, e chamava tudo que existia de
 * WhatsApp — então quem usa o botão de comprar de e-commerce via oito
 * leads marcados como WhatsApp numa loja que não tem WhatsApp nenhum.
 */
const ORIGENS = {
  whatsapp: {
    rotulo: "WhatsApp",
    cartao: "Foram para o WhatsApp",
    texto: "Clicaram e a conversa abriu no aparelho da pessoa.",
    cor: "bg-emerald-50 text-emerald-800",
  },
  compra: {
    rotulo: "Comprar",
    cartao: "Foram para a compra",
    texto: "Clicaram e a página levou até o botão de comprar.",
    cor: "bg-indigo-50 text-indigo-800",
  },
  link: {
    rotulo: "Link",
    cartao: "Abriram o link",
    texto: "Clicaram no botão e seguiram para a página indicada.",
    cor: "bg-sky-50 text-sky-800",
  },
  formulario: {
    rotulo: "Formulário",
    cartao: "Preencheram o formulário",
    texto: "Deixaram nome e contato dentro do vídeo.",
    cor: "bg-surface-muted text-ink-muted",
  },
} as const;

type Origem = keyof typeof ORIGENS;

function classificar(acao: string): Origem {
  const t = acao.toLowerCase();
  if (!t) return "formulario";
  if (t.includes("whatsapp")) return "whatsapp";
  if (t.includes("comprar") || t.includes("compra")) return "compra";
  return "link";
}

/** O que dá para saber de um lead a partir dos campos que ele preencheu. */
function lerLead(lead: Lead) {
  const d = (lead.data ?? {}) as Record<string, string>;
  const chave = (parte: string) =>
    Object.keys(d).find((k) => k.toLowerCase().includes(parte));

  const nome = d[chave("nome") ?? ""] ?? "";
  const telefone = d[chave("telefone") ?? ""] ?? d[chave("celular") ?? ""] ?? "";
  const email = d[chave("mail") ?? ""] ?? "";
  const acao = d["Ação"] ?? d["Acao"] ?? "";

  return {
    // A própria ação como título: "Clique em Comprar" diz o que
    // aconteceu, e "Clique no botão" repetido oito vezes não diz nada.
    nome: nome || acao || "Contato",
    telefone,
    email,
    origem: classificar(acao),
    outros: Object.entries(d).filter(
      ([k]) =>
        k !== "Ação" &&
        k !== "Acao" &&
        !["nome", "telefone", "celular", "mail"].some((p) =>
          k.toLowerCase().includes(p)
        )
    ),
  };
}

export default function LeadsPanel({ leads, videos }: Props) {
  const [dias, setDias] = useState<number>(30);
  // Lido uma vez, na montagem: o relógio a cada render deixa o filtro de
  // período instável, e o React reclama com razão.
  const [agora] = useState(() => Date.now());
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState<Origem | "todos">("todos");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const nomeDoVideo = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const v of videos) mapa[v.id] = videoLabel(v);
    return mapa;
  }, [videos]);

  const noPeriodo = useMemo(() => {
    if (!dias) return leads;
    const limite = agora - dias * 86400000;
    return leads.filter((l) => new Date(l.created_at).getTime() >= limite);
  }, [leads, dias, agora]);

  // Só os tipos que a conta realmente usa viram cartão e filtro: uma
  // loja sem WhatsApp não precisa de um cartão zerado de WhatsApp, nem
  // de um botão de filtro que nunca acha nada.
  const contagem = useMemo(() => {
    const mapa = {} as Record<Origem, number>;
    for (const lead of noPeriodo) {
      const o = lerLead(lead).origem;
      mapa[o] = (mapa[o] ?? 0) + 1;
    }
    return mapa;
  }, [noPeriodo]);

  const presentes = (Object.keys(ORIGENS) as Origem[]).filter(
    (o) => (contagem[o] ?? 0) > 0
  );

  const visiveis = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    return noPeriodo.filter((lead) => {
      const info = lerLead(lead);
      // Um filtro que sumiu do período em vista deixa de valer: senão a
      // lista fica vazia sem nenhum botão aceso explicando por quê.
      if (
        origem !== "todos" &&
        presentes.includes(origem) &&
        info.origem !== origem
      ) {
        return false;
      }
      if (!alvo) return true;
      return JSON.stringify(lead.data ?? {})
        .toLowerCase()
        .includes(alvo);
    });
  }, [noPeriodo, busca, origem, presentes]);

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  function baixarCsv() {
    const chaves = Array.from(
      visiveis.reduce((set, lead) => {
        Object.keys(lead.data || {}).forEach((k) => set.add(k));
        return set;
      }, new Set<string>())
    );
    const header = ["Data", ...chaves, "Página", "Vídeo"];
    const rows = visiveis.map((lead) => [
      new Date(lead.created_at).toLocaleString("pt-BR"),
      ...chaves.map((k) => String((lead.data as Record<string, string>)?.[k] ?? "")),
      lead.page_url ?? "",
      lead.video_id ? (nomeDoVideo[lead.video_id] ?? "") : "",
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            Leads
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Quem clicou no botão de ação do vídeo, de qual página veio e como
            falar com essa pessoa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-surface-soft p-1">
            {PERIODOS.map(([valor, nome]) => (
              <button
                key={nome}
                type="button"
                onClick={() => setDias(valor)}
                className={`rounded-md px-2.5 py-1.5 text-sm transition ${
                  dias === valor
                    ? "bg-surface-card font-medium text-brand-ink shadow-sm"
                    : "text-ink-muted hover:text-brand-ink"
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={baixarCsv}
            disabled={visiveis.length === 0}
            className="rounded-lg border border-outline-soft bg-surface-card px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            rotulo: "Contatos no período",
            valor: noPeriodo.length,
            texto: "Todo mundo que usou o botão de ação.",
          },
          ...presentes.map((o) => ({
            rotulo: ORIGENS[o].cartao,
            valor: contagem[o] ?? 0,
            texto: ORIGENS[o].texto,
          })),
        ].map((c) => (
          <div key={c.rotulo} className="cartao p-5">
            <p className="rotulo-metrica">{c.rotulo}</p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">
              {c.valor.toLocaleString("pt-BR")}
            </p>
            <p className="mt-2 text-xs text-ink-muted">{c.texto}</p>
          </div>
        ))}
      </div>

      <div className="cartao">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg bg-surface-soft px-3 py-2">
            <span aria-hidden className="text-ink-faint">
              ⌕
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {presentes.length > 1 &&
              ([["todos", "Todos"]] as [Origem | "todos", string][])
                .concat(presentes.map((o) => [o, ORIGENS[o].rotulo]))
                .map(([valor, nome]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setOrigem(valor)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  origem === valor
                    ? "bg-surface-strong font-medium text-brand-ink"
                    : "text-ink-muted hover:bg-surface-soft"
                }`}
              >
                {nome}
              </button>
            ))}
          </div>

          <span className="whitespace-nowrap text-xs text-ink-faint">
            {visiveis.length} de {noPeriodo.length}
          </span>
        </div>

        {visiveis.length === 0 ? (
          <div className="border-t border-outline-soft px-5 py-12 text-center">
            <p className="text-base font-medium text-brand-ink">
              {leads.length === 0
                ? "Nenhum contato ainda"
                : "Nenhum contato com esses filtros"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              {leads.length === 0
                ? "Quando alguém clicar no botão de ação do vídeo — no WhatsApp ou no formulário — o contato aparece aqui, com a página de onde veio."
                : "Tente outro período ou limpe a busca."}
            </p>
            {leads.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("fvw-goto-tab", { detail: "cta" })
                  )
                }
                className="mt-4 rounded-lg border border-outline-soft px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Conferir o botão de ação
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-outline-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-soft text-ink-faint">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Contato</th>
                  <th className="px-3 py-2.5 font-medium">Página de origem</th>
                  <th className="px-3 py-2.5 font-medium">Vídeo</th>
                  <th className="px-3 py-2.5 font-medium">Quando</th>
                  <th className="px-5 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-soft">
                {visiveis.map((lead) => {
                  const info = lerLead(lead);
                  const contato = info.telefone || info.email;
                  const digitos = info.telefone.replace(/\D/g, "");
                  return (
                    <tr key={lead.id} className="align-top">
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-xs font-semibold text-white">
                            {iniciais(info.nome)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-brand-ink">
                                {info.nome}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORIGENS[info.origem].cor}`}
                              >
                                {ORIGENS[info.origem].rotulo}
                              </span>
                            </p>
                            {contato && (
                              <button
                                type="button"
                                onClick={() => copiar(contato, lead.id)}
                                title="Copiar"
                                className="mt-0.5 text-xs text-ink-muted hover:text-brand-blue"
                              >
                                {contato}
                                <span className="ml-1 text-ink-faint">
                                  {copiado === lead.id ? "copiado" : "⧉"}
                                </span>
                              </button>
                            )}
                            {aberto === lead.id && info.outros.length > 0 && (
                              <dl className="mt-2 space-y-0.5 text-xs">
                                {info.outros.map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <dt className="text-ink-faint">{k}:</dt>
                                    <dd className="text-ink-muted">{v}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                            {info.outros.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAberto(aberto === lead.id ? null : lead.id)
                                }
                                className="mt-1 text-[11px] text-brand-blue hover:underline"
                              >
                                {aberto === lead.id
                                  ? "ocultar detalhes"
                                  : `ver mais ${info.outros.length} campo(s)`}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="max-w-[220px] px-3 py-3">
                        {lead.page_url ? (
                          <a
                            href={lead.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={lead.page_url}
                            className="block truncate text-ink-muted hover:text-brand-blue hover:underline"
                          >
                            {caminhoDaUrl(lead.page_url)}
                          </a>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-ink-muted">
                        {lead.video_id
                          ? (nomeDoVideo[lead.video_id] ?? "vídeo removido")
                          : "—"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="block text-ink-muted">
                          {quando(lead.created_at)}
                        </span>
                        <span className="block text-xs text-ink-faint">
                          {new Date(lead.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {digitos.length >= 10 ? (
                          <a
                            href={`https://wa.me/${digitos.length > 11 ? digitos : "55" + digitos}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-outline-soft px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                          >
                            Conversar
                          </a>
                        ) : info.email ? (
                          <a
                            href={`mailto:${info.email}`}
                            className="rounded-lg border border-outline-soft px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                          >
                            Responder
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {leads.length >= 500 && (
          <p className="border-t border-outline-soft px-5 py-3 text-xs text-ink-faint">
            Mostrando os 500 contatos mais recentes. Para o histórico
            completo, use o Exportar CSV.
          </p>
        )}
      </div>
    </div>
  );
}
