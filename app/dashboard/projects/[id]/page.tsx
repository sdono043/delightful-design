import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProjectActions } from "@/components/dashboard/project-actions";
import { RoomManager } from "@/components/dashboard/room-manager";
import { EditProjectNotes } from "@/components/dashboard/edit-project-notes";
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

  const allItems = (rooms ?? []).flatMap((r) => r.items ?? []);
  const totalItems = allItems.length;
  const sourcedItems = allItems.filter((i) => i.product_url !== "https://placeholder.com").length;
  const unsourcedCount = totalItems - sourcedItems;

  return (
    <div>
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

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
          <EditProjectNotes projectId={id} notes={project.notes} />
        </div>

        <ProjectActions
          projectId={id}
          status={status}
          clientEmail={client.email}
          token={token}
          unsourcedCount={unsourcedCount}
        />
      </div>

      {/* Sourcing progress */}
      {totalItems > 0 && (
        <div className="mb-4 flex items-center gap-3 text-sm">
          <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${totalItems > 0 ? (sourcedItems / totalItems) * 100 : 0}%` }}
            />
          </div>
          <span className="text-muted-foreground shrink-0">
            {sourcedItems}/{totalItems} items sourced
            {unsourcedCount > 0 && (
              <span className="text-amber-700 ml-1">· {unsourcedCount} need sourcing</span>
            )}
          </span>
        </div>
      )}

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
        projectNotes={project.notes}
        rooms={(rooms ?? []).map((r) => ({
          ...r,
          items: r.items ?? [],
        }))}
      />
    </div>
  );
}
