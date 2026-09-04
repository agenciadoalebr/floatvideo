"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  documentoValido,
  mascararDocumento,
  mascararTelefone,
  telefoneValido,
} from "@/lib/documentos";

export type Plano = {
  id: string;
  nome: string;
  preco_centavos: number;
  max_projects: number | null;
  descricao: string | null;
  trial_dias: number;
};

export type AssinaturaAtual = {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  overdue_since: string | null;
  invoice_url: string | null;
} | null;

const ROTULO: Record<string, { texto: string; cor: string }> = {
  trialing: { texto: "Em teste gratuito", cor: "bg-blue-100 text-blue-800" },
  active: { texto: "Assinatura em dia", cor: "bg-emerald-100 text-emerald-800" },
  overdue: { texto: "Pagamento pendente", cor: "bg-amber-100 text-amber-900" },
  suspended: { texto: "Conta pausada", cor: "bg-red-100 text-red-800" },
  canceled: { texto: "Assinatura encerrada", cor: "bg-surface-muted text-ink-muted" },
};

// Dias de tolerância antes de pausar. O corte de verdade é no banco; aqui
// o número existe só para dizer à pessoa quanto tempo ainda resta.
const TOLERANCIA = 5;

function diasDesde(iso: string | null) {
  if (!iso) return 0;
  const passou = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(passou / 86400000));
}

