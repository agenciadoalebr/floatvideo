"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  documentoValido,
  mascararDocumento,
  mascararTelefone,
} from "@/lib/documentos";
import type { Plano } from "@/components/ContasList";

export type ContaCompleta = {
  id: string;
  nome: string;
  plano: string;
  criada_em: string;
  max_projects: number | null;
  limite_do_plano: number | null;
};

export type AssinaturaAdmin = {
  status: string;
  plan: string;
  titular: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  overdue_since: string | null;
  invoice_url: string | null;
  ultimo_evento: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  created_at: string;
} | null;

export type Pessoa = { email: string; role: string; desde: string };
export type Site = { nome: string; dominio: string | null; videos: number };

const SITUACAO: Record<string, { texto: string; cor: string }> = {
  trialing: { texto: "Em teste", cor: "bg-blue-100 text-blue-800" },
  active: { texto: "Ativa", cor: "bg-emerald-100 text-emerald-800" },
  overdue: { texto: "Em atraso", cor: "bg-amber-100 text-amber-900" },
  suspended: { texto: "Suspensa", cor: "bg-red-100 text-red-800" },
  canceled: { texto: "Cancelada", cor: "bg-surface-muted text-ink-muted" },
  sem_assinatura: {
    texto: "Sem assinatura",
    cor: "bg-surface-soft text-ink-faint",
  },
};

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

/** Só a parte da data, que é o que o <input type="date"> entende. */
function paraCampoDeData(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

/**
 * Ficha da conta, do lado da administração.
 *
 * Metade da tela é edição, metade é consulta. O que vem do Asaas fica só
 * para leitura de propósito: mudar o status aqui não muda lá, e a
 * próxima notificação sobrescreveria de volta — seria um campo que
 * parece funcionar e não funciona.
 */
export default function ContaDetalhe({
  conta,
  assinatura,
  pessoas,
  sites,
  planos,
}: {
  conta: ContaCompleta;
  assinatura: AssinaturaAdmin;
  pessoas: Pessoa[];
  sites: Site[];
  planos: Plano[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(conta.nome);
  const [plano, setPlano] = useState(conta.plano);
  const [excecao, setExcecao] = useState(
    conta.max_projects === null ? "" : String(conta.max_projects)
  );
  const [titular, setTitular] = useState(assinatura?.titular ?? "");
  const [documento, setDocumento] = useState(
    mascararDocumento(assinatura?.cpf_cnpj ?? "")
  );
  const [telefone, setTelefone] = useState(
    mascararTelefone(assinatura?.telefone ?? "")
  );
  const [fimDoTeste, setFimDoTeste] = useState(
    paraCampoDeData(assinatura?.trial_ends_at ?? null)
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [recado, setRecado] = useState("");

  const situacao =
    SITUACAO[assinatura?.status ?? "sem_assinatura"] ?? SITUACAO.sem_assinatura;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setRecado("");

    if (documento.trim() && !documentoValido(documento)) {
      setErro("Este CPF ou CNPJ não é válido.");
      return;
    }

    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: conta.id,
          nome,
          plano,
          excecaoSites: excecao === "" ? null : excecao,
          titular,
          cpfCnpj: documento,
          telefone,
          fimDoTeste: fimDoTeste || null,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível salvar agora.");
        return;
      }
      setRecado(dados.aviso ?? "Dados salvos.");
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue";
  const rotulo = "text-xs text-ink-muted";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        onSubmit={salvar}
        className="cartao space-y-5 p-5"
      >
        <div>
          <h2 className="text-sm font-semibold text-brand-ink">
            Dados cadastrais
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            O que está aqui é nosso e pode ser corrigido. O que vem do Asaas
            fica ao lado, só para consulta.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={rotulo}>Nome da conta</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campo}
            />
          </label>

          <label className="block">
            <span className={rotulo}>Titular da cobrança</span>
            <input
              value={titular}
              onChange={(e) => setTitular(e.target.value)}
              placeholder="Nome ou razão social"
              className={campo}
            />
          </label>

          <label className="block">
            <span className={rotulo}>CPF ou CNPJ</span>
            <input
              value={documento}
              onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
              placeholder="000.000.000-00"
              className={campo}
            />
          </label>

          <label className="block">
            <span className={rotulo}>Telefone</span>
            <input
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              placeholder="(11) 90000-0000"
              className={campo}
            />
          </label>

          <label className="block">
            <span className={rotulo}>Plano</span>
            <select
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              className={campo}
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
          </label>

          <label className="block">
            <span className={rotulo}>Limite de sites (exceção)</span>
            <input
              value={excecao}
              onChange={(e) => setExcecao(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder={`padrão do plano: ${conta.limite_do_plano ?? "∞"}`}
              className={campo}
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Em branco, vale o limite do plano.
            </span>
          </label>

          <label className="block">
            <span className={rotulo}>Fim do teste</span>
            <input
              type="date"
              value={fimDoTeste}
              onChange={(e) => setFimDoTeste(e.target.value)}
              className={campo}
              disabled={!assinatura}
            />
            <span className="mt-1 block text-xs text-ink-faint">
              {assinatura
                ? "Estender aqui não avisa o Asaas: a cobrança dele segue a data original."
                : "Esta conta não tem assinatura."}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          {recado && <span className="text-xs text-emerald-700">{recado}</span>}
          {erro && <span className="text-xs text-red-600">{erro}</span>}
        </div>
      </form>

      <div className="space-y-4">
        <div className="cartao p-5">
          <h2 className="text-sm font-semibold text-brand-ink">Assinatura</h2>
          <p className="mt-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${situacao.cor}`}
            >
              {situacao.texto}
            </span>
          </p>
          <dl className="mt-3 space-y-1.5 text-xs">
            {[
              ["Teste até", data(assinatura?.trial_ends_at ?? null)],
              ["Período até", data(assinatura?.current_period_end ?? null)],
              ["Vencida em", data(assinatura?.overdue_since ?? null)],
              ["Assinou em", data(assinatura?.created_at ?? null)],
              ["Último evento", assinatura?.ultimo_evento ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-ink-faint">{k}</dt>
                <dd className="text-right text-brand-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {assinatura?.invoice_url && (
            <a
              href={assinatura.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-xs font-medium text-brand-blue hover:underline"
            >
              Abrir a fatura em aberto
            </a>
          )}
          {assinatura?.asaas_subscription_id && (
            <p className="mt-3 break-all font-mono text-[11px] text-ink-faint">
              {assinatura.asaas_subscription_id}
              <br />
              {assinatura.asaas_customer_id}
            </p>
          )}
        </div>

        <div className="cartao p-5">
          <h2 className="text-sm font-semibold text-brand-ink">
            Pessoas ({pessoas.length})
          </h2>
          <ul className="mt-2 space-y-2 text-xs">
            {pessoas.map((p) => (
              <li key={p.email} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-brand-ink">
                  {p.email}
                </span>
                <span className="shrink-0 text-ink-faint">{p.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cartao p-5">
          <h2 className="text-sm font-semibold text-brand-ink">
            Sites ({sites.length})
          </h2>
          {sites.length === 0 ? (
            <p className="mt-2 text-xs text-ink-faint">Nenhum site ainda.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {sites.map((s) => (
                <li key={s.nome}>
                  <span className="block text-brand-ink">{s.nome}</span>
                  <span className="text-ink-faint">
                    {s.dominio ?? "sem domínio"} · {s.videos} vídeo(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
