import { NextRequest, NextResponse } from "next/server";
import { scrapeProductUrl } from "@/lib/scraper";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const product = await scrapeProductUrl(url);
    return NextResponse.json(product);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scrape URL";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
