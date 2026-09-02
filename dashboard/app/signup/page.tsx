"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
  const [codigo, setCodigo] = useState(searchParams.get("codigo") ?? "");
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

    // Duas portas de entrada: convite por e-mail (alguém já te adicionou
    // a uma conta existente) e código de convite (conta nova, sua).
    const { data: temConvitePorEmail } = await supabase.rpc("has_pending_invite", {
      p_email: email,
    });

    const codigoLimpo = codigo.trim().toUpperCase();

    if (!temConvitePorEmail) {
      if (!codigoLimpo) {
        setLoading(false);
        setError(
          "Informe o código de convite que você recebeu, ou peça a quem administra a conta para te convidar por e-mail."
        );
        return;
      }

      const { data: codigoValido } = await supabase.rpc("invite_code_disponivel", {
        p_code: codigoLimpo,
      });

      // Conferência só para dar uma mensagem clara aqui. Quem realmente
      // decide, e consome o código, é o banco na criação da conta.
      if (!codigoValido) {
        setLoading(false);
        setError("Este código de convite não existe ou já foi utilizado.");
        return;
      }
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          invite_code: temConvitePorEmail ? null : codigoLimpo,
          name: nome.trim() || null,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("codigo de convite")
          ? "Este código de convite não existe ou já foi utilizado."
          : signUpError.message
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
          <h1 className="text-xl font-semibold text-neutral-900">Criar sua conta</h1>
          <p className="text-sm text-neutral-500">
            Use o código de convite que você recebeu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Código de convite (FV-0000-0000)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center font-mono text-sm tracking-wider outline-none focus:border-brand-blue"
          />
          <input
            placeholder="Nome da sua empresa (opcional)"
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

        <p className="text-center text-xs text-neutral-400">
          Foi convidado por e-mail para uma conta que já existe? Deixe o código
          em branco — reconhecemos pelo seu e-mail.
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
