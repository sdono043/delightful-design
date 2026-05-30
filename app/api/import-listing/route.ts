import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ProposedRoom {
  name: string;
  categories: string[];
}

export interface ListingImportResult {
  propertyDescription: string;
  rooms: ProposedRoom[];
}

const CLAUDE_PROMPT = (content: string, notes?: string, imageBase64?: string[]) => {
  const notesSection = notes?.trim()
    ? `\nDesigner notes / project context (use these to tailor specificity, quantities, and style):
${notes}\n`
    : "";

  const imageSection = imageBase64?.length
    ? `\n${imageBase64.length} room photo(s) have been provided. Analyze them to determine furniture layout, room scale, natural light, and specific quantity needs (e.g. "2 accent chairs", "3-seat sofa", "pair of bedside tables").\n`
    : "";

  return `You are an expert residential interior designer. Analyze this real estate listing and propose a detailed room-by-room sourcing list.
${notesSection}${imageSection}
Listing content:
${content}

Respond with valid JSON only, no markdown, in this exact format:
{
  "propertyDescription": "2-3 sentence summary of the property",
  "rooms": [
    {
      "name": "Room Name",
      "categories": ["specific item 1", "specific item 2", "specific item 3"]
    }
  ]
}

Rules:
- Only include rooms that are clearly mentioned or strongly implied by the listing
- Be SPECIFIC with quantities and types — say "3-Seat Sofa" not "Sofa", "2 Accent Chairs" not "Seating", "Pair of Nightstands" not "Nightstands", "6-8 Person Dining Table" based on room size
- If designer notes mention a budget, tailor the item specificity accordingly (e.g. higher budget = more bespoke items like "Custom Upholstered Headboard")
- If designer notes mention a style, reflect it (e.g. "modern organic" → "Curved Bouclé Sofa" instead of generic "Sofa")
- List 4-7 sourcing items per room
- Use standard interior design terminology
- Do not invent rooms not supported by the listing`;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, text: pastedText, notes, images } = await request.json();

  // If pasted text is provided, use it directly
  if (pastedText?.trim()) {
    return await analyzeWithClaude(pastedText.trim(), notes, images);
  }

  if (!url) {
    return NextResponse.json({ error: "url or text is required" }, { status: 400 });
  }

  // Try to fetch the URL
  let text = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await res.text();
    text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return NextResponse.json({ error: "scrape_failed" }, { status: 422 });
  }

  if (text.length < 500) {
    return NextResponse.json({ error: "scrape_failed" }, { status: 422 });
  }

  return await analyzeWithClaude(text, notes, images);
}

async function analyzeWithClaude(
  content: string,
  notes?: string,
  imageBase64?: string[]
): Promise<NextResponse> {
  const promptText = CLAUDE_PROMPT(content, notes, imageBase64);

  // Build message content — text + optional images
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };

  const messageContent: ContentBlock[] = [{ type: "text", text: promptText }];

  if (imageBase64?.length) {
    for (const img of imageBase64) {
      // img format: "data:image/jpeg;base64,<data>"
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: match[2],
          },
        });
      }
    }
  }

  const message = await anthropic.messages.create({
    model: imageBase64?.length ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: messageContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let result: ListingImportResult;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    result = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Could not parse listing data." }, { status: 422 });
  }

  return NextResponse.json(result);
}
