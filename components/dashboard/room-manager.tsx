"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  rooms: RoomWithItems[];
}

export function RoomManager({ projectId, rooms: initialRooms }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [newRoomName, setNewRoomName] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(
    () => new Set(initialRooms.map((r) => r.id))
  );
  const [addingItemToRoom, setAddingItemToRoom] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {initialRooms.map((room) => (
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
            <CardContent className="pt-0">
              {addingItemToRoom === room.id && (
                <div className="mb-4">
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
      ))}

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
