"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Menu da conta, no canto superior direito. Junta o que é da pessoa
 * (senha, plano, sair) num lugar só — antes o "Sair" ficava solto no
 * cabeçalho e não havia onde trocar a senha sem passar pelo "esqueci".
 */
export default function AccountMenu({
  email,
  ehAdminDaPlataforma,
  podeGerenciarEquipe,
  ehDonoDaConta,
}: {
  email: string;
  ehAdminDaPlataforma: boolean;
  /** Dono ou administrador da própria conta: convida a equipe dele. */
  podeGerenciarEquipe: boolean;
  /** Quem foi convidado para a conta de outra pessoa não vê o plano:
      ele não é de quem entrou, e não há o que essa pessoa decida ali. */
  ehDonoDaConta: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Clique fora e Esc fecham. Sem isso o menu fica preso aberto quando a
  // pessoa desiste e clica em qualquer outro canto da tela.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const inicial = (email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-3 text-sm text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
          {inicial}
        </span>
        <span className="hidden max-w-[180px] truncate sm:block">{email}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        >
          <path d="M5.5 7.5 10 12l4.5-4.5z" />
        </svg>
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="truncate text-xs text-neutral-500">Conectado como</p>
            <p className="truncate text-sm font-medium text-brand-ink">{email}</p>
          </div>

          <Link
            href="/dashboard/conta"
            onClick={() => setAberto(false)}
            className="block px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Alterar senha
          </Link>
          {ehDonoDaConta && (
            <Link
              href="/dashboard/conta#plano"
              onClick={() => setAberto(false)}
              className="block px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Meu plano
            </Link>
          )}
          {podeGerenciarEquipe && (
            <Link
              href="/dashboard/team"
              onClick={() => setAberto(false)}
              className="block px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Minha equipe
            </Link>
          )}
          {ehAdminDaPlataforma && (
            <Link
              href="/dashboard/convites"
              onClick={() => setAberto(false)}
              className="block px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Convites
            </Link>
          )}

          <button
            type="button"
            onClick={sair}
            className="w-full border-t border-neutral-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
