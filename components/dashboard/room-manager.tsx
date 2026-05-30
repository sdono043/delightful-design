"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronUp, Camera, X, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemList } from "@/components/dashboard/item-list";
import { AddItemForm } from "@/components/dashboard/add-item-form";
import { createClient } from "@/lib/supabase/client";
import type { Item, Room } from "@/lib/types";

interface RoomWithItems extends Room {
  items: Item[];
}

interface Props {
  projectId: string;
  projectNotes?: string | null;
  rooms: RoomWithItems[];
}

type RoomAnalysis = {
  images: string[];
  analyzing: boolean;
  suggestions: string[] | null;
  selected: Set<number>;
  error: string | null;
};

function emptyAnalysis(): RoomAnalysis {
  return { images: [], analyzing: false, suggestions: null, selected: new Set(), error: null };
}

function mapCategory(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("wall") || lower.includes("paint") || lower.includes("wallpaper")) return "wall_finish";
  if (lower.includes("light") || lower.includes("lamp") || lower.includes("fixture") || lower.includes("sconce")) return "fixture";
  if (lower.includes("rug") || lower.includes("curtain") || lower.includes("drape") || lower.includes("pillow") || lower.includes("throw")) return "textile";
  if (lower.includes("art") || lower.includes("mirror") || lower.includes("plant") || lower.includes("vase") || lower.includes("decor")) return "accessory";
  return "furniture";
}

