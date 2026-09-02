import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AccountMenu from "@/components/AccountMenu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canManageUsers = false;
  let ehAdminDaPlataforma = false;
  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    canManageUsers = !!membership && ["owner", "admin"].includes(membership.role);

    const { data: admin } = await supabase.rpc("e_admin_da_plataforma");
    ehAdminDaPlataforma = !!admin;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-floatvideo.webp"
                alt="FloatVideo"
                className="h-8 w-auto"
              />
            </Link>
            {canManageUsers && (
              <Link
                href="/dashboard/team"
                className="text-sm text-neutral-500 hover:text-brand-blue"
              >
                Usuários
              </Link>
            )}
            {ehAdminDaPlataforma && (
              <Link
                href="/dashboard/convites"
                className="text-sm text-neutral-500 hover:text-brand-blue"
              >
                Convites
              </Link>
            )}
          </div>
          <AccountMenu
            email={user?.email ?? ""}
            ehAdminDaPlataforma={ehAdminDaPlataforma}
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
