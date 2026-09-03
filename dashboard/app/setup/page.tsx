"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetupPage() {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("needs_initial_setup").then(({ data }) => {
      setNeedsSetup(Boolean(data));
      setChecking(false);
    });
  }, []);

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
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      setError(
        "Conta criada, mas não entramos automaticamente — confirme se a confirmação de e-mail está desativada no Supabase, ou verifique seu e-mail."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <p className="text-sm text-neutral-400">Carregando...</p>
      </div>
    );
  }

  if (!needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-sm text-neutral-600">
            Este sistema já tem um administrador configurado.
          </p>
          <a href="/login" className="text-sm font-medium text-neutral-900 underline">
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Configuração inicial
          </h1>
          <p className="text-sm text-neutral-500">
            Crie sua conta de administrador. Você poderá convidar o resto da equipe
            depois, dentro do painel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="alessandro@agenciadoale.com.br"
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
            {loading ? "Criando..." : "Criar conta de administrador"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </div>
  );
}
