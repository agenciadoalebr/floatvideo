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

    const { data: hasInvite } = await supabase.rpc("has_pending_invite", {
      p_email: email,
    });

    if (!hasInvite) {
      setLoading(false);
      setError(
        "Não encontramos um convite pendente para este e-mail. Peça ao administrador para te convidar no painel."
      );
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
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
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Aceitar convite</h1>
          <p className="text-sm text-neutral-500">
            Crie sua senha para acessar o painel da Agência do Alê.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="seu@agenciadoale.com.br"
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

        <div className="text-center text-xs text-neutral-400">
          <Link href="/login" className="hover:text-neutral-600">
            Já tenho conta — fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
