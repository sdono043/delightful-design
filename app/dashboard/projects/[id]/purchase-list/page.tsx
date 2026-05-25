import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { PurchaseListClient } from "@/components/dashboard/purchase-list-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PurchaseListPage({ params }: Props) {
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

  // Get selections with item and room data
  const { data: selections } = await supabase
    .from("selections")
    .select("*, items(*, rooms(*))")
    .eq("project_id", id)
    .eq("selected", true)
    .order("created_at");

  const client = project.clients as { name: string; email: string };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/dashboard/projects/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Purchase list</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {project.name} &middot; {client.name}
          </p>
        </div>
      </div>

      <PurchaseListClient
        projectName={project.name}
        clientName={client.name}
        selections={selections ?? []}
      />
    </div>
  );
}
