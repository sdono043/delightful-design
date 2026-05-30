import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomName, projectNotes, existingItems, images } = await request.json();

  if (!roomName || !images?.length) {
    return NextResponse.json({ error: "roomName and images are required" }, { status: 400 });
  }

  const notesLine = projectNotes?.trim()
    ? `Project context (style, budget, scope): ${projectNotes}\n`
    : "";

  const existingLine = existingItems?.length
    ? `Items already planned for this room: ${(existingItems as string[]).join(", ")}\n`
    : "";

  const prompt = `You are an expert residential interior designer. Analyze the provided room photo(s) and suggest a specific, actionable sourcing list for this space.

Room: ${roomName}
${notesLine}${existingLine}
Based on the room's visible layout, scale, natural light, and any existing furniture, suggest 5-8 specific items needed to furnish or style this space.

Rules:
- Be SPECIFIC with quantities and types: "3-Seat Sofa" not "Sofa", "Pair of Accent Chairs" not "Chairs", "6-ft Round Dining Table" based on visible floor space
- If existing items are listed, suggest complementary pieces — do not duplicate
- Reflect any style or budget context from the project notes
- Use standard interior design terminology

Respond with valid JSON only, no markdown:
{
  "suggestions": ["specific item 1", "specific item 2", "specific item 3"]
}`;

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };

  const content: ContentBlock[] = [{ type: "text", text: prompt }];

  for (const img of images as string[]) {
    const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: match[2],
        },
      });
    }
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const result = JSON.parse(jsonMatch[0]) as { suggestions: string[] };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not parse suggestions." }, { status: 422 });
  }
}
