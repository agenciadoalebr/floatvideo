import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "@/components/PasswordForm";

const PLANOS: Record<string, { nome: string; descricao: string }> = {
  free: {
    nome: "Beta",
    descricao: "Acesso completo enquanto o FloatVideo está em testes.",
  },
};

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(name, plan, created_at)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const org = membership?.organizations as
    | { name: string; plan: string; created_at: string }
    | undefined;

  const { count: sites } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  const plano = PLANOS[org?.plan ?? "free"] ?? {
    nome: org?.plan ?? "—",
    descricao: "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-ink">Minha conta</h1>
        <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
      </div>

      <PasswordForm />

      <div
        id="plano"
        className="max-w-md space-y-3 rounded-lg border border-neutral-200 bg-white p-5"
      >
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">Meu plano</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {org?.name ?? "Sua conta"}
          </p>
        </div>

        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-lg font-semibold text-brand-ink">{plano.nome}</p>
          {plano.descricao && (
            <p className="mt-1 text-xs text-neutral-600">{plano.descricao}</p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-neutral-200 p-3">
            <dt className="text-neutral-500">Sites</dt>
            <dd className="mt-0.5 text-base font-semibold text-brand-ink">
              {sites ?? 0}
            </dd>
          </div>
          <div className="rounded-md border border-neutral-200 p-3">
            <dt className="text-neutral-500">Cliente desde</dt>
            <dd className="mt-0.5 text-base font-semibold text-brand-ink">
              {org?.created_at
                ? new Date(org.created_at).toLocaleDateString("pt-BR")
                : "—"}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-neutral-500">
          Para mudar de plano, fale com a gente pelo e-mail{" "}
          <a
            href="mailto:contato@floatvideo.com.br"
            className="font-medium text-brand-blue hover:underline"
          >
            contato@floatvideo.com.br
          </a>
          .
        </p>
      </div>
    </div>
  );
}
