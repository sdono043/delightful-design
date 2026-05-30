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

const CLAUDE_PROMPT = (content: string) => `You are an expert residential interior designer. Analyze this real estate listing and propose a room-by-room sourcing list.

Listing content:
${content}

Respond with valid JSON only, no markdown, in this exact format:
{
  "propertyDescription": "2-3 sentence summary of the property",
  "rooms": [
    {
      "name": "Room Name",
      "categories": ["category 1", "category 2", "category 3"]
    }
  ]
}

Rules:
- Only include rooms that are clearly mentioned or strongly implied by the listing
- For each room, list 3-6 sourcing categories (specific item types a designer would source, e.g. "Sofa", "Coffee Table", "Area Rug", "Floor Lamp", "Accent Chairs", "Side Tables")
- Use standard interior design terminology
- Common rooms: Living Room, Primary Bedroom, Dining Room, Kitchen, Home Office, Guest Bedroom, Primary Bathroom, Mudroom/Entry
- Do not invent rooms not supported by the listing`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, text: pastedText } = await request.json();

  // If pasted text is provided, use it directly
  if (pastedText?.trim()) {
    return await analyzeWithClaude(pastedText.trim());
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
    // Signal to the client that scraping failed so they can show the paste fallback
    return NextResponse.json({ error: "scrape_failed" }, { status: 422 });
  }

  // Check if we got meaningful content (Zillow/Redfin often return JS-only pages)
  if (text.length < 500) {
    return NextResponse.json({ error: "scrape_failed" }, { status: 422 });
  }

  return await analyzeWithClaude(text);
}

async function analyzeWithClaude(content: string): Promise<NextResponse> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: CLAUDE_PROMPT(content) }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let result: ListingImportResult;
  try {
    // Extract JSON even if Claude wrapped it in markdown code blocks
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    result = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Could not parse listing data." }, { status: 422 });
  }

  return NextResponse.json(result);
}
