import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // Use service role to bypass RLS for token creation and email sending
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify designer owns this project
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("*, clients(name, email), designers(user_id)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.designers.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Invalidate any previous tokens for this project
  await service
    .from("magic_tokens")
    .delete()
    .eq("project_id", projectId);

  // Create a new token
  const { data: tokenRow, error: tokenError } = await service
    .from("magic_tokens")
    .insert({ project_id: projectId })
    .select()
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }

  // Update project status to sent
  await service
    .from("projects")
    .update({ status: "sent" })
    .eq("id", projectId);

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${tokenRow.token}`;
  const clientEmail = project.clients.email;
  const clientName = project.clients.name;

  // Use Supabase's built-in email to send the link
  // In production you could swap this for Resend/SendGrid for custom templates
  const { error: emailError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: clientEmail,
    options: {
      redirectTo: portalUrl,
      data: { client_name: clientName, portal_url: portalUrl },
    },
  });

  if (emailError) {
    // Return the portal URL anyway so designer can share manually
    return NextResponse.json({
      portalUrl,
      warning: "Token created but email failed to send. Share the link manually.",
    });
  }

  return NextResponse.json({ portalUrl, sent: true });
}
