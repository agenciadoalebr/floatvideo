import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";

/**
 * Exclui de verdade a conta de um usuário (auth.users), não só o acesso à
 * organização. Isso exige a service_role key do Supabase — que só existe
 * aqui no servidor (nunca chega ao browser). Configure em Vercel:
 * Project Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY
 * (valor em Supabase: Project Settings → API → service_role secret).
 */
export async function POST(request: Request) {
  const { userId } = await request.json();

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId inválido." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (caller.id === userId) {
    return NextResponse.json(
      { error: "Você não pode excluir a si mesmo." },
      { status: 400 }
    );
  }

  const { data: callerMembership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", caller.id)
    .limit(1)
    .maybeSingle();

  if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { data: targetMembership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", callerMembership.organization_id)
    .maybeSingle();

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Usuário não encontrado na sua organização." },
      { status: 404 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Adicione essa variável de ambiente no projeto da Vercel.",
      },
      { status: 500 }
    );
  }

  const adminClient = createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
