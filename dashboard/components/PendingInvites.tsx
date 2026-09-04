"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Invite } from "@/lib/types";

export default function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();

  async function handleCancel(id: string) {
    const supabase = createClient();
    await supabase.from("invites").delete().eq("id", id);
    router.refresh();
  }

  if (invites.length === 0) return null;

  return (
    <div className="cartao p-5">
      <h2 className="text-sm font-semibold text-brand-ink">Convites pendentes</h2>
      <div className="mt-3 space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between rounded-lg border border-neutral-100 bg-surface-soft px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium text-brand-ink">{invite.email}</span>
              <span className="ml-2 text-xs text-ink-faint">{invite.role}</span>
            </div>
            <button
              onClick={() => handleCancel(invite.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Cancelar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
