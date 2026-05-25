"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";
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

export function ItemList({ items }: Props) {
  const router = useRouter();
  const supabase = createClient();

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
      {items.map((item) => (
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
              No image
            </div>
          )}
          <div className="p-3 flex flex-col gap-1 flex-1">
            <div className="flex items-start justify-between gap-1">
              <span className="text-sm font-medium leading-snug line-clamp-2">{item.name}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {categoryLabel[item.category] ?? item.category}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {item.vendor && <span>{item.vendor}</span>}
              {item.price !== null && (
                <span className="font-medium text-foreground">{formatPrice(item.price)}</span>
              )}
            </div>
            {item.designer_note && (
              <p className="text-xs text-muted-foreground italic line-clamp-2">{item.designer_note}</p>
            )}
            <div className="flex items-center gap-1 mt-auto pt-2">
              <a
                href={item.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View product
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto text-muted-foreground hover:text-red-600"
                onClick={() => handleDelete(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
