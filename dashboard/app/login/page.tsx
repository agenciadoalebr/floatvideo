"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BotaoGoogle from "@/components/BotaoGoogle";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("erro") === "google"
      ? "A entrada pelo Google foi cancelada. Tente de novo ou use e-mail e senha."
      : ""
  );
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("E-mail ou senha incorretos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-soft bg-surface-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-floatvideo.webp"
              alt="FloatVideo"
              className="h-8 w-auto"
            />
          </Link>
          <p className="text-sm text-ink-muted">
            Ainda não tem conta?{" "}
            <Link
              href="/assinar"
              className="font-medium text-brand-blue hover:underline"
            >
              Comece grátis
            </Link>
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:py-20">
        <div>
          <div className="cartao p-7">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
              Bem-vindo de volta
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Entre para gerenciar seus vídeos, o balão e os contatos que ele
              gerou.
            </p>

            <div className="mt-6">
              <BotaoGoogle />
            </div>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-outline-soft" />
              <span className="text-xs text-ink-faint">ou com seu e-mail</span>
              <span className="h-px flex-1 bg-outline-soft" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-ink-muted">
                  E-mail
                </span>
                <input
                  type="email"
                  required
                  placeholder="voce@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
                />
              </label>

              <label className="block">
                <span className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-ink-muted">
                    Senha
                  </span>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-brand-blue hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </span>
                <span className="relative mt-1 block">
                  <input
                    type={verSenha ? "text" : "password"}
                    required
                    placeholder="sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-outline-soft px-3 py-2.5 pr-16 text-sm outline-none focus:border-brand-blue"
                  />
                  {/* Ver a senha resolve o erro mais comum de digitação —
                      e é o que dispensa uma segunda tentativa. */}
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-ink-faint hover:text-brand-blue"
                  >
                    {verSenha ? "ocultar" : "ver"}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-brand w-full rounded-lg px-3 py-3 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-ink-faint">
            Foi convidado para a conta de alguém?{" "}
            <Link href="/signup" className="text-brand-blue hover:underline">
              Entrar na equipe
            </Link>
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              ["Sem fidelidade", "cancele quando quiser"],
              ["Uma linha", "para instalar"],
              ["Suporte", "no WhatsApp"],
            ].map(([titulo, nota]) => (
              <div key={titulo} className="rounded-xl bg-surface-soft p-3">
                <p className="text-xs font-medium text-brand-ink">{titulo}</p>
                <p className="text-[11px] text-ink-faint">{nota}</p>
              </div>
            ))}
          </div>
        </div>

        {/* A ilustração do produto no lugar do depoimento: o balão é o que
            a pessoa vem cuidar aqui, e não precisa de elogio de gente que
            não existe para se explicar. */}
        <div className="hidden lg:block">
          <p className="rotulo-metrica">O que você vem cuidar aqui</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-ink">
            Seu vídeo trabalhando no canto da página
          </h2>

          <div className="cartao mt-6 p-1">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="flex gap-1.5">
                {["bg-red-300", "bg-amber-300", "bg-emerald-300"].map((c) => (
                  <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
                ))}
              </span>
              <span className="mx-auto rounded-md bg-surface-soft px-3 py-1 text-[11px] text-ink-faint">
                sualoja.com.br/produto
              </span>
            </div>
            <div className="relative h-[320px] rounded-xl bg-surface-soft p-6">
              <div className="space-y-3">
                <div className="h-3 w-28 rounded bg-surface-strong" />
                <div className="h-3 w-full rounded bg-surface-strong" />
                <div className="h-3 w-4/5 rounded bg-surface-strong" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="h-24 rounded-lg bg-surface-strong" />
                  <div className="h-24 rounded-lg bg-surface-strong" />
                </div>
              </div>
              <div className="absolute bottom-5 right-5">
                <div className="ml-auto h-28 w-16 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet shadow-[0_8px_24px_-4px_rgba(0,127,255,0.4)]" />
                <div className="mt-2 flex w-[190px] items-center gap-2 rounded-2xl bg-white/85 p-2 shadow-lg backdrop-blur">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25d366]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
                      <path d="M12.05 21.8h-.01c-1.77 0-3.51-.48-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.9-9.88 9.9" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold leading-tight text-neutral-900">
                      Quer saber mais?
                    </span>
                    <span className="block text-[11px] leading-tight text-neutral-600">
                      Chame pelo WhatsApp
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 max-w-md text-sm text-ink-muted">
            No painel você troca o vídeo, escolhe em quais páginas ele
            aparece, muda o botão de ação e acompanha quem chegou por ele.
          </p>
        </div>
      </main>

      <footer className="border-t border-outline-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-faint sm:flex-row">
          <span>© {new Date().getFullYear()} FloatVideo — Agência do Alê</span>
          <span className="flex gap-4">
            <Link href="/termos" className="hover:text-brand-blue">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-brand-blue">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
