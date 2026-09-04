"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Onde guardamos o código digitado antes de sair para o Google. */
export const CODIGO_GUARDADO = "floatvideo:codigo-de-convite";

/**
 * Entrar com o Google.
 *
 * Serve para entrar e para cadastrar: quem já tem conta com o mesmo
 * e-mail cai na conta que já existe, e quem é novo volta sem
 * organização e é levado à tela do código de convite.
 *
 * Quando a pessoa já digitou o código, ele vai guardado na sessão do
 * navegador — voltar do Google e ter de digitar tudo de novo é o tipo de
 * detalhe que faz desistir no meio.
 */
export default function BotaoGoogle({
  texto = "Entrar com o Google",
  codigo,
}: {
  texto?: string;
  codigo?: string;
}) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar() {
    setErro("");
    setIndo(true);

    if (codigo?.trim()) {
      try {
        sessionStorage.setItem(CODIGO_GUARDADO, codigo.trim().toUpperCase());
      } catch {
        // Navegador com armazenamento bloqueado: só perde o atalho, o
        // código continua podendo ser digitado na volta.
      }
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setIndo(false);
      setErro("Não foi possível abrir o Google agora. Tente de novo.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={entrar}
        disabled={indo}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline bg-surface-card px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-soft disabled:opacity-50"
      >
        <svg viewBox="0 0 18 18" aria-hidden="true" className="h-4 w-4">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {indo ? "Abrindo o Google..." : texto}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
