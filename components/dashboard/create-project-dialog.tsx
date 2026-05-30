"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Wand2, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { ListingImportResult } from "@/app/api/import-listing/route";

interface Props {
  designerId: string;
}

export function CreateProjectDialog({ designerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ListingImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  function reset() {
    setClientName("");
    setClientEmail("");
    setProjectName("");
    setNotes("");
    setListingUrl("");
    setListingText("");
    setShowPasteFallback(false);
    setImportResult(null);
    setImportError(null);
    setError(null);
    setImages([]);
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const toBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    const encoded = await Promise.all(Array.from(files).map(toBase64));
    setImages((prev) => [...prev, ...encoded].slice(0, 5));
    setImportResult(null);
  }

  async function handleImport(useText = false) {
    if (!useText && !listingUrl.trim()) return;
    if (useText && !listingText.trim()) return;

    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    const body = useText
      ? { text: listingText, notes: notes || undefined, images: images.length ? images : undefined }
      : { url: listingUrl, notes: notes || undefined, images: images.length ? images : undefined };

    const res = await fetch("/api/import-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error === "scrape_failed") {
        // Zillow/Redfin blocked scraping — show paste fallback
        setShowPasteFallback(true);
        setImportError(null);
      } else {
        setImportError(data.error ?? "Failed to import listing.");
      }
    } else {
      setImportResult(data);
      setShowPasteFallback(false);
    }
    setImportLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Create or find client
    let clientId: string;
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("designer_id", designerId)
      .eq("email", clientEmail)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ designer_id: designerId, name: clientName, email: clientEmail })
        .select("id")
        .single();

      if (clientError || !newClient) {
        setError("Failed to create client. " + clientError?.message);
        setLoading(false);
        return;
      }
      clientId = newClient.id;
    }

    // Create project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        designer_id: designerId,
        client_id: clientId,
        name: projectName,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      setError("Failed to create project. " + projectError?.message);
      setLoading(false);
      return;
    }

    // If we have an import result, create rooms and placeholder items
    if (importResult?.rooms?.length) {
      for (let i = 0; i < importResult.rooms.length; i++) {
        const room = importResult.rooms[i];
        const { data: newRoom } = await supabase
          .from("rooms")
          .insert({
            project_id: project.id,
            name: room.name,
            display_order: i,
          })
          .select("id")
          .single();

        if (newRoom && room.categories?.length) {
          const items = room.categories.map((cat) => ({
            room_id: newRoom.id,
            category: mapCategory(cat),
            name: cat,
            product_url: "https://placeholder.com",
            designer_note: "To be sourced",
          }));
          await supabase.from("items").insert(items);
        }
      }
    }

    setOpen(false);
    reset();
    router.push(`/dashboard/projects/${project.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New project
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl font-semibold">New project</h2>
          <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="Smith Residence — Full Home"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Client */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client name</Label>
              <Input
                id="client-name"
                placeholder="Jane Smith"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">Client email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="jane@email.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Listing import — optional */}
          <div className="space-y-2">
            <Label>
              Property listing{" "}
              <span className="text-muted-foreground font-normal">(optional — auto-generates rooms)</span>
            </Label>

            {!showPasteFallback ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="Zillow, Redfin, Realtor.com link..."
                    value={listingUrl}
                    onChange={(e) => {
                      setListingUrl(e.target.value);
                      setImportResult(null);
                      setImportError(null);
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleImport(false)}
                    disabled={importLoading || !listingUrl.trim()}
                  >
                    {importLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {importLoading ? "Analyzing..." : "Import"}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasteFallback(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Or paste listing description instead
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                  This listing site blocks automated access. Copy the property description from the listing page and paste it below.
                </p>
                <Textarea
                  placeholder="Paste the full listing description here — include bed/bath count, room names, square footage, etc."
                  value={listingText}
                  onChange={(e) => {
                    setListingText(e.target.value);
                    setImportResult(null);
                  }}
                  rows={5}
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleImport(true)}
                    disabled={importLoading || !listingText.trim()}
                  >
                    {importLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {importLoading ? "Analyzing..." : "Generate rooms"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setShowPasteFallback(false); setListingText(""); setImportResult(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Use URL instead
                  </button>
                </div>
              </div>
            )}

            {/* Room photo uploads */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Upload room photos <span className="font-normal">(optional — helps Claude suggest specific quantities)</span>
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                {images.map((src, i) => (
                  <div key={i} className="relative h-14 w-14 rounded overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-14 w-14 rounded border border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageFiles(e.target.files)}
                />
              </div>
            </div>

            {importError && (
              <p className="text-xs text-red-600">{importError}</p>
            )}
          </div>

          {/* Import result preview */}
          {importResult && (
            <div className="rounded-lg border bg-secondary/40 p-4 space-y-3">
              <p className="text-xs text-muted-foreground italic">{importResult.propertyDescription}</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proposed rooms & sourcing categories
                </p>
                {importResult.rooms.map((room, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{room.name}</span>
                    <span className="text-muted-foreground"> — {room.categories.join(", ")}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These rooms and placeholder items will be created. You&apos;ll fill in the actual product URLs.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="notes"
              placeholder="Project scope, style direction, budget..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function mapCategory(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("wall") || lower.includes("paint") || lower.includes("wallpaper")) return "wall_finish";
  if (lower.includes("light") || lower.includes("lamp") || lower.includes("fixture") || lower.includes("sconce")) return "fixture";
  if (lower.includes("rug") || lower.includes("curtain") || lower.includes("drape") || lower.includes("pillow") || lower.includes("throw")) return "textile";
  if (lower.includes("art") || lower.includes("mirror") || lower.includes("plant") || lower.includes("vase") || lower.includes("decor")) return "accessory";
  return "furniture";
}
