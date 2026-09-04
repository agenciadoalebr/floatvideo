"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeDomain, isValidDomain } from "@/lib/domain";

/**
 * Cadastro de site numa janela, e não num formulário sempre aberto.
 *
 * O formulário fixo ocupava espaço em toda visita para uma ação que a
 * pessoa faz uma vez por site — e, no plano de um site, exatamente uma
 * vez na vida.
 */
export default function NovoSiteModal({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [dominio, setDominio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const primeiroCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;

    // Foco no primeiro campo: quem abriu a janela veio digitar.
    primeiroCampo.current?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    // Trava a rolagem do fundo — sem isso a página atrás rola junto e a
    // janela parece solta.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    // O domínio não é opcional: é ele que limita onde o widget pode
    // rodar. Sem domínio, o widget funcionaria em qualquer site que
    // tivesse a chave de incorporação.
    const limpo = normalizeDomain(dominio);
    if (!isValidDomain(limpo)) {
      setErro("Informe um domínio válido, como minhaloja.com.br");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErro("Sessão expirada, faça login de novo.");
      setSalvando(false);
      return;
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setErro("Não foi possível localizar sua conta.");
      setSalvando(false);
      return;
    }

    const { data: projeto, error } = await supabase
      .from("projects")
      .insert({
        organization_id: membership.organization_id,
        name: nome.trim(),
        domain: limpo,
      })
      .select("id")
      .single();

    setSalvando(false);

    if (error || !projeto) {
      setErro(error?.message ?? "Não foi possível criar o site agora.");
      return;
    }

    router.push(`/dashboard/projects/${projeto.id}`);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-novo-site"
    >
      <div className="cartao-flutuante w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="titulo-novo-site"
              className="text-lg font-semibold text-brand-ink"
            >
              Adicionar novo site
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              O endereço exato onde o vídeo vai aparecer.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-md px-2 py-1 text-ink-faint hover:bg-surface-soft"
          >
            ✕
          </button>
        </div>

        <form onSubmit={criar} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">
              Nome do site
            </span>
            <input
              ref={primeiroCampo}
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Loja Principal"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Só para você se achar no painel.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-muted">
              Domínio do site
            </span>
            <input
              required
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="Ex.: minhaloja.com.br"
              className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Sem http:// e sem www. O vídeo só roda neste endereço — é o
              que impede alguém de copiar seu código e usar em outro site.
            </span>
          </label>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-lg border border-outline-soft px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-soft"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="btn-brand rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {salvando ? "Criando..." : "Criar site"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
