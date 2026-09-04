import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ContaDetalhe, {
  type ContaCompleta,
  type Registro,
  type AssinaturaAdmin,
  type Pessoa,
  type Site,
} from "@/components/ContaDetalhe";
import type { Plano } from "@/components/ContasList";
import Conteudo from "@/components/Conteudo";

/**
 * O PostgREST devolve a tabela relacionada como objeto ou como lista,
 * conforme a cardinalidade que ele deduz do schema — e a tipagem gerada
 * nem sempre concorda com o que chega. Um lugar só para desempacotar.
 */
function primeiro<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

/**
 * Ficha completa de uma conta de cliente.
 *
 * A leitura usa a chave de serviço porque as políticas de acesso do banco
 * são escritas do ponto de vista do cliente — cada um enxerga a própria
 * conta. A administração precisa ver a de todo mundo, e a checagem de
 * quem pode fazer isso acontece logo abaixo, antes de qualquer consulta.
 */
export default async function ContaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, plan, created_at, max_projects, observacoes_internas, bloqueio_manual, plans(max_projects)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const { data: assinatura } = await admin
    .from("subscriptions")
    .select(
      "status, plan, titular, cpf_cnpj, telefone, trial_ends_at, current_period_end, overdue_since, invoice_url, ultimo_evento, asaas_customer_id, asaas_subscription_id, created_at"
    )
    .eq("organization_id", id)
    .maybeSingle();

  const { data: membros } = await admin
    .from("organization_members")
    .select("role, created_at, profiles(email)")
    .eq("organization_id", id)
    .order("created_at");

  const { data: projetos } = await admin
    .from("projects")
    .select("id, name, domain")
    .eq("organization_id", id)
    .order("created_at");

  const { data: videos } = await admin
    .from("videos")
    .select("project_id")
    .in("project_id", (projetos ?? []).map((p) => p.id));

  const { data: auditoria } = await admin
    .from("admin_audit_log")
    .select("id, acao, ator_email, detalhe, ip, created_at")
    .eq("organization_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: planos } = await admin
    .from("plans")
    .select("id, nome, preco_centavos, max_projects")
    .order("ordem")
    .returns<Plano[]>();

  const conta: ContaCompleta = {
    id: org.id,
    nome: org.name,
    plano: org.plan,
    criada_em: org.created_at,
    max_projects: org.max_projects,
    observacoes: org.observacoes_internas,
    bloqueio_manual: org.bloqueio_manual,
    limite_do_plano:
      primeiro(org.plans as { max_projects: number | null } | { max_projects: number | null }[] | null)
        ?.max_projects ?? null,
  };

  const pessoas: Pessoa[] = (membros ?? []).map((m) => ({
    email:
      primeiro(m.profiles as { email: string } | { email: string }[] | null)
        ?.email ?? "—",
    role: m.role as string,
    desde: m.created_at as string,
  }));

  const sites: Site[] = (projetos ?? []).map((p) => ({
    nome: p.name,
    dominio: p.domain,
    videos: (videos ?? []).filter((v) => v.project_id === p.id).length,
  }));

  return (
    <Conteudo>
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/contas"
            className="text-xs text-neutral-500 hover:text-brand-blue"
          >
            ← Contas
          </Link>
        </div>

        <ContaDetalhe
          conta={conta}
          assinatura={(assinatura ?? null) as AssinaturaAdmin}
          pessoas={pessoas}
          sites={sites}
          planos={planos ?? []}
          auditoria={(auditoria ?? []) as Registro[]}
        />
      </div>
    </Conteudo>
  );
}
