"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OrgRole } from "@/lib/types";

export default function InviteForm({
  organizationId,
  podeEscolherPapel = false,
}: {
  organizationId: string;
  /** Só a administração da plataforma escolhe o papel de quem entra. */
  podeEscolherPapel?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviadoPara, setEnviadoPara] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setEnviadoPara("");
    setInviteLink("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // O e-mail sai do banco: um gatilho na tabela dispara a mensagem no
    // mesmo instante em que o convite nasce. Assim nao existe convite
    // gravado sem aviso enviado, nem aviso enviado sem convite gravado.
    const destinatario = email.toLowerCase().trim();

    const { data: criado, error: insertError } = await supabase
      .from("invites")
      .insert({
        organization_id: organizationId,
        email: destinatario,
        role,
        invited_by: user?.id,
      })
      .select("token")
      .single();

    setLoading(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Já existe um convite pendente para este e-mail."
          : insertError.message
      );
      return;
    }

    setEnviadoPara(destinatario);
    setInviteLink(`${window.location.origin}/convite/${criado.token}`);
    setEmail("");
    router.refresh();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
  }

  return (
    <div className="cartao p-5">
      <h2 className="text-sm font-semibold text-brand-ink">Convidar alguém</h2>
      {!podeEscolherPapel && (
        <p className="mt-1 text-xs text-ink-faint">
          Quem entrar por aqui vira <strong>editor</strong>: mexe nos vídeos e
          nos widgets, mas não convida nem remove ninguém.
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-muted">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colega@agenciadoale.com.br"
            className="mt-1 w-full rounded-lg border border-outline-soft px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        {podeEscolherPapel && (
          <div>
            <label className="block text-xs font-medium text-ink-muted">Papel</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="mt-1 rounded-lg border border-outline-soft px-3 py-2 text-sm"
            >
              <option value="editor">Editor</option>
              <option value="admin">Administrador</option>
              <option value="owner">Dono</option>
            </select>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Convidando..." : "Convidar"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {inviteLink && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="mb-2">
            Convite enviado por e-mail para <strong>{enviadoPara}</strong>. Ao
            abrir o link, a pessoa escolhe a própria senha e já entra na conta.
            Se o e-mail não chegar, mande este link por outro caminho:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1">
              {inviteLink}
            </code>
            <button
              onClick={copyLink}
              className="btn-brand shrink-0 rounded px-2 py-1"
            >
              Copiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