/** "R$ 49" — sem centavos, que é como os planos são anunciados. */
function reais(centavos: number) {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}`;
}

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : null;
}

/**
 * Assinatura da conta.
 *
 * O CPF/CNPJ é pedido porque o Asaas exige para emitir cobrança — não é
 * dado que a gente queira ter por vontade própria, e por isso o campo
 * explica para que serve.
 */
export default function Assinatura({
  planos,
  atual,
  nomeDaConta,
}: {
  planos: Plano[];
  atual: AssinaturaAtual;
  nomeDaConta: string;
}) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState(atual?.plan ?? planos[0]?.id ?? "");
  const [nome, setNome] = useState(nomeDaConta);
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<{
    vencimento: string | null;
    fatura: string | null;
    diasDeTeste: number;
  } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [cancelada, setCancelada] = useState<string | null>(null);
  // Já nasce no primeiro plano diferente do atual: com string vazia, o
  // select mostraria a primeira opção mas o botão ficaria desabilitado.
  const [destino, setDestino] = useState(
    planos.find((p) => p.id !== atual?.plan)?.id ?? ""
  );
  const [trocandoPlano, setTrocandoPlano] = useState(false);
  const [trocado, setTrocado] = useState<{
    plano: string;
    valorCentavos: number;
  } | null>(null);

  async function trocar() {
    const alvo = planos.find((p) => p.id === destino);
    if (!alvo) return;

    if (
      !confirm(
        `Mudar para o plano ${alvo.nome}, por ${reais(alvo.preco_centavos)}/mês? O novo valor vale a partir da próxima cobrança.`
      )
    ) {
      return;
    }

    setErro("");
    setTrocandoPlano(true);
    try {
      const resposta = await fetch("/api/assinatura/trocar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: destino }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível trocar o plano agora.");
        return;
      }
      setTrocado(dados);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setTrocandoPlano(false);
    }
  }

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!documentoValido(documento)) {
      setErro("Este CPF ou CNPJ não é válido. Confira os números.");
      return;
    }
    if (!telefoneValido(telefone)) {
      setErro("Informe um telefone válido, com DDD.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/assinatura/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano: escolhido,
          nome,
          cpfCnpj: documento,
          telefone,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível assinar agora.");
        return;
      }
      setFeito(dados);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    if (
      !confirm(
        "Cancelar a assinatura? As próximas cobranças param, e você continua com acesso até o fim do período já pago."
      )
    ) {
      return;
    }

    setErro("");
    setCancelando(true);
    try {
      const resposta = await fetch("/api/assinatura/cancelar", {
        method: "POST",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível cancelar agora.");
        return;
      }
      setCancelada(dados.acessoAte ?? null);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setCancelando(false);
    }
  }

  if (cancelada !== null) {
    return (
      <div className="cartao p-5">
        <p className="text-sm font-semibold text-brand-ink">
          Assinatura cancelada
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Não haverá novas cobranças.{" "}
          {data(cancelada)
            ? `Seu acesso continua até ${data(cancelada)}, que é o fim do período já pago.`
            : "Seu acesso continua até o fim do período já pago."}
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          Mudou de ideia? Basta assinar de novo por esta mesma tela — seus
          vídeos, métricas e leads continuam aqui.
        </p>
      </div>
    );
  }

  if (feito) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-900">
          {feito.diasDeTeste > 0
            ? `Pronto! Você tem ${feito.diasDeTeste} dias grátis.`
            : "Assinatura criada."}
        </p>
        <p className="mt-2 text-xs text-emerald-900">
          {feito.diasDeTeste > 0
            ? `A primeira cobrança vence em ${data(feito.vencimento) ?? "breve"}. Até lá, acesso completo — e sem cobrança se você desistir antes.`
            : `A primeira cobrança vence em ${data(feito.vencimento) ?? "breve"}.`}
        </p>
        {feito.fatura && (
          <a
            href={feito.fatura}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brand mt-4 inline-block rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            Ver a fatura (Pix, boleto ou cartão)
          </a>
        )}
      </div>
    );
  }

  const emAndamento = atual && atual.status !== "canceled";
  const rotulo = atual ? ROTULO[atual.status] : null;
  const planoAtual = planos.find((p) => p.id === atual?.plan) ?? null;
  const outros = planos.filter((p) => p.id !== atual?.plan);
  // Em teste, a "próxima cobrança" é a primeira: a data do fim do teste.
  const proximaCobranca =
    data(atual?.current_period_end ?? null) ??
    data(atual?.trial_ends_at ?? null);

  return (
    <div className="cartao space-y-4 p-5">
      <div>
        {emAndamento && rotulo && (
          <p className="mt-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${rotulo.cor}`}
            >
              {rotulo.texto}
            </span>
          </p>
        )}
        {atual?.status === "trialing" && atual.trial_ends_at && (
          <p className="mt-2 text-xs text-ink-muted">
            Seu teste vai até <strong>{data(atual.trial_ends_at)}</strong>. A
            primeira cobrança acontece nessa data.
          </p>
        )}
        {atual?.status === "active" && atual.current_period_end && (
          <p className="mt-2 text-xs text-ink-muted">
            Próxima cobrança prevista para{" "}
            <strong>{data(atual.current_period_end)}</strong>.
          </p>
        )}
        {atual?.status === "overdue" && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-amber-900">
              Há uma cobrança em aberto. Você tem{" "}
              <strong>
                {Math.max(0, TOLERANCIA - diasDesde(atual.overdue_since))} dia(s)
              </strong>{" "}
              para pagar antes de o vídeo parar de aparecer no seu site. Assim
              que o pagamento for confirmado, tudo volta sozinho — nada foi
              apagado.
            </p>
            {atual.invoice_url && (
              <a
                href={atual.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brand inline-block rounded-lg px-4 py-2.5 text-sm font-medium"
              >
                Pagar agora
              </a>
            )}
          </div>
        )}
        {atual?.status === "suspended" && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-red-800">
              O vídeo parou de aparecer nos seus sites porque a cobrança está em
              aberto há mais de {TOLERANCIA} dias. Seus vídeos, métricas e leads
              continuam aqui: assim que o pagamento cair, tudo volta a funcionar
              sem você precisar mexer em nada.
            </p>
            {atual.invoice_url && (
              <a
                href={atual.invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brand inline-block rounded-lg px-4 py-2.5 text-sm font-medium"
              >
                Pagar e reativar
              </a>
            )}
          </div>
        )}
      </div>

      {!emAndamento && (
        <form onSubmit={assinar} className="space-y-3">
          <label className="block">
            <span className="text-xs text-ink-muted">Plano</span>
            <select
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm"
            >
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — R$ {(p.preco_centavos / 100).toFixed(0)}/mês
                  {p.trial_dias > 0 ? ` (${p.trial_dias} dias grátis)` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-ink-muted">Nome ou razão social</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
          </label>

          <label className="block">
            <span className="text-xs text-ink-muted">Telefone com DDD</span>
            <input
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              inputMode="tel"
              placeholder="(11) 90000-0000"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
          </label>

          <label className="block">
            <span className="text-xs text-ink-muted">CPF ou CNPJ</span>
            <input
              value={documento}
              onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
              placeholder="000.000.000-00"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Exigido para emitir a cobrança. Fica no Asaas, nosso meio de
              pagamento — não guardamos cartão nem dado bancário.
            </span>
          </label>

          <button
            type="submit"
            disabled={enviando || !documento.trim() || !telefone.trim()}
            className="btn-brand w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {enviando ? "Criando..." : "Assinar"}
          </button>
          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <p className="text-xs text-ink-faint">
            Pague por Pix, boleto ou cartão — a escolha é na hora de pagar.
            Cancele quando quiser, sem multa.
          </p>
        </form>
      )}

      {emAndamento && (
        <div className="space-y-4 border-t border-outline-soft pt-4">
          <div>
            <p className="text-sm font-medium text-brand-ink">
              Seu plano: {planoAtual?.nome ?? "—"}
              {planoAtual && ` — ${reais(planoAtual.preco_centavos)}/mês`}
            </p>
            {trocado ? (
              <p className="mt-2 rounded-lg bg-surface-soft px-3 py-2 text-xs text-ink-muted">
                Plano trocado para <strong>{trocado.plano}</strong>. A partir da
                próxima cobrança o valor passa a ser{" "}
                <strong>{reais(trocado.valorCentavos)}/mês</strong>. O limite de
                sites já vale agora.
              </p>
            ) : (
              outros.length > 0 && (
                <div className="mt-3 space-y-2">
                  <label className="block">
                    <span className="text-xs text-ink-muted">Mudar para</span>
                    <select
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm"
                    >
                      {outros.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} — {reais(p.preco_centavos)}/mês
                          {p.max_projects
                            ? ` · ${p.max_projects} ${p.max_projects === 1 ? "site" : "sites"}`
                            : " · sites ilimitados"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={trocar}
                    disabled={trocandoPlano || !destino}
                    className="w-full rounded-lg border border-outline-soft px-4 py-2.5 text-sm font-medium text-ink-muted hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
                  >
                    {trocandoPlano ? "Trocando..." : "Trocar de plano"}
                  </button>
                  {/* Dito antes de clicar, e não depois: o Asaas não faz
                      rateio, e descobrir isso na fatura seria uma surpresa
                      ruim. */}
                  <p className="text-xs text-ink-faint">
                    O novo valor vale a partir da próxima cobrança
                    {proximaCobranca ? ` (${proximaCobranca})` : ""} — e da
                    fatura em aberto, se houver. Não há cobrança proporcional
                    pelos dias que faltam do mês atual, nem devolução.
                  </p>
                </div>
              )
            )}
          </div>

          <div className="border-t border-outline-soft pt-3">
            <button
              type="button"
              onClick={cancelar}
              disabled={cancelando}
              className="text-xs font-medium text-red-600 underline hover:text-red-700 disabled:opacity-50"
            >
              {cancelando ? "Cancelando..." : "Cancelar assinatura"}
            </button>
            <p className="mt-1 text-xs text-ink-faint">
              Sem multa e sem fidelidade. O acesso continua até o fim do
              período já pago.
            </p>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
