import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface SelectionInput {
  item_id: string;
  selected: boolean;
  client_note: string | null;
}

export async function POST(request: NextRequest) {
  const { tokenId, projectId, selections } = await request.json();

  if (!tokenId || !projectId || !Array.isArray(selections)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Validate the token is valid and not expired
  const { data: tokenRow } = await service
    .from("magic_tokens")
    .select("id, project_id, expires_at, submitted_at")
    .eq("id", tokenId)
    .eq("project_id", projectId)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 403 });
  }

  // Upsert all selections
  const rows = (selections as SelectionInput[]).map((sel) => ({
    project_id: projectId,
    item_id: sel.item_id,
    selected: sel.selected,
    client_note: sel.client_note,
  }));

  const { error: selError } = await service
    .from("selections")
    .upsert(rows, { onConflict: "project_id,item_id" });

  if (selError) {
    return NextResponse.json({ error: selError.message }, { status: 500 });
  }

  // Mark token as submitted and update project status
  await service
    .from("magic_tokens")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", tokenId);

  await service
    .from("projects")
    .update({ status: "submitted" })
    .eq("id", projectId);

  return NextResponse.json({ ok: true });
}
