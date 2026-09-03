"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  documentoValido,
  mascararDocumento,
  mascararTelefone,
  telefoneValido,
} from "@/lib/documentos";

export type PlanoPublico = {
  id: string;
  nome: string;
  preco_centavos: number;
  max_projects: number | null;
  descricao: string | null;
  trial_dias: number;
  trial_dias_convite: number;
};

function reais(centavos: number) {
  return (centavos / 100).toFixed(0).replace(".", ",");
}

/**
 * Checkout da landing.
 *
 * Cria a conta e a assinatura na mesma tela. O código de convite é
 * opcional e só muda o tamanho do teste — quem não tem entra do mesmo
 * jeito, porque agora quem abre a porta é o pagamento.
 */
export default function Checkout({
  planos,
  planoInicial,
  codigoInicial,
  jaLogado,
}: {
  planos: PlanoPublico[];
  planoInicial: string;
  codigoInicial: string;
  jaLogado: boolean;
}) {
  const [plano, setPlano] = useState(planoInicial || planos[0]?.id || "");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirma, setEmailConfirma] = useState("");
  const [telefone, setTelefone] = useState("");
  const [documento, setDocumento] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState(codigoInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<{
    vencimento: string | null;
    fatura: string | null;
    diasDeTeste: number;
  } | null>(null);

  const escolhido = planos.find((p) => p.id === plano) ?? planos[0];
  // O número aparece antes de a pessoa digitar o código: é o que faz o
  // campo valer a pena preencher.
  const dias = codigo.trim()
    ? (escolhido?.trial_dias_convite ?? 30)
    : (escolhido?.trial_dias ?? 7);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    // Um e-mail digitado errado aqui é grave: é o login, o comprovante e
    // o aviso de cobrança. Por isso a conferência antes de sair da tela.
    if (!jaLogado && email.trim().toLowerCase() !== emailConfirma.trim().toLowerCase()) {
      setErro("Os e-mails não são iguais. Confira os dois campos.");
      return;
    }

    if (!jaLogado && senha.length < 8) {
      setErro("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    if (!documentoValido(documento)) {
      setErro("Este CPF ou CNPJ não é válido. Confira os números.");
      return;
    }

    if (!telefoneValido(telefone)) {
      setErro("Informe um telefone válido, com DDD.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();

    try {
      if (!jaLogado) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { name: nome.trim() || null } },
        });

        if (error) {
          setErro(
            error.message.toLowerCase().includes("already")
              ? "Já existe uma conta com esse e-mail. Entre primeiro e assine pelo painel."
              : error.message
          );
          return;
        }

        if (!data.session) {
          setErro(
            "Conta criada. Confirme o e-mail que enviamos e depois volte para concluir a assinatura."
          );
          return;
        }
      }

      const resposta = await fetch("/api/assinatura/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano,
          nome,
          cpfCnpj: documento,
          telefone,
          codigo,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível concluir agora.");
        return;
      }

      // Sem router.refresh() aqui de proposito: a página é server
      // component e, agora que a organização existe, ela redireciona para
      // o painel — engolindo esta tela de confirmação antes de a pessoa
      // conseguir ler quantos dias grátis tem.
      setFeito(dados);
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-semibold text-emerald-900">
          {feito.diasDeTeste > 0
            ? `Pronto! Você tem ${feito.diasDeTeste} dias grátis.`
            : "Pronto! Sua conta está criada."}
        </h2>
        <p className="mt-2 text-sm text-emerald-900">
          A primeira cobrança vence em{" "}
          {feito.vencimento
            ? new Date(feito.vencimento).toLocaleDateString("pt-BR")
            : "breve"}
          .{" "}
          {feito.diasDeTeste > 0
            ? "Até lá o acesso é completo — e não há cobrança se você desistir antes."
            : "Seu acesso já está liberado."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Ir para o painel
          </Link>
          {feito.fatura && (
            <a
              href={feito.fatura}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-emerald-300 px-5 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              Ver a fatura
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6"
    >
      <div className="space-y-2">
        <span className="text-xs font-medium text-neutral-600">Plano</span>
        {planos.map((p) => (
          <label
            key={p.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              plano === p.id
                ? "border-brand-blue bg-blue-50/40"
                : "border-neutral-200 hover:border-neutral-300"
            }`}
          >
            <input
              type="radio"
              name="plano"
              value={p.id}
              checked={plano === p.id}
              onChange={() => setPlano(p.id)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-brand-ink">
                  {p.nome}
                </span>
                <span className="text-sm text-neutral-700">
                  R$ {reais(p.preco_centavos)}
                  <span className="text-xs text-neutral-400">/mês</span>
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                {p.max_projects === 1 ? "1 site" : `Até ${p.max_projects} sites`}
                {p.descricao ? ` — ${p.descricao}` : ""}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-600">Nome ou razão social</span>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-600">E-mail</span>
          <input
            type="email"
            required
            disabled={jaLogado}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue disabled:bg-neutral-100"
          />
        </label>

        {!jaLogado && (
          <label className="block">
            <span className="text-xs text-neutral-600">Confirme o e-mail</span>
            <input
              type="email"
              required
              value={emailConfirma}
              // Colar nos dois campos anula a conferência: quem errou ao
              // digitar vai colar o mesmo erro duas vezes.
              onPaste={(e) => e.preventDefault()}
              onChange={(e) => setEmailConfirma(e.target.value)}
              placeholder="digite de novo"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            {emailConfirma && email.trim().toLowerCase() !== emailConfirma.trim().toLowerCase() && (
              <span className="mt-1 block text-xs text-amber-700">
                Os e-mails ainda não são iguais.
              </span>
            )}
          </label>
        )}

        <label className="block">
          <span className="text-xs text-neutral-600">Telefone com DDD</span>
          <input
            required
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            placeholder="(11) 90000-0000"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-600">CPF ou CNPJ</span>
          <input
            required
            value={documento}
            onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
            placeholder="000.000.000-00"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          {documento.length > 13 && !documentoValido(documento) && (
            <span className="mt-1 block text-xs text-amber-700">
              Este número não confere. Confira antes de continuar.
            </span>
          )}
        </label>

        {!jaLogado && (
          <label className="block">
            <span className="text-xs text-neutral-600">Crie uma senha</span>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="pelo menos 8 caracteres"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
        )}

        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-600">
            Código de convite{" "}
            <span className="text-neutral-400">(opcional)</span>
          </span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="FV-0000-0000"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm tracking-wider outline-none focus:border-brand-blue"
          />
          <span className="mt-1 block text-xs text-neutral-500">
            Recebeu um convite? Insira ele aqui.
          </span>
        </label>
      </div>

      {/* O plano Agência não tem teste próprio. Anunciar "0 dias
          grátis" seria pior do que não anunciar nada. */}
      <div className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">
        {dias > 0 ? (
          <>
            <strong>{dias} dias grátis</strong>, depois R${" "}
            {reais(escolhido?.preco_centavos ?? 0)} por mês. A primeira cobrança
            só acontece no {dias + 1}º dia — cancele antes e não pagará nada.
          </>
        ) : (
          <>
            <strong>R$ {reais(escolhido?.preco_centavos ?? 0)} por mês</strong>,
            com a primeira cobrança já disponível para pagamento. Cancele quando
            quiser, sem multa.
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="btn-brand w-full rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
      >
        {enviando
          ? "Criando sua conta..."
          : dias > 0
            ? `Começar com ${dias} dias grátis`
            : "Assinar"}
      </button>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <p className="text-xs text-neutral-500">
        Pague por Pix, boleto ou cartão — a escolha é na hora de pagar. Sem
        fidelidade e sem multa. O CPF ou CNPJ é exigido pelo Asaas, nosso meio
        de pagamento; não guardamos cartão nem dado bancário.
      </p>

      <p className="text-xs text-neutral-400">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="underline hover:text-neutral-600">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline hover:text-neutral-600">
          política de privacidade
        </Link>
        .
      </p>
    </form>
  );
}
