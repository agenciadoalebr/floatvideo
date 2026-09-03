import { createClient } from "@/lib/supabase/server";
import ListaDeSites, { type ResumoDoSite } from "@/components/ListaDeSites";
import Conteudo from "@/components/Conteudo";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Uma chamada só: contagem de eventos por site não é algo que o
  // PostgREST agrupe, e esta é a primeira tela do painel — o lugar onde
  // a espera mais incomoda.
  //
  // A tipagem gerada não sabe que esta RPC devolve conjunto; o cast fica
  // aqui, num lugar só, como já é feito em listar_contas.
  const { data: sites } = await supabase.rpc("resumo_dos_sites");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organizations(max_projects, plans(nome, max_projects))")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .maybeSingle();

  const org = membership?.organizations as
    | {
        max_projects: number | null;
        plans: { nome: string; max_projects: number | null } | null;
      }
    | undefined;

  return (
    <Conteudo>
      <ListaDeSites
        sites={(sites ?? []) as unknown as ResumoDoSite[]}
        // A exceção negociada na conta vence o limite do plano — a mesma
        // regra que o banco aplica ao recusar o cadastro.
        limite={org?.max_projects ?? org?.plans?.max_projects ?? null}
        planoNome={org?.plans?.nome ?? null}
      />
    </Conteudo>
  );
}
