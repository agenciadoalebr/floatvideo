import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewProjectForm from "@/components/NewProjectForm";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Project[]>();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Seus sites</h1>
        <p className="text-sm text-neutral-500">
          Cada site onde você quer colocar o vídeo flutuante é um &quot;projeto&quot;.
        </p>
      </div>

      <NewProjectForm />

      <div className="space-y-3">
        {!projects || projects.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhum site cadastrado ainda. Crie o primeiro acima.
          </p>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400"
            >
              <div>
                <p className="font-medium text-neutral-900">{project.name}</p>
                <p className="text-xs text-neutral-500">
                  {project.domain || "domínio não definido"}
                </p>
              </div>
              <span className="text-sm text-neutral-400">Abrir →</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
