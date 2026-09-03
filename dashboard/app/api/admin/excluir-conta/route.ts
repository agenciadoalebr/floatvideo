import { NextResponse } from "next/server";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarClienteR2, r2Configurado, R2_BUCKET, R2_PUBLIC_BASE_URL } from "@/lib/r2";
import { asaasConfigurado, cancelarAssinatura } from "@/lib/asaas";

/**
 * Exclui uma conta de cliente inteira — só a administração da plataforma.
 *
 * O banco já apaga em cascata tudo o que pende da organização (sites,
 * vídeos, widgets, eventos, leads, convites, assinatura). O que não vem
 * de graça, e é justamente o que dói se ficar para trás:
 *
 * 1. A assinatura no Asaas. Apagar a conta aqui e deixar a cobrança lá é
 *    continuar cobrando alguém que não tem mais acesso a nada. Se o
 *    cancelamento falhar, esta rota não apaga: cancelar depois seria
 *    impossível, porque o id da assinatura vai embora junto.
 * 2. Os arquivos no R2, que continuariam ocupando espaço pago para
 *    sempre, sem nada no banco apontando para eles.
 * 3. As pessoas. A organização cai em cascata, mas o usuário fica no
 *    auth sem conta nenhuma — só as que não pertencem a outra conta são
 *    removidas.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: ehAdmin } = await supabase.rpc("e_admin_da_plataforma");
  if (!ehAdmin) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { organizationId } = await request.json();
  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: minha } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (minha?.organization_id === organizationId) {
    return NextResponse.json(
      { error: "Você não pode excluir a sua própria conta por aqui." },
      { status: 400 }
    );
  }

  const { data: conta } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (!conta) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  // 1. Cobrança primeiro: é o único passo irreversível se der errado.
  const { data: assinatura } = await admin
    .from("subscriptions")
    .select("asaas_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (assinatura?.asaas_subscription_id && asaasConfigurado()) {
    try {
      await cancelarAssinatura(assinatura.asaas_subscription_id);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "A assinatura no Asaas não pôde ser cancelada, então a conta não foi excluída — senão a cobrança continuaria sem ninguém para reclamar. Detalhe: " +
            (err instanceof Error ? err.message : "erro desconhecido"),
        },
        { status: 502 }
      );
    }
  }

  // 2. Arquivos no R2, achados pelas URLs guardadas nos vídeos.
  let arquivosApagados = 0;

  if (r2Configurado()) {
    // Duas consultas em vez de um filtro aninhado: é o mesmo resultado,
    // e não depende de eu acertar a sintaxe de join do PostgREST num
    // caminho que só roda na hora de apagar.
    const { data: sites } = await admin
      .from("projects")
      .select("id")
      .eq("organization_id", organizationId);

    const { data: videos } = await admin
      .from("videos")
      .select("mp4_url, webm_url, preview_url, thumbnail_url")
      .in("project_id", (sites ?? []).map((p) => p.id));

    const chaves = new Set<string>();
    for (const v of videos ?? []) {
      for (const url of [v.mp4_url, v.webm_url, v.preview_url, v.thumbnail_url]) {
        if (typeof url === "string" && url.startsWith(R2_PUBLIC_BASE_URL + "/")) {
          chaves.add(url.slice(R2_PUBLIC_BASE_URL.length + 1));
        }
      }
    }

    if (chaves.size > 0) {
      try {
        const cliente = criarClienteR2();
        // O R2 aceita mil objetos por chamada.
        const lista = [...chaves];
        for (let i = 0; i < lista.length; i += 1000) {
          await cliente.send(
            new DeleteObjectsCommand({
              Bucket: R2_BUCKET,
              Delete: { Objects: lista.slice(i, i + 1000).map((Key) => ({ Key })) },
            })
          );
        }
        arquivosApagados = lista.length;
      } catch {
        // Arquivo órfão custa centavos; travar a exclusão por causa disso
        // deixaria a conta pela metade, que é pior. Segue e reporta.
      }
    }
  }

  // 3. Quem eram as pessoas, antes de a cascata levar os vínculos.
  const { data: membros } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);

  const pessoas = (membros ?? []).map((m) => m.user_id as string);

  const { error: erroExclusao } = await admin
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (erroExclusao) {
    return NextResponse.json({ error: erroExclusao.message }, { status: 500 });
  }

  // 4. Só some quem não sobrou em nenhuma outra conta.
  let pessoasExcluidas = 0;

  for (const id of pessoas) {
    if (id === user.id) continue;

    const { count } = await admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", id);

    if (count) continue;

    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) pessoasExcluidas++;
  }

  return NextResponse.json({
    ok: true,
    conta: conta.name,
    pessoasExcluidas,
    arquivosApagados,
  });
}
