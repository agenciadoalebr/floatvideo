import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteCodes, { type InviteCode } from "@/components/InviteCodes";

/**
 * Códigos de convite do produto. Só quem administra a plataforma entra
 * aqui — não é o mesmo que ser dono de uma conta, que todo cliente é da
 * sua. A checagem é dupla de propósito: esta, para não desenhar a tela,
 * e a RLS da tabela, que é quem de fato protege os dados.
 */
export default async function ConvitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: ehAdmin } = await supabase.rpc("e_admin_da_plataforma");

  if (!ehAdmin) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        Esta área é da administração da plataforma.
      </div>
    );
  }

  const { data: codigos } = await supabase
    .from("invite_codes")
    .select("id, code, batch, created_at, used_email, used_at")
    .order("created_at", { ascending: false })
    .returns<InviteCode[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-ink">Convites</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Códigos para novos clientes criarem conta no FloatVideo.
        </p>
      </div>

      <InviteCodes codigos={codigos ?? []} />
    </div>
  );
}
