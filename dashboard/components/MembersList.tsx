"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member, OrgRole } from "@/lib/types";

const PAPEIS: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  editor: "Editor",
};

export default function MembersList({
  members,
  currentUserId,
  podeMudarPapel = false,
}: {
  members: Member[];
  currentUserId: string;
  /** Trocar papel é da administração da plataforma. */
  podeMudarPapel?: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const ownerCount = members.filter((m) => m.role === "owner").length;

  async function handleRoleChange(userId: string, role: OrgRole) {
    const supabase = createClient();
    await supabase
      .from("organization_members")
      .update({ role })
      .eq("user_id", userId);
    router.refresh();
  }

  async function handleDelete(userId: string, email: string) {
    if (
      !confirm(
        `Excluir a conta de ${email}? Essa pessoa perde o acesso imediatamente e não poderá mais entrar com esse e-mail.`
      )
    ) {
      return;
    }

    setError("");
    setDeletingId(userId);

    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();

    setDeletingId(null);

    if (!res.ok) {
      setError(data.error ?? "Erro ao excluir usuário.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="cartao p-5">
      <h2 className="text-sm font-semibold text-brand-ink">Time</h2>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 divide-y divide-outline-soft">
        {members.map((member) => {
          const isSelf = member.user_id === currentUserId;
          const isLastOwner = member.role === "owner" && ownerCount <= 1;

          return (
            <div key={member.user_id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-brand-ink">
                  {member.email} {isSelf && <span className="text-xs text-ink-faint">(você)</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {podeMudarPapel ? (
                  <select
                    value={member.role}
                    disabled={isLastOwner}
                    onChange={(e) => handleRoleChange(member.user_id, e.target.value as OrgRole)}
                    className="rounded-lg border border-outline-soft px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                    <option value="owner">Dono</option>
                  </select>
                ) : (
                  // Sem seletor: na conta do cliente todo mundo entra como
                  // editor, e promover alguem a dono nao e decisao que a
                  // tela deva oferecer de graca.
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                    {PAPEIS[member.role] ?? member.role}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(member.user_id, member.email)}
                  disabled={isSelf || isLastOwner || deletingId === member.user_id}
                  className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-300 disabled:no-underline"
                  title={
                    isSelf
                      ? "Você não pode excluir a si mesmo"
                      : isLastOwner
                        ? "Precisa haver pelo menos um dono"
                        : ""
                  }
                >
                  {deletingId === member.user_id ? "Excluindo..." : "Excluir usuário"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
