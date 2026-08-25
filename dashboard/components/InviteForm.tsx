"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OrgRole } from "@/lib/types";

export default function InviteForm({ organizationId }: { organizationId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInviteLink("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("invites").insert({
      organization_id: organizationId,
      email: email.toLowerCase().trim(),
      role,
      invited_by: user?.id,
    });

    setLoading(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Já existe um convite pendente para este e-mail."
          : insertError.message
      );
      return;
    }

    const link = `${window.location.origin}/signup?email=${encodeURIComponent(email)}`;
    setInviteLink(link);
    setEmail("");
    router.refresh();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-700">Convidar alguém</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colega@agenciadoale.com.br"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600">Papel</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRole)}
            className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="editor">Editor</option>
            <option value="admin">Administrador</option>
            <option value="owner">Dono</option>
          </select>
        </div>
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
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="mb-2">
            Convite criado. Envie este link pra pessoa (WhatsApp, e-mail etc.) — ela vai
            escolher a própria senha ao abrir:
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
