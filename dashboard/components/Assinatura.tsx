"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  canceled: { texto: "Assinatura encerrada", cor: "bg-neutral-200 text-neutral-700" },
};

// Dias de tolerância antes de pausar. O corte de verdade é no banco; aqui
// o número existe só para dizer à pessoa quanto tempo ainda resta.
const TOLERANCIA = 5;

function diasDesde(iso: string | null) {
  if (!iso) return 0;
  const passou = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(passou / 86400000));
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
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<{
    vencimento: string | null;
    fatura: string | null;
    diasDeTeste: number;
  } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [cancelada, setCancelada] = useState<string | null>(null);

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const resposta = await fetch("/api/assinatura/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: escolhido, nome, cpfCnpj: documento }),
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
      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-5">
        <p className="text-sm font-semibold text-neutral-700">
          Assinatura cancelada
        </p>
        <p className="mt-2 text-xs text-neutral-600">
          Não haverá novas cobranças.{" "}
          {data(cancelada)
            ? `Seu acesso continua até ${data(cancelada)}, que é o fim do período já pago.`
            : "Seu acesso continua até o fim do período já pago."}
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Mudou de ideia? Basta assinar de novo por esta mesma tela — seus
          vídeos, métricas e leads continuam aqui.
        </p>
      </div>
    );
  }

  if (feito) {
    return (
      <div className="max-w-md rounded-lg border border-emerald-200 bg-emerald-50 p-5">
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
            className="btn-brand mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Ver a fatura (Pix, boleto ou cartão)
          </a>
        )}
      </div>
    );
  }

  const emAndamento = atual && atual.status !== "canceled";
  const rotulo = atual ? ROTULO[atual.status] : null;

  return (
    <div className="max-w-md space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-700">Assinatura</h2>
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
          <p className="mt-2 text-xs text-neutral-600">
            Seu teste vai até <strong>{data(atual.trial_ends_at)}</strong>. A
            primeira cobrança acontece nessa data.
          </p>
        )}
        {atual?.status === "active" && atual.current_period_end && (
          <p className="mt-2 text-xs text-neutral-600">
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
                className="btn-brand inline-block rounded-md px-4 py-2 text-sm font-medium"
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
                className="btn-brand inline-block rounded-md px-4 py-2 text-sm font-medium"
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
            <span className="text-xs text-neutral-600">Plano</span>
            <select
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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
            <span className="text-xs text-neutral-600">Nome ou razão social</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>

          <label className="block">
            <span className="text-xs text-neutral-600">CPF ou CNPJ</span>
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              inputMode="numeric"
              placeholder="000.000.000-00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Exigido para emitir a cobrança. Fica no Asaas, nosso meio de
              pagamento — não guardamos cartão nem dado bancário.
            </span>
          </label>

          <button
            type="submit"
            disabled={enviando || !documento.trim()}
            className="btn-brand w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {enviando ? "Criando..." : "Assinar"}
          </button>
          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <p className="text-xs text-neutral-500">
            Pague por Pix, boleto ou cartão — a escolha é na hora de pagar.
            Cancele quando quiser, sem multa.
          </p>
        </form>
      )}

      {emAndamento && (
        <div className="space-y-3 border-t border-neutral-100 pt-3">
          <p className="text-xs text-neutral-500">
            Para trocar de plano, fale com a gente em{" "}
            <a
              href="mailto:contato@floatvideo.com.br"
              className="font-medium text-brand-blue hover:underline"
            >
              contato@floatvideo.com.br
            </a>
            .
          </p>
          <div>
            <button
              type="button"
              onClick={cancelar}
              disabled={cancelando}
              className="text-xs font-medium text-red-600 underline hover:text-red-700 disabled:opacity-50"
            >
              {cancelando ? "Cancelando..." : "Cancelar assinatura"}
            </button>
            <p className="mt-1 text-xs text-neutral-500">
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
