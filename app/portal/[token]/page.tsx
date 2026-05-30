import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { PortalClient } from "@/components/portal/portal-client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up the token
  const { data: tokenRow } = await service
    .from("magic_tokens")
    .select("*, projects(*, clients(name))")
    .eq("token", token)
    .single();

  if (!tokenRow) notFound();

  // Check expiry
  if (new Date(tokenRow.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
        <div className="text-center max-w-sm">
          <h1 className="font-serif text-2xl font-semibold mb-2">Link expired</h1>
          <p className="text-muted-foreground text-sm">
            This selection link has expired. Please ask your designer to send a new one.
          </p>
        </div>
      </div>
    );
  }

  // Mark as opened if first visit
  if (!tokenRow.opened_at) {
    await service
      .from("magic_tokens")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", tokenRow.id);
  }

  const project = tokenRow.projects as {
    id: string;
    name: string;
    clients: { name: string };
  };

  // Get rooms + items
  const { data: rooms } = await service
    .from("rooms")
    .select("*, items(*)")
    .eq("project_id", project.id)
    .order("display_order");

  // Get any existing selections
  const { data: existingSelections } = await service
    .from("selections")
    .select("item_id, selected, client_note")
    .eq("project_id", project.id);

  const alreadySubmitted = !!tokenRow.submitted_at;

  // Filter out placeholder (unsourced) items — clients should only see fully sourced items
  const filteredRooms = (rooms ?? [])
    .map((r) => ({
      ...r,
      items: (r.items ?? []).filter((item: { product_url: string }) => item.product_url !== "https://placeholder.com"),
    }))
    .filter((r) => r.items.length > 0);

  return (
    <PortalClient
      tokenId={tokenRow.id}
      projectId={project.id}
      projectName={project.name}
      clientName={project.clients.name}
      rooms={filteredRooms}
      existingSelections={existingSelections ?? []}
      alreadySubmitted={alreadySubmitted}
    />
  );
}
