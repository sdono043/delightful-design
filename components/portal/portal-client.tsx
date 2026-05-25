"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { Item, Room } from "@/lib/types";

interface RoomWithItems extends Room {
  items: Item[];
}

interface ExistingSelection {
  item_id: string;
  selected: boolean;
  client_note: string | null;
}

interface Props {
  tokenId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  rooms: RoomWithItems[];
  existingSelections: ExistingSelection[];
  alreadySubmitted: boolean;
}

const categoryLabel: Record<string, string> = {
  furniture: "Furniture",
  wall_finish: "Wall finish",
  fixture: "Fixture",
  textile: "Textile",
  accessory: "Accessory",
  other: "Other",
};

export function PortalClient({
  tokenId,
  projectId,
  projectName,
  clientName,
  rooms,
  existingSelections,
  alreadySubmitted: initiallySubmitted,
}: Props) {
  // Build selection state from existing
  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const sel of existingSelections) {
      map[sel.item_id] = sel.selected;
    }
    return map;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const sel of existingSelections) {
      if (sel.client_note) map[sel.item_id] = sel.client_note;
    }
    return map;
  });

  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggleItem(itemId: string) {
    setSelections((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function toggleNote(itemId: string) {
    setNoteOpen((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  const selectedCount = Object.values(selections).filter(Boolean).length;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch("/api/portal/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId,
        projectId,
        selections: Object.entries(selections).map(([item_id, selected]) => ({
          item_id,
          selected,
          client_note: notes[item_id] || null,
        })),
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json();
      setSubmitError(data.error ?? "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-semibold mb-2">
            Selections submitted!
          </h1>
          <p className="text-muted-foreground text-sm">
            Thank you, {clientName}. Your selections for <strong>{projectName}</strong> have been sent to your designer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <span className="font-serif text-lg font-semibold tracking-wide">Ann Merideth Design</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {clientName} &middot; {projectName}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-semibold mb-1">
            Hi {clientName.split(" ")[0]}, your selections are ready
          </h1>
          <p className="text-muted-foreground text-sm">
            Review the options below, select the ones you love, add notes if you&apos;d like, and click Submit when done.
          </p>
        </div>

        {/* Rooms */}
        <div className="space-y-10">
          {rooms.map((room) => (
            <div key={room.id}>
              <h2 className="font-serif text-xl font-semibold mb-4 pb-2 border-b">
                {room.name}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {room.items.map((item) => {
                  const isSelected = !!selections[item.id];
                  const hasNote = !!notes[item.id];
                  const showNote = noteOpen[item.id];

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border bg-card overflow-hidden flex flex-col transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 shadow-md"
                          : "hover:shadow-md"
                      }`}
                      onClick={() => toggleItem(item.id)}
                    >
                      {/* Image */}
                      <div className="relative h-48 bg-secondary/30 flex-shrink-0">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-contain p-3"
                            unoptimized
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                            No image
                          </div>
                        )}
                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-4 flex flex-col gap-2 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm leading-snug">{item.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {categoryLabel[item.category] ?? item.category}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {item.vendor && (
                            <span className="text-muted-foreground">{item.vendor}</span>
                          )}
                          {item.price !== null && (
                            <span className="font-semibold">{formatPrice(item.price)}</span>
                          )}
                        </div>

                        {item.designer_note && (
                          <p className="text-xs text-muted-foreground italic">
                            {item.designer_note}
                          </p>
                        )}

                        {/* Footer actions */}
                        <div
                          className="flex items-center gap-2 mt-auto pt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={item.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </a>
                          <button
                            onClick={() => toggleNote(item.id)}
                            className={`flex items-center gap-1 text-xs ml-auto transition-colors ${
                              hasNote ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {hasNote ? "Edit note" : "Add note"}
                          </button>
                        </div>

                        {/* Note field */}
                        {showNote && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Textarea
                              placeholder="Leave a note for your designer..."
                              value={notes[item.id] ?? ""}
                              onChange={(e) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              rows={2}
                              className="text-xs mt-1"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky submit bar */}
        <div className="sticky bottom-0 left-0 right-0 mt-12 -mx-4 px-4 py-4 bg-card/90 backdrop-blur border-t">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedCount}</span>{" "}
              item{selectedCount !== 1 ? "s" : ""} selected
            </p>
            <div className="flex items-center gap-3">
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={submitting || selectedCount === 0}
                size="lg"
              >
                {submitting ? "Submitting..." : "Submit selections"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
