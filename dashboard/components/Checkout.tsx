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
  const [verSenha, setVerSenha] = useState(false);
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
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start"
    >
      {/* Passo 1: o plano. Fica à esquerda e maior porque é a decisão
          que a pessoa veio tomar — os campos são consequência dela. */}
      <div className="space-y-5">
        <div>
          <p className="rotulo-metrica">Passo 1 de 2</p>
          <h2 className="mt-1 text-xl font-semibold text-brand-ink">
            Escolha o plano
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Os dois têm vídeos e visualizações ilimitados. A diferença é
            quantos sites você pode atender.
          </p>
        </div>

        <div className="space-y-3">
          {planos.map((p) => {
            const on = plano === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlano(p.id)}
                className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition ${
                  on
                    ? "border-brand-blue bg-surface-soft"
                    : "border-outline-soft bg-surface-card hover:border-outline"
                }`}
              >
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] text-white ${
                    on ? "border-brand-blue bg-brand-blue" : "border-outline"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-base font-semibold text-brand-ink">
                      {p.nome}
                    </span>
                    <span className="text-sm text-ink-muted">
                      <strong className="text-xl text-brand-ink">
                        R$ {reais(p.preco_centavos)}
                      </strong>
                      /mês
                    </span>
                  </span>
                  {p.descricao && (
                    <span className="mt-1 block text-sm text-ink-muted">
                      {p.descricao}
                    </span>
                  )}
                  <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
                    <span>
                      {p.max_projects === 1
                        ? "1 site"
                        : `Até ${p.max_projects} sites`}
                    </span>
                    <span>Vídeos ilimitados</span>
                    <span>Visualizações ilimitadas</span>
                    {p.trial_dias > 0 && (
                      <span className="font-medium text-brand-blue">
                        {p.trial_dias} dias grátis
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="cartao p-5">
          <h3 className="text-sm font-semibold text-brand-ink">
            O que você vai configurar depois
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {[
              "Enviar um vídeo, do celular ou do YouTube",
              "Escolher em quais páginas ele aparece",
              "Definir o botão: WhatsApp, formulário ou comprar",
              "Colar uma linha no site, ou instalar pelo Tag Manager",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-blue">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Passo 2: os dados. */}
      <div className="cartao p-6">
        <p className="rotulo-metrica">Passo 2 de 2</p>
        <h2 className="mt-1 text-xl font-semibold text-brand-ink">
          Dados da sua conta
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Leva menos de um minuto.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">
              Nome ou razão social
            </span>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-muted">E-mail</span>
            <input
              type="email"
              required
              disabled={jaLogado}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue disabled:bg-surface-soft"
            />
          </label>

          {!jaLogado && (
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">
                Confirme o e-mail
              </span>
              <input
                type="email"
                required
                value={emailConfirma}
                // Colar nos dois campos anula a conferência: quem errou ao
                // digitar colaria o mesmo erro.
                onPaste={(e) => e.preventDefault()}
                onChange={(e) => setEmailConfirma(e.target.value)}
                placeholder="digite de novo"
                className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              />
              {emailConfirma &&
                email.trim().toLowerCase() !==
                  emailConfirma.trim().toLowerCase() && (
                  <span className="mt-1 block text-xs text-amber-700">
                    Os e-mails ainda não são iguais.
                  </span>
                )}
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">
                WhatsApp com DDD
              </span>
              <input
                required
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                placeholder="(11) 90000-0000"
                className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink-muted">
                CPF ou CNPJ
              </span>
              <input
                required
                value={documento}
                onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
                placeholder="000.000.000-00"
                className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
              />
              {documento.length > 13 && !documentoValido(documento) && (
                <span className="mt-1 block text-xs text-amber-700">
                  Este número não confere.
                </span>
              )}
            </label>
          </div>

          {!jaLogado && (
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">
                Crie uma senha
              </span>
              <span className="relative mt-1 block">
                <input
                  type={verSenha ? "text" : "password"}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="pelo menos 8 caracteres"
                  className="w-full rounded-lg border border-outline-soft px-3 py-2.5 pr-16 text-sm outline-none focus:border-brand-blue"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-ink-faint hover:text-brand-blue"
                >
                  {verSenha ? "ocultar" : "ver"}
                </button>
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-ink-muted">
              Código de convite{" "}
              <span className="text-ink-faint">(opcional)</span>
            </span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="FV-0000-0000"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 font-mono text-sm tracking-wider outline-none focus:border-brand-blue"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Recebeu um convite? Insira ele aqui.
            </span>
          </label>
        </div>

        <div className="mt-5 rounded-xl bg-surface-soft p-4 text-sm text-ink-muted">
          {dias > 0 ? (
            <>
              <strong className="text-brand-ink">{dias} dias grátis</strong>,
              depois R$ {reais(escolhido?.preco_centavos ?? 0)} por mês. A
              primeira cobrança só acontece no {dias + 1}º dia — cancele antes
              e não pagará nada.
            </>
          ) : (
            <>
              <strong className="text-brand-ink">
                R$ {reais(escolhido?.preco_centavos ?? 0)} por mês
              </strong>
              , com a primeira cobrança já disponível para pagamento. Cancele
              quando quiser, sem multa.
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="btn-brand mt-4 w-full rounded-lg px-4 py-3.5 text-sm font-medium disabled:opacity-50"
        >
          {enviando
            ? "Criando sua conta..."
            : dias > 0
              ? `Criar conta e começar os ${dias} dias grátis`
              : "Criar conta e assinar"}
        </button>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <p className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-faint">
          <span>✓ Nada é cobrado hoje</span>
          <span>✓ Sem fidelidade</span>
          <span>✓ Cancele pelo painel</span>
        </p>

        <p className="mt-4 border-t border-outline-soft pt-4 text-xs text-ink-faint">
          Pague por Pix, boleto ou cartão — a escolha é na hora de pagar. O
          CPF ou CNPJ é exigido pelo Asaas, nosso meio de pagamento; não
          guardamos cartão nem dado bancário.
        </p>

        <p className="mt-3 text-xs text-ink-faint">
          Ao criar a conta você concorda com os{" "}
          <Link href="/termos" className="underline hover:text-brand-blue">
            termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline hover:text-brand-blue">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
