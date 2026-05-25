"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { ItemCategory, ScrapedProduct } from "@/lib/types";

interface Props {
  roomId: string;
  onDone: () => void;
  onCancel: () => void;
}

const categories: { value: ItemCategory; label: string }[] = [
  { value: "furniture", label: "Furniture" },
  { value: "wall_finish", label: "Wall finish" },
  { value: "fixture", label: "Fixture / lighting" },
  { value: "textile", label: "Textile / rug" },
  { value: "accessory", label: "Accessory / art" },
  { value: "other", label: "Other" },
];

export function AddItemForm({ roomId, onDone, onCancel }: Props) {
  const supabase = createClient();

  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState<ItemCategory>("furniture");
  const [note, setNote] = useState("");

  async function handleScrape() {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError(null);

    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data: ScrapedProduct & { error?: string } = await res.json();

    if (!res.ok) {
      setScrapeError(data.error ?? "Failed to fetch product data. Fill in manually.");
    } else {
      if (data.name) setName(data.name);
      if (data.vendor) setVendor(data.vendor);
      if (data.price) setPrice(String(data.price));
      if (data.image_url) setImageUrl(data.image_url);
    }
    setScraping(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("items").insert({
      room_id: roomId,
      category,
      name,
      vendor: vendor || null,
      price: price ? parseFloat(price) : null,
      image_url: imageUrl || null,
      product_url: url,
      designer_note: note || null,
    });

    if (!error) {
      onDone();
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-secondary/30 p-4 space-y-4">
      <h3 className="text-sm font-semibold">Add item</h3>

      {/* URL input + scrape */}
      <div className="space-y-1">
        <Label htmlFor="product-url">Product URL</Label>
        <div className="flex gap-2">
          <Input
            id="product-url"
            type="url"
            placeholder="https://www.potterybarn.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleScrape}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleScrape}
            disabled={scraping || !url}
          >
            {scraping ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {scraping ? "Fetching..." : "Auto-fill"}
          </Button>
        </div>
        {scrapeError && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{scrapeError}</p>
        )}
      </div>

      {/* Product details form */}
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="item-name">Name *</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Product name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-vendor">Vendor</Label>
            <Input
              id="item-vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Pottery Barn"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-price">Price ($)</Label>
            <Input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-category">Category</Label>
            <Select
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-image">Image URL</Label>
            <Input
              id="item-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Auto-filled from URL"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="item-note">Designer note (shown to client)</Label>
            <Textarea
              id="item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. This would work well in the corner by the window..."
              rows={2}
            />
          </div>
        </div>

        {/* Image preview */}
        {imageUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Preview"
              className="h-32 w-auto object-contain rounded border"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving || !name || !url}>
            {saving ? "Saving..." : "Save item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
