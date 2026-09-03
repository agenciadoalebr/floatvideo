"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Redefinir senha
          </h1>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Se esse e-mail estiver cadastrado, enviamos um link pra redefinir a senha.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="voce@agenciadoale.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-brand w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {status === "sending" ? "Enviando..." : "Enviar link de redefinição"}
            </button>
            {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
          </form>
        )}

        <div className="text-center text-xs text-neutral-400">
          <Link href="/login" className="hover:text-neutral-600">
            Voltar pro login
          </Link>
        </div>
      </div>
    </div>
  );
}
