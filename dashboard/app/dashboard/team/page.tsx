import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "@/components/InviteForm";
import MembersList from "@/components/MembersList";
import PendingInvites from "@/components/PendingInvites";
import type { Member, Invite } from "@/lib/types";
import Conteudo from "@/components/Conteudo";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: myMembership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
    return (
      <div className="cartao p-6 text-sm text-ink-faint">
        Você não tem permissão para gerenciar usuários. Fale com um administrador.
      </div>
    );
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", myMembership.organization_id)
    .order("created_at", { ascending: true });

  const userIds = (memberships ?? []).map((m) => m.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const members: Member[] = (memberships ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    email: profiles?.find((p) => p.id === m.user_id)?.email ?? "—",
  }));

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, created_at, accepted_at")
    .eq("organization_id", myMembership.organization_id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .returns<Invite[]>();

  const { data: ehAdminDaPlataforma } = await supabase.rpc("e_admin_da_plataforma");

  return (
    <Conteudo>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">
            {ehAdminDaPlataforma ? "Usuários e permissões" : "Minha equipe"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {ehAdminDaPlataforma
              ? "Quem tem acesso ao painel e o que cada pessoa pode fazer."
              : "Convide quem trabalha com você nesta conta. Todo mundo entra como editor."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Pessoas com acesso", members.length, "contas ativas"],
            [
              "Convites pendentes",
              (invites ?? []).length,
              "aguardando aceite",
            ],
            [
              "Proprietários",
              members.filter((m) => m.role === "owner").length,
              "podem mexer no plano",
            ],
          ].map(([rotulo, valor, nota]) => (
            <div key={rotulo as string} className="cartao p-4">
              <p className="rotulo-metrica">{rotulo as string}</p>
              <p className="mt-1.5 text-2xl font-semibold text-brand-ink">
                {valor as number}
              </p>
              <p className="mt-1 text-xs text-ink-faint">{nota as string}</p>
            </div>
          ))}
        </div>

        <InviteForm
          organizationId={myMembership.organization_id}
          podeEscolherPapel={!!ehAdminDaPlataforma}
        />

        <PendingInvites invites={invites ?? []} />

        <MembersList
          members={members}
          currentUserId={user.id}
          podeMudarPapel={!!ehAdminDaPlataforma}
        />

        <p className="cartao p-4 text-xs text-ink-muted">
          <strong className="text-brand-ink">O que cada papel pode:</strong>{" "}
          proprietário mexe no plano e na cobrança; administrador convida
          pessoas e opera tudo; editor envia vídeos e configura o widget, mas
          não vê o plano.
        </p>
      </div>
    </Conteudo>
  );
}
