"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CODIGO_GUARDADO } from "@/components/BotaoGoogle";

/**
 * Falta o convite.
 *
 * Quem entra pelo Google chega aqui autenticado mas sem organização: o
 * Google diz quem a pessoa é, não que ela foi convidada. É esta tela que
 * cobra o código e cria a conta de verdade.
 */
export default function CompletarCadastroPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    // Código digitado antes de sair para o Google: aproveita, e some da
    // sessão para não reaparecer numa próxima visita.
    try {
      const guardado = sessionStorage.getItem(CODIGO_GUARDADO);
      if (guardado) {
        setCodigo(guardado);
        sessionStorage.removeItem(CODIGO_GUARDADO);
      }
    } catch {
      // Armazenamento bloqueado: a pessoa digita o código.
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? "");
    });
  }, [router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("usar_codigo_de_convite", {
      p_code: codigo.trim().toUpperCase(),
    });

    setEnviando(false);

    if (error) {
      setErro(
        error.message.includes("invalido")
          ? "Este código de convite não existe ou já foi utilizado."
          : "Informe o código de convite que você recebeu."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-floatvideo.webp"
            alt="FloatVideo"
            className="h-10 w-auto"
          />
          <h1 className="text-xl font-semibold text-neutral-900">
            Falta o código de convite
          </h1>
          <p className="text-sm text-neutral-500">
            Entramos com {email || "sua conta do Google"}. O FloatVideo ainda é
            por convite, então precisamos do código que você recebeu.
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-3">
          <input
            required
            placeholder="FV-0000-0000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center font-mono text-sm tracking-wider outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={enviando}
            className="btn-brand w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {enviando ? "Confirmando..." : "Criar minha conta"}
          </button>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </form>

        <p className="text-center text-xs text-neutral-400">
          Não tem código? Fale com a gente em{" "}
          <a
            href="mailto:contato@floatvideo.com.br"
            className="underline hover:text-neutral-600"
          >
            contato@floatvideo.com.br
          </a>
          .
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

        <div className="text-center">
          <button
            type="button"
            onClick={sair}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Entrar com outra conta
          </button>
        </div>
      </div>
    </div>
  );
}
