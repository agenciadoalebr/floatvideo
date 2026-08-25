import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "@/components/InviteForm";
import MembersList from "@/components/MembersList";
import PendingInvites from "@/components/PendingInvites";
import type { Member, Invite } from "@/lib/types";

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
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Usuários</h1>
        <p className="text-sm text-neutral-500">
          Gerencie quem tem acesso ao painel da agência.
        </p>
      </div>

      <InviteForm organizationId={myMembership.organization_id} />

      <PendingInvites invites={invites ?? []} />

      <MembersList members={members} currentUserId={user.id} />
    </div>
  );
}
