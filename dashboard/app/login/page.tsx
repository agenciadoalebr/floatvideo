"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-floatvideo.webp" alt="FloatVideo" className="h-10 w-auto" />
          <p className="text-sm text-neutral-500">Painel interno — Agência do Alê</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="voce@agenciadoale.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <input
            type="password"
            required
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-brand w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="flex justify-between text-xs text-neutral-400">
          <Link href="/forgot-password" className="hover:text-neutral-600">
            Esqueci minha senha
          </Link>
          <Link href="/signup" className="hover:text-neutral-600">
            Tenho um convite
          </Link>
        </div>
      </div>
    </div>
  );
}
