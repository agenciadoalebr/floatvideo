import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "@/components/PasswordForm";
import Assinatura, {
  type Plano,
  type AssinaturaAtual,
} from "@/components/Assinatura";
import { asaasConfigurado } from "@/lib/asaas";
import Conteudo from "@/components/Conteudo";

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select(
      "role, organization_id, organizations(name, plan, created_at, max_projects, plans(nome, preco_centavos, max_projects, descricao))"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const org = membership?.organizations as
    | {
        name: string;
        plan: string;
        created_at: string;
        max_projects: number | null;
        plans: {
          nome: string;
          preco_centavos: number;
          max_projects: number | null;
          descricao: string | null;
        } | null;
      }
    | undefined;

  // Quem foi convidado para a conta de outra pessoa não vê o plano: ele
  // não é dela, e não há nada ali que essa pessoa decida.
  const ehDono = membership?.role === "owner";

  const { count: sites } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  const plano = org?.plans;

  // Assinatura e planos só interessam a quem é dono da conta; quem foi
  // convidado nem vê este bloco.
  const { data: assinatura } = ehDono
    ? await supabase
        .from("subscriptions")
        .select(
          "plan, status, trial_ends_at, current_period_end, overdue_since, invoice_url"
        )
        .eq("organization_id", membership?.organization_id ?? "")
        .maybeSingle()
    : { data: null };

  const { data: planosPublicos } = ehDono
    ? await supabase
        .from("plans")
        .select("id, nome, preco_centavos, max_projects, descricao, trial_dias")
        .eq("publico", true)
        .order("ordem")
    : { data: null };
  const limiteSites = org?.max_projects ?? plano?.max_projects ?? null;

  return (
    <Conteudo>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-ink">Minha conta</h1>
          <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
        </div>

        <PasswordForm />

        {ehDono && asaasConfigurado() && (
          <Assinatura
            planos={(planosPublicos ?? []) as Plano[]}
            atual={(assinatura ?? null) as AssinaturaAtual}
            nomeDaConta={org?.name ?? ""}
          />
        )}

        {ehDono && (
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
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-lg font-semibold text-brand-ink">
                {plano?.nome ?? "—"}
              </p>
              {plano && plano.preco_centavos > 0 && (
                <p className="text-sm text-neutral-600">
                  R$ {(plano.preco_centavos / 100).toFixed(0).replace(".", ",")}
                  <span className="text-xs text-neutral-400">/mês</span>
                </p>
              )}
            </div>
            {plano?.descricao && (
              <p className="mt-1 text-xs text-neutral-600">{plano.descricao}</p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-neutral-200 p-3">
              <dt className="text-neutral-500">Sites</dt>
              <dd className="mt-0.5 text-base font-semibold text-brand-ink">
                {sites ?? 0}
                <span className="text-sm font-normal text-neutral-400">
                  {" "}
                  / {limiteSites ?? "∞"}
                </span>
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
        )}
      </div>
    </Conteudo>
  );
}
