import * as cheerio from "cheerio";
import type { ScrapedProduct } from "@/lib/types";

export async function scrapeProductUrl(url: string): Promise<ScrapedProduct> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // --- Name ---
  const name =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $('h1[itemprop="name"]').first().text().trim() ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "";

  // --- Image ---
  const image_url =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('[itemprop="image"]').attr("content") ||
    $('[itemprop="image"]').attr("src") ||
    null;

  // --- Description ---
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    null;

  // --- Price ---
  let price: number | null = null;

  // schema.org Product / Offer
  const schemaScripts = $('script[type="application/ld+json"]');
  schemaScripts.each((_, el) => {
    if (price !== null) return;
    try {
      const data = JSON.parse($(el).html() || "{}");
      const products = Array.isArray(data) ? data : [data];
      for (const item of products) {
        const target = item["@type"] === "Product" ? item : null;
        if (target) {
          const offers = target.offers;
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers;
            const raw = offer.price ?? offer.lowPrice;
            if (raw) {
              const parsed = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
              if (!isNaN(parsed)) price = parsed;
            }
          }
        }
      }
    } catch {}
  });

  // og:price:amount
  if (price === null) {
    const ogPrice =
      $('meta[property="og:price:amount"]').attr("content") ||
      $('meta[property="product:price:amount"]').attr("content");
    if (ogPrice) {
      const parsed = parseFloat(ogPrice.replace(/[^0-9.]/g, ""));
      if (!isNaN(parsed)) price = parsed;
    }
  }

  // Common price selectors as fallback
  if (price === null) {
    const priceSelectors = [
      '[itemprop="price"]',
      ".price",
      '[data-testid="price"]',
      '[class*="price"]',
      '[id*="price"]',
    ];
    for (const sel of priceSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.attr("content") || el.text();
        const parsed = parseFloat(text.replace(/[^0-9.]/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
          break;
        }
      }
    }
  }

  // --- Vendor / Site name ---
  const vendor =
    $('meta[property="og:site_name"]').attr("content") ||
    extractDomainName(url);

  return {
    name: cleanText(name),
    vendor,
    price,
    image_url: image_url ? resolveUrl(image_url, url) : null,
    description: description ? cleanText(description) : null,
  };
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractDomainName(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

function resolveUrl(imageUrl: string, baseUrl: string): string {
  try {
    return new URL(imageUrl, baseUrl).toString();
  } catch {
    return imageUrl;
  }
}
