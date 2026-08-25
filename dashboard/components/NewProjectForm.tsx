"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewProjectForm() {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login de novo.");
      setLoading(false);
      return;
    }

    // Todo usuário tem uma organização criada automaticamente no cadastro.
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      setError("Não foi possível localizar sua organização.");
      setLoading(false);
      return;
    }

    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        organization_id: membership.organization_id,
        name,
        domain: domain || null,
      })
      .select("id")
      .single();

    setLoading(false);

    if (insertError || !project) {
      setError(insertError?.message ?? "Erro ao criar o site.");
      return;
    }

    setName("");
    setDomain("");
    router.push(`/dashboard/projects/${project.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="block text-xs font-medium text-neutral-600">
          Nome do site
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Loja Principal"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-neutral-600">
          Domínio (opcional)
        </label>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Ex: minhaloja.com.br"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-brand rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar site"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
