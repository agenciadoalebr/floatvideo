"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member, OrgRole } from "@/lib/types";

export default function MembersList({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
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
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-700">Time</h2>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 divide-y divide-neutral-100">
        {members.map((member) => {
          const isSelf = member.user_id === currentUserId;
          const isLastOwner = member.role === "owner" && ownerCount <= 1;

          return (
            <div key={member.user_id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-neutral-800">
                  {member.email} {isSelf && <span className="text-xs text-neutral-400">(você)</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  disabled={isLastOwner}
                  onChange={(e) => handleRoleChange(member.user_id, e.target.value as OrgRole)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Administrador</option>
                  <option value="owner">Dono</option>
                </select>
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
