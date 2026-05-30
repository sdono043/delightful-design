import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify designer owns this project
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("*, clients(name, email), designers(user_id, firm_name)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.designers.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Invalidate previous tokens and create a fresh one
  await service.from("magic_tokens").delete().eq("project_id", projectId);

  const { data: tokenRow, error: tokenError } = await service
    .from("magic_tokens")
    .insert({ project_id: projectId })
    .select()
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }

  await service.from("projects").update({ status: "sent" }).eq("id", projectId);

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${tokenRow.token}`;
  const clientEmail = project.clients.email as string;
  const clientName = project.clients.name as string;
  const firmName = (project.designers.firm_name as string) || "Ann Merideth Design";
  const firstName = clientName.split(" ")[0];

  // Send branded email via Resend if key is configured
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: `${firmName} <onboarding@resend.dev>`,
      to: clientEmail,
      subject: `Your selections are ready — ${project.name}`,
      html: buildEmailHtml({ firstName, firmName, projectName: project.name, portalUrl }),
    });

    if (emailError) {
      return NextResponse.json({
        portalUrl,
        warning: "Token created but email failed to send. Share the link manually.",
      });
    }

    return NextResponse.json({ portalUrl, sent: true });
  }

  // Fallback: Supabase auth magic link (rate-limited, but works without Resend key)
  const { error: emailError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: clientEmail,
    options: { redirectTo: portalUrl },
  });

  if (emailError) {
    return NextResponse.json({
      portalUrl,
      warning: "Token created but email failed to send. Share the link manually.",
    });
  }

  return NextResponse.json({ portalUrl, sent: true });
}

function buildEmailHtml({
  firstName,
  firmName,
  projectName,
  portalUrl,
}: {
  firstName: string;
  firmName: string;
  projectName: string;
  portalUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F5F4F1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FAFAF8;border-radius:8px;overflow:hidden;border:1px solid #E8E4DE;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #E8E4DE;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:600;color:#1C1C1A;letter-spacing:0.02em;">${firmName}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1C1C1A;">Hi ${firstName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#5C5C58;line-height:1.6;">
                Your curated selections for <strong style="color:#1C1C1A;">${projectName}</strong> are ready to review.
                Browse the options, select the pieces you love, and leave any notes before submitting.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:#1C1C1A;border-radius:4px;">
                    <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:500;color:#FAFAF8;text-decoration:none;letter-spacing:0.04em;">
                      View Your Selections
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#9C9C98;text-align:center;">
                Or copy this link: <a href="${portalUrl}" style="color:#9C9C98;">${portalUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #E8E4DE;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9C9C98;">${firmName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