export function RoomManager({ projectId, projectNotes, rooms: initialRooms }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [newRoomName, setNewRoomName] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(
    () => new Set(initialRooms.map((r) => r.id))
  );
  const [addingItemToRoom, setAddingItemToRoom] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState<Set<string>>(new Set());
  const [roomAnalysis, setRoomAnalysis] = useState<Map<string, RoomAnalysis>>(new Map());

  function getAnalysis(roomId: string): RoomAnalysis {
    return roomAnalysis.get(roomId) ?? emptyAnalysis();
  }

  function patchAnalysis(roomId: string, patch: Partial<RoomAnalysis>) {
    setRoomAnalysis((prev) => {
      const next = new Map(prev);
      next.set(roomId, { ...(next.get(roomId) ?? emptyAnalysis()), ...patch });
      return next;
    });
  }

  function toggleAnalysis(roomId: string) {
    setAnalysisOpen((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
        if (!roomAnalysis.has(roomId)) {
          setRoomAnalysis((m) => new Map(m).set(roomId, emptyAnalysis()));
        }
      }
      return next;
    });
  }

  async function handleRoomImages(roomId: string, files: FileList | null) {
    if (!files?.length) return;
    const toBase64 = (f: File): Promise<string> =>
      new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
    const encoded = await Promise.all(Array.from(files).map(toBase64));
    patchAnalysis(roomId, {
      images: [...getAnalysis(roomId).images, ...encoded].slice(0, 5),
      suggestions: null,
    });
  }

  async function handleAnalyze(room: RoomWithItems) {
    const state = getAnalysis(room.id);
    if (!state.images.length) return;

    patchAnalysis(room.id, { analyzing: true, error: null, suggestions: null });

    const res = await fetch("/api/analyze-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: room.name,
        projectNotes: projectNotes || undefined,
        existingItems: room.items.map((i) => i.name),
        images: state.images,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.suggestions) {
      patchAnalysis(room.id, { analyzing: false, error: data.error ?? "Analysis failed." });
    } else {
      const suggestions: string[] = data.suggestions;
      patchAnalysis(room.id, {
        analyzing: false,
        suggestions,
        selected: new Set(suggestions.map((_, i) => i)),
      });
    }
  }

  async function handleAddSuggestions(room: RoomWithItems) {
    const state = getAnalysis(room.id);
    if (!state.suggestions) return;

    const toAdd = state.suggestions.filter((_, i) => state.selected.has(i));
    if (!toAdd.length) return;

    const items = toAdd.map((name) => ({
      room_id: room.id,
      category: mapCategory(name),
      name,
      product_url: "https://placeholder.com",
      designer_note: "To be sourced",
    }));

    await supabase.from("items").insert(items);
    setAnalysisOpen((prev) => { const next = new Set(prev); next.delete(room.id); return next; });
    setRoomAnalysis((prev) => { const next = new Map(prev); next.delete(room.id); return next; });
    router.refresh();
  }

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setLoading(true);

    await supabase.from("rooms").insert({
      project_id: projectId,
      name: newRoomName.trim(),
      display_order: initialRooms.length,
    });

    setNewRoomName("");
    setAddingRoom(false);
    setLoading(false);
    router.refresh();
  }

  async function handleDeleteRoom(roomId: string) {
    if (!confirm("Delete this room and all its items?")) return;
    await supabase.from("rooms").delete().eq("id", roomId);
    router.refresh();
  }

  function toggleRoom(roomId: string) {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function toggleSuggestion(roomId: string, index: number) {
    const state = getAnalysis(roomId);
    const next = new Set(state.selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    patchAnalysis(roomId, { selected: next });
  }

  return (
    <div className="space-y-4">
      {initialRooms.map((room) => {
        const analysis = getAnalysis(room.id);
        const panelOpen = analysisOpen.has(room.id);

        return (
          <Card key={room.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleRoom(room.id)}
                  className="flex items-center gap-2 text-left hover:opacity-80"
                >
                  <CardTitle className="text-base">{room.name}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {room.items.length} item{room.items.length !== 1 ? "s" : ""}
                  </span>
                  {expandedRooms.has(room.id) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAnalysis(room.id)}
                    title="Analyze room with photos"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Analyze
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAddingItemToRoom(addingItemToRoom === room.id ? null : room.id)
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDeleteRoom(room.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedRooms.has(room.id) && (
              <CardContent className="pt-0 space-y-4">
                {/* Photo analysis panel */}
                {panelOpen && (
                  <div className="rounded-lg border bg-secondary/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Analyze with room photos</p>
                      <button
                        onClick={() => toggleAnalysis(room.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload photos of the space — Claude will suggest specific items based on the room&apos;s scale and layout.
                    </p>

                    {/* Photo thumbnails + upload */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {analysis.images.map((src, i) => (
                        <div key={i} className="relative h-14 w-14 rounded overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() =>
                              patchAnalysis(room.id, {
                                images: analysis.images.filter((_, idx) => idx !== i),
                                suggestions: null,
                              })
                            }
                            className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {analysis.images.length < 5 && (
                        <label
                          htmlFor={`room-photos-${room.id}`}
                          className="h-14 w-14 rounded border border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors cursor-pointer"
                        >
                          <Camera className="h-5 w-5" />
                          <input
                            id={`room-photos-${room.id}`}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleRoomImages(room.id, e.target.files)}
                          />
                        </label>
                      )}
                    </div>

                    {/* Analyze button */}
                    {analysis.images.length > 0 && !analysis.suggestions && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAnalyze(room)}
                        disabled={analysis.analyzing}
                      >
                        {analysis.analyzing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5" />
                        )}
                        {analysis.analyzing ? "Analyzing..." : "Generate suggestions"}
                      </Button>
                    )}

                    {analysis.error && (
                      <p className="text-xs text-red-600">{analysis.error}</p>
                    )}

                    {/* Suggestions */}
                    {analysis.suggestions && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Suggested items — select to add
                        </p>
                        <div className="space-y-1">
                          {analysis.suggestions.map((s, i) => (
                            <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={analysis.selected.has(i)}
                                onChange={() => toggleSuggestion(room.id, i)}
                                className="rounded"
                              />
                              {s}
                            </label>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddSuggestions(room)}
                          disabled={analysis.selected.size === 0}
                        >
                          Add {analysis.selected.size} item{analysis.selected.size !== 1 ? "s" : ""} to room
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Add item form */}
                {addingItemToRoom === room.id && (
                  <div>
                    <AddItemForm
                      roomId={room.id}
                      onDone={() => {
                        setAddingItemToRoom(null);
                        router.refresh();
                      }}
                      onCancel={() => setAddingItemToRoom(null)}
                    />
                  </div>
                )}
                <ItemList items={room.items} />
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add room */}
      {addingRoom ? (
        <form onSubmit={handleAddRoom} className="flex gap-2">
          <Input
            autoFocus
            placeholder="Room name (e.g. Living Room)"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAddingRoom(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setAddingRoom(true)}
        >
          <Plus className="h-4 w-4" />
          Add room
        </Button>
      )}
    </div>
  );
}
