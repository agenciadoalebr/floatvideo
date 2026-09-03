"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BotaoGoogle from "@/components/BotaoGoogle";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Esta tela é só para quem foi convidado por e-mail para a conta de
    // outra pessoa — gente de equipe, que não paga nada. Quem tem código
    // de convite passa pela tela de compra: lá o código vale 30 dias de
    // teste, e é o pagamento que abre a conta.
    const { data: temConvitePorEmail } = await supabase.rpc("has_pending_invite", {
      p_email: email,
    });

    if (!temConvitePorEmail) {
      setLoading(false);
      setError(
        "Não encontramos um convite para este e-mail. Se você tem um código de convite, use a tela de assinatura; se alguém te adicionou a uma conta, confira se o e-mail é o mesmo do convite."
      );
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: nome.trim() || null },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message
      );
      return;
    }

    if (!data.session) {
      setError("Conta criada. Verifique seu e-mail para confirmar o acesso.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-floatvideo.webp" alt="FloatVideo" className="h-10 w-auto" />
          <h1 className="text-xl font-semibold text-neutral-900">Entrar na equipe</h1>
          <p className="text-sm text-neutral-500">
            Use o mesmo e-mail em que você recebeu o convite.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Seu nome (opcional)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <input
            type="email"
            required
            placeholder="seu@email.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <input
            type="password"
            required
            placeholder="Crie uma senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <input
            type="password"
            required
            placeholder="Confirme a senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-brand w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar minha conta"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs text-neutral-400">ou</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* O código digitado vai junto: quem já preencheu o campo não
            precisa digitar de novo depois de voltar do Google. */}
        <BotaoGoogle texto="Entrar com o Google" />

        <p className="text-center text-xs text-neutral-400">
          Tem um código de convite e quer abrir a sua própria conta?{" "}
          <Link href="/assinar" className="underline hover:text-neutral-600">
            É por aqui
          </Link>{" "}
          — o código vale 30 dias grátis.
        </p>

        <p className="text-center text-xs text-neutral-400">
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

        <div className="text-center text-xs text-neutral-400">
          <Link href="/login" className="hover:text-neutral-600">
            Já tenho conta — fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
