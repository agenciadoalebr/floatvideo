"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Invite } from "@/lib/types";

/** "vence em 5 dias", ou "venceu" quando a data já passou. */
function validade(iso: string) {
  const dias = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  if (dias < 0) return "venceu";
  if (dias === 0) return "vence hoje";
  return `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export default function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState<string | null>(null);

  async function handleCancel(id: string) {
    const supabase = createClient();
    await supabase.from("invites").delete().eq("id", id);
    router.refresh();
  }

  // O e-mail sai automaticamente quando o convite é criado, mas ele pode
  // cair no spam. Ter o link à mão aqui evita ter que cancelar e
  // convidar de novo só para reaver o endereço.
  async function copiar(invite: Invite) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/convite/${invite.token}`
    );
    setCopiado(invite.id);
    setTimeout(() => setCopiado(null), 2000);
  }

  if (invites.length === 0) return null;

  return (
    <div className="cartao p-5">
      <h2 className="text-sm font-semibold text-brand-ink">Convites pendentes</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Cada um recebeu um e-mail com o link para escolher a senha.
      </p>
      <div className="mt-3 space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-soft bg-surface-soft px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium text-brand-ink">{invite.email}</span>
              <span className="ml-2 text-xs text-ink-faint">
                {invite.role} · {validade(invite.expires_at)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              <button
                onClick={() => copiar(invite)}
                className="text-brand-blue hover:underline"
              >
                {copiado === invite.id ? "Link copiado" : "Copiar link"}
              </button>
              <button
                onClick={() => handleCancel(invite.id)}
                className="text-red-600 hover:underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
