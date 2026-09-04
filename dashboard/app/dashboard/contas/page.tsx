import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContasList, { type Conta, type Plano } from "@/components/ContasList";
import Conteudo from "@/components/Conteudo";

/** Contas de clientes e seus planos. Só a administração da plataforma. */
export default async function ContasPage() {
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

  // A tipagem gerada não sabe que esta RPC devolve conjunto; o cast é
  // aqui, num lugar só, em vez de espalhar "any" pela tela.
  const { data: contas } = await supabase.rpc("listar_contas");
  const lista = (contas ?? []) as unknown as Conta[];

  const { data: planos } = await supabase
    .from("plans")
    .select("id, nome, preco_centavos, max_projects")
    .order("ordem")
    .returns<Plano[]>();

  return (
    <Conteudo>
      <ContasList contas={lista} planos={planos ?? []} />
    </Conteudo>
  );
}
