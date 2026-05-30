"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2, Pencil, Loader2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemCategory, ScrapedProduct } from "@/lib/types";
import Image from "next/image";

interface Props {
  items: Item[];
}

const categoryLabel: Record<string, string> = {
  furniture: "Furniture",
  wall_finish: "Wall finish",
  fixture: "Fixture",
  textile: "Textile",
  accessory: "Accessory",
  other: "Other",
};

const categories: { value: ItemCategory; label: string }[] = [
  { value: "furniture", label: "Furniture" },
  { value: "wall_finish", label: "Wall finish" },
  { value: "fixture", label: "Fixture / lighting" },
  { value: "textile", label: "Textile / rug" },
  { value: "accessory", label: "Accessory / art" },
  { value: "other", label: "Other" },
];

const PLACEHOLDER_URL = "https://placeholder.com";

function isPlaceholder(item: Item) {
  return item.product_url === PLACEHOLDER_URL;
}

interface EditFormProps {
  item: Item;
  onDone: () => void;
  onCancel: () => void;
}

function EditItemForm({ item, onDone, onCancel }: EditFormProps) {
  const supabase = createClient();

  const [url, setUrl] = useState(isPlaceholder(item) ? "" : item.product_url);
  const [name, setName] = useState(item.name);
  const [vendor, setVendor] = useState(item.vendor ?? "");
  const [price, setPrice] = useState(item.price != null ? String(item.price) : "");
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [category, setCategory] = useState<ItemCategory>(item.category as ItemCategory);
  const [note, setNote] = useState(
    item.designer_note === "To be sourced" ? "" : (item.designer_note ?? "")
  );
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      setScrapeError(data.error ?? "Couldn't fetch product data — fill in manually.");
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

    await supabase.from("items").update({
      product_url: url || PLACEHOLDER_URL,
      name,
      vendor: vendor || null,
      price: price ? parseFloat(price) : null,
      image_url: imageUrl || null,
      category,
      designer_note: note || null,
    }).eq("id", item.id);

    onDone();
  }

  return (
    <div className="rounded-lg border bg-secondary/20 p-4 space-y-3 col-span-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Edit item</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* URL + auto-fill */}
      <div className="space-y-1">
        <Label>Product URL</Label>
        <div className="flex gap-2">
          <Input
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
            {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {scraping ? "Fetching..." : "Auto-fill"}
          </Button>
        </div>
        {scrapeError && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{scrapeError}</p>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Vendor</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Pottery Barn" />
          </div>
          <div className="space-y-1">
            <Label>Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Image URL</Label>
            <Input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Auto-filled from URL"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Designer note (shown to client)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Perfect scale for this corner..."
              rows={2}
            />
          </div>
        </div>

        {imageUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Preview"
              className="h-28 w-auto object-contain rounded border"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={saving || !name}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ItemList({ items }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleDelete(itemId: string) {
    if (!confirm("Remove this item?")) return;
    await supabase.from("items").delete().eq("id", itemId);
    router.refresh();
  }

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No items yet. Click &ldquo;Add item&rdquo; to add the first one.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        if (editingId === item.id) {
          return (
            <EditItemForm
              key={item.id}
              item={item}
              onDone={() => { setEditingId(null); router.refresh(); }}
              onCancel={() => setEditingId(null)}
            />
          );
        }

        const needsSourcing = isPlaceholder(item);

        return (
          <div
            key={item.id}
            className="rounded-lg border bg-card overflow-hidden flex flex-col"
          >
            {item.image_url ? (
              <div className="relative h-40 bg-secondary/30">
                <Image
                  src={item.image_url}
                  alt={item.name}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            ) : (
              <div className="h-24 bg-secondary/30 flex items-center justify-center text-muted-foreground text-xs">
                {needsSourcing ? "Paste URL to source →" : "No image"}
              </div>
            )}
            <div className="p-3 flex flex-col gap-1 flex-1">
              <div className="flex items-start justify-between gap-1">
                <span className="text-sm font-medium leading-snug line-clamp-2">{item.name}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {categoryLabel[item.category] ?? item.category}
                </Badge>
              </div>
              {needsSourcing ? (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 self-start">
                  Needs sourcing
                </span>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {item.vendor && <span>{item.vendor}</span>}
                  {item.price !== null && (
                    <span className="font-medium text-foreground">{formatPrice(item.price)}</span>
                  )}
                </div>
              )}
              {item.designer_note && item.designer_note !== "To be sourced" && (
                <p className="text-xs text-muted-foreground italic line-clamp-2">{item.designer_note}</p>
              )}
              <div className="flex items-center gap-1 mt-auto pt-2">
                {!needsSourcing && (
                  <a
                    href={item.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View product
                  </a>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingId(item.id)}
                    title="Edit item"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(item.id)}
                    title="Delete item"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
