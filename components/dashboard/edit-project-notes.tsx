"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface Props {
  projectId: string;
  notes: string | null;
}

export function EditProjectNotes({ projectId, notes: initialNotes }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase.from("projects").update({ notes: value || null }).eq("id", projectId);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-start gap-2 mt-1">
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Style direction, budget, scope..."
          rows={2}
          className="text-sm flex-1"
        />
        <div className="flex flex-col gap-1">
          <Button size="icon" className="h-7 w-7" onClick={handleSave} disabled={saving}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setValue(initialNotes ?? ""); setEditing(false); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 hover:text-foreground group"
    >
      {initialNotes ? (
        <span className="italic">{initialNotes}</span>
      ) : (
        <span>Add notes...</span>
      )}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
    </button>
  );
}
