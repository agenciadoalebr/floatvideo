"use client";

import { useState } from "react";
import Link from "next/link";
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
  email_do_dono: string | null;
  observacoes: string | null;
  bloqueio_manual: boolean;
  /** Assinatura "Float Video" no rodapé do vídeo aberto. */
  exibir_marca: boolean;
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
export type Registro = {
  id: string;
  acao: string;
  ator_email: string;
  detalhe: string | null;
  ip: string | null;
  created_at: string;
};

/** Nome legível de cada ação registrada. */
const ACOES: Record<string, string> = {
  acessou_como_cliente: "Entrou na conta como o cliente",
  bloqueou_conta: "Bloqueou o acesso da conta",
  desbloqueou_conta: "Desbloqueou o acesso da conta",
};
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
  auditoria,
}: {
  conta: ContaCompleta;
  assinatura: AssinaturaAdmin;
  pessoas: Pessoa[];
  sites: Site[];
  planos: Plano[];
  auditoria: Registro[];
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
  const [observacoes, setObservacoes] = useState(conta.observacoes ?? "");
  const [bloqueio, setBloqueio] = useState(conta.bloqueio_manual);
  const [exibirMarca, setExibirMarca] = useState(conta.exibir_marca);
  const [acessando, setAcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [recado, setRecado] = useState("");

  const situacao =
    SITUACAO[assinatura?.status ?? "sem_assinatura"] ?? SITUACAO.sem_assinatura;

  /** Soma dias ao fim do teste a partir de hoje, ou da data já posta. */
  function somarDias(dias: number) {
    const base = fimDoTeste ? new Date(fimDoTeste + "T12:00:00") : new Date();
    base.setDate(base.getDate() + dias);
    setFimDoTeste(base.toISOString().slice(0, 10));
  }

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
          observacoes,
          bloqueioManual: bloqueio,
          exibirMarca,
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

  async function acessarComoCliente() {
    const motivo = prompt(
      `Você vai entrar no painel como o dono de "${conta.nome}".\n\n` +
        "Isto é acesso completo: você passa a ser essa pessoa, com os mesmos poderes dela. " +
        "Sua sessão de administrador é substituída — para voltar a ser você, saia e entre de novo.\n\n" +
        "O acesso fica registrado com o seu e-mail, a data e o IP.\n\n" +
        "Descreva o motivo:"
    );
    if (motivo === null) return;

    setErro("");
    setAcessando(true);
    try {
      const resposta = await fetch("/api/admin/acessar-conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: conta.id, motivo }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível acessar agora.");
        return;
      }
      // A sessão já trocou nos cookies; basta recarregar o painel.
      window.location.href = "/dashboard";
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setAcessando(false);
    }
  }

  const campo =
    "mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue";
  const rotulo = "text-xs font-medium text-ink-muted";

  return (
    <form onSubmit={salvar} className="space-y-6">
      <div className="cartao p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
              {conta.nome}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2.5 py-1 font-medium ${situacao.cor}`}
              >
                {situacao.texto}
              </span>
              <span className="rounded-full bg-surface-strong px-2.5 py-1 font-medium text-brand-blue">
                {planos.find((p) => p.id === plano)?.nome ?? conta.plano}
              </span>
              <span className="rounded-full bg-surface-soft px-2.5 py-1 text-ink-muted">
                Cliente desde {data(conta.criada_em)}
              </span>
              {bloqueio && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800">
                  Acesso bloqueado pela administração
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={acessarComoCliente}
              disabled={acessando}
              className="rounded-lg border border-outline-soft bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
            >
              {acessando ? "Abrindo..." : "Acessar como cliente"}
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>

        {(recado || erro) && (
          <p
            className={`mt-3 text-sm ${erro ? "text-red-600" : "text-emerald-700"}`}
          >
            {erro || recado}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-5">
          <section className="cartao p-5">
            <div className="border-b border-outline-soft pb-4">
              <h2 className="text-base font-semibold text-brand-ink">
                Dados cadastrais
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                O que está aqui é nosso e pode ser corrigido. O que vem do
                Asaas fica ao lado, só para consulta.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={rotulo}>Nome da conta</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className={campo}
                />
              </label>

              <label className="block">
                <span className={rotulo}>E-mail de acesso</span>
                <input
                  value={conta.email_do_dono ?? "sem dono"}
                  readOnly
                  className={campo + " bg-surface-soft text-ink-muted"}
                />
                <span className="mt-1 block text-xs text-ink-faint">
                  É o login do cliente. Trocar exige o Supabase — não é
                  cadastro, é autenticação.
                </span>
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
                  onChange={(e) =>
                    setDocumento(mascararDocumento(e.target.value))
                  }
                  placeholder="000.000.000-00"
                  className={campo}
                />
              </label>

              <label className="block">
                <span className={rotulo}>Telefone</span>
                <input
                  value={telefone}
                  onChange={(e) =>
                    setTelefone(mascararTelefone(e.target.value))
                  }
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
            </div>

            <div className="mt-5 border-t border-outline-soft pt-4">
              <p className="rotulo-metrica">Limites e prazos</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={rotulo}>Limite de sites (exceção)</span>
                  <input
                    value={excecao}
                    onChange={(e) =>
                      setExcecao(e.target.value.replace(/\D/g, ""))
                    }
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
                  <span className="mt-1 flex gap-2">
                    <input
                      type="date"
                      value={fimDoTeste}
                      onChange={(e) => setFimDoTeste(e.target.value)}
                      className="w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue disabled:bg-surface-soft"
                      disabled={!assinatura}
                    />
                    {/* Estender é a operação mais comum aqui: um botão
                        evita abrir o calendário e contar dias na mão. */}
                    {assinatura &&
                      ([7, 14] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => somarDias(d)}
                          className="shrink-0 rounded-lg border border-outline-soft px-2.5 text-xs font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
                        >
                          +{d}d
                        </button>
                      ))}
                  </span>
                  <span className="mt-1 block text-xs text-ink-faint">
                    {assinatura
                      ? "Estender aqui não avisa o Asaas: a cobrança dele segue a data original."
                      : "Esta conta não tem assinatura."}
                  </span>
                </label>
              </div>
            </div>

            {/* Fica junto das outras decisões nossas sobre a conta, e não
                nas configurações do cliente: quem tira a assinatura somos
                nós, caso a caso. */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-soft pt-4">
              <span>
                <span className="block text-sm font-medium text-brand-ink">
                  Assinatura no vídeo
                </span>
                <span className="block text-xs text-ink-faint">
                  O &ldquo;Float Video&rdquo; embaixo do vídeo aberto, no site
                  do cliente.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={exibirMarca}
                aria-label={
                  exibirMarca
                    ? "Retirar a assinatura do vídeo"
                    : "Mostrar a assinatura no vídeo"
                }
                onClick={() => setExibirMarca((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  exibirMarca ? "bg-brand-blue" : "bg-surface-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    exibirMarca ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <label className="mt-5 block border-t border-outline-soft pt-4">
              <span className="flex items-baseline justify-between">
                <span className={rotulo}>Observações internas</span>
                <span className="text-xs text-ink-faint">
                  o cliente nunca vê
                </span>
              </span>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Ex.: veio por indicação da Nuvemshop. Pediu aumento de sites para a Black Friday."
                className={campo}
              />
            </label>
          </section>

          <section className="cartao border-red-200 p-5">
            <h2 className="text-base font-semibold text-red-800">
              Zona de perigo
            </h2>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-outline-soft pb-4">
              <div className="max-w-md">
                <p className="text-sm font-medium text-brand-ink">
                  Bloquear o acesso desta conta
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  O vídeo para de aparecer nos sites do cliente na hora. Nada
                  é apagado, e o painel dele continua abrindo. É decisão da
                  administração, separada do pagamento — a próxima
                  notificação do Asaas não desfaz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBloqueio((v) => !v)}
                className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium ${
                  bloqueio
                    ? "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    : "border-red-300 text-red-700 hover:bg-red-50"
                }`}
              >
                {bloqueio ? "Desbloquear" : "Bloquear acesso"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-md">
                <p className="text-sm font-medium text-brand-ink">
                  Excluir a conta
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Apaga sites, vídeos, métricas e leads, e cancela a
                  assinatura no Asaas. Não há como desfazer.
                </p>
              </div>
              <Link
                href="/dashboard/contas"
                className="shrink-0 rounded-lg border border-outline-soft px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Excluir pela lista de contas
              </Link>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="cartao p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-brand-ink">
                Assinatura
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${situacao.cor}`}
              >
                {situacao.texto}
              </span>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              {[
                ["Teste até", data(assinatura?.trial_ends_at ?? null)],
                ["Período até", data(assinatura?.current_period_end ?? null)],
                ["Vencida em", data(assinatura?.overdue_since ?? null)],
                ["Assinou em", data(assinatura?.created_at ?? null)],
                ["Último evento", assinatura?.ultimo_evento ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
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
                className="mt-4 block rounded-lg border border-outline-soft px-4 py-2 text-center text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue"
              >
                Abrir a fatura em aberto
              </a>
            )}

            {assinatura?.asaas_subscription_id && (
              <p className="mt-4 break-all border-t border-outline-soft pt-3 font-mono text-[11px] text-ink-faint">
                {assinatura.asaas_subscription_id}
                <br />
                {assinatura.asaas_customer_id}
              </p>
            )}
          </section>

          <section className="cartao p-5">
            <h2 className="text-base font-semibold text-brand-ink">
              Pessoas ({pessoas.length})
            </h2>
            {pessoas.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">
                Nenhuma pessoa nesta conta.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pessoas.map((p) => (
                  <li
                    key={p.email}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm text-brand-ink">
                      {p.email}
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {p.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cartao p-5">
            <h2 className="text-base font-semibold text-brand-ink">
              Sites ({sites.length})
            </h2>
            {sites.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">Nenhum site ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sites.map((s) => (
                  <li key={s.nome} className="rounded-lg bg-surface-soft p-3">
                    <span className="block text-sm text-brand-ink">
                      {s.nome}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {s.dominio ?? "sem domínio"} · {s.videos} vídeo(s)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* O histórico fica na própria ficha: o lugar de conferir quem
              mexeu na conta é a conta, não uma tela separada que ninguém
              abre. */}
          <section className="cartao p-5">
            <h2 className="text-base font-semibold text-brand-ink">
              Histórico da administração
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Acessos e bloqueios feitos pela nossa equipe nesta conta.
            </p>
            {auditoria.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">
                Ninguém da equipe entrou nesta conta.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {auditoria.map((a) => (
                  <li key={a.id} className="rounded-lg bg-surface-soft p-3">
                    <p className="text-sm text-brand-ink">
                      {ACOES[a.acao] ?? a.acao}
                    </p>
                    <p className="text-xs text-ink-muted">{a.ator_email}</p>
                    {a.detalhe && (
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {a.detalhe}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                      {a.ip ? ` · ${a.ip}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </form>
  );
}
