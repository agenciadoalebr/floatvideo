import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Checkout, { type PlanoPublico } from "@/components/Checkout";
import { asaasConfigurado } from "@/lib/asaas";

export const metadata = {
  title: "Assinar — FloatVideo",
  description:
    "Crie sua conta no FloatVideo e comece com dias grátis. Sem fidelidade.",
};

/**
 * Compra pela landing.
 *
 * A conta e a assinatura nascem juntas: é o pagamento que dá acesso, e
 * pedir os dados duas vezes (uma para cadastrar, outra para assinar)
 * seria motivo de desistência no meio.
 */
export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; codigo?: string }>;
}) {
  const { plano = "", codigo = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quem já tem conta não assina por aqui: o painel tem a tela dele, com
  // o estado da assinatura que ele já possa ter.
  if (user) {
    const { count } = await supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count) redirect("/dashboard/conta");
  }

  const { data: planos } = await supabase
    .from("plans")
    .select(
      "id, nome, preco_centavos, max_projects, descricao, trial_dias, trial_dias_convite"
    )
    .eq("publico", true)
    .order("ordem")
    .returns<PlanoPublico[]>();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-floatvideo.webp"
              alt="FloatVideo"
              className="h-8 w-auto"
            />
          </Link>
          <Link
            href="/login"
            className="text-sm text-neutral-600 hover:text-brand-blue"
          >
            Já tenho conta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-brand-ink">
          Criar sua conta
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Você só é cobrado depois do período grátis. Cancele quando quiser,
          pelo próprio painel.
        </p>

        <div className="mt-6">
          {asaasConfigurado() ? (
            <Checkout
              planos={planos ?? []}
              planoInicial={plano}
              codigoInicial={codigo.toUpperCase()}
              jaLogado={Boolean(user)}
            />
          ) : (
            <p className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              A assinatura on-line está temporariamente indisponível. Fale com a
              gente em{" "}
              <a
                href="mailto:contato@floatvideo.com.br"
                className="font-medium text-brand-blue hover:underline"
              >
                contato@floatvideo.com.br
              </a>
              .
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
