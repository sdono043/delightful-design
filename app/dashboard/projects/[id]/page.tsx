import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProjectActions } from "@/components/dashboard/project-actions";
import { RoomManager } from "@/components/dashboard/room-manager";
import type { ProjectStatus } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

const statusLabel: Record<ProjectStatus, string> = {
  draft: "Draft",
  sent: "Sent to client",
  submitted: "Selections received",
  complete: "Complete",
};

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name, email)")
    .eq("id", id)
    .eq("designer_id", designer!.id)
    .single();

  if (!project) notFound();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("*, items(*)")
    .eq("project_id", id)
    .order("display_order");

  const { data: token } = await supabase
    .from("magic_tokens")
    .select("token, expires_at, opened_at, submitted_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const client = project.clients as { name: string; email: string };
  const status = project.status as ProjectStatus;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-serif text-2xl font-semibold">{project.name}</h1>
            <Badge variant={status}>{statusLabel[status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {client.name} &middot; {client.email} &middot; Created {formatDate(project.created_at)}
          </p>
          {project.notes && (
            <p className="text-sm text-muted-foreground mt-1 italic">{project.notes}</p>
          )}
        </div>

        <ProjectActions
          projectId={id}
          status={status}
          clientEmail={client.email}
          token={token}
        />
      </div>

      {/* Token status bar */}
      {token && (
        <div className="mb-6 rounded-lg border bg-secondary/50 px-4 py-3 text-sm flex flex-wrap gap-4">
          <span>
            <span className="text-muted-foreground">Portal link: </span>
            <a
              href={`/portal/${token.token}`}
              target="_blank"
              className="text-primary underline underline-offset-2 font-mono text-xs"
            >
              /portal/{token.token.slice(0, 8)}…
            </a>
          </span>
          {token.opened_at && (
            <span className="text-muted-foreground">
              Opened {formatDate(token.opened_at)}
            </span>
          )}
          {token.submitted_at && (
            <span className="text-green-700 font-medium">
              ✓ Submitted {formatDate(token.submitted_at)}
            </span>
          )}
        </div>
      )}

      {/* Rooms and items */}
      <RoomManager
        projectId={id}
        rooms={(rooms ?? []).map((r) => ({
          ...r,
          items: r.items ?? [],
        }))}
      />
    </div>
  );
}
