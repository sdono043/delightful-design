import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/types";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, clients(name, email), rooms(id)")
    .eq("designer_id", designer!.id)
    .order("updated_at", { ascending: false });

  const statusLabel: Record<ProjectStatus, string> = {
    draft: "Draft",
    sent: "Sent to client",
    submitted: "Selections received",
    complete: "Complete",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects?.length ?? 0} active project{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateProjectDialog designerId={designer!.id} />
      </div>

      {!projects?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No projects yet.</p>
          <p className="text-sm mt-1">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{project.name}</span>
                      <Badge variant={project.status as ProjectStatus}>
                        {statusLabel[project.status as ProjectStatus]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {(project.clients as { name: string }).name}
                      {" · "}
                      {(project.rooms as { id: string }[])?.length ?? 0} room{((project.rooms as { id: string }[])?.length ?? 0) !== 1 ? "s" : ""}
                      {" · "}
                      Updated {formatDate(project.updated_at)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
