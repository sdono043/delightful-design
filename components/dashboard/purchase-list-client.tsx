"use client";

import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, generateCsv } from "@/lib/utils";

interface SelectionRow {
  id: string;
  client_note: string | null;
  items: {
    name: string;
    vendor: string | null;
    price: number | null;
    product_url: string;
    category: string;
    rooms: { name: string } | null;
  } | null;
}

interface Props {
  projectName: string;
  clientName: string;
  selections: SelectionRow[];
}

export function PurchaseListClient({ projectName, clientName, selections }: Props) {
  // Group by room
  const byRoom = new Map<string, SelectionRow[]>();
  for (const sel of selections) {
    const roomName = sel.items?.rooms?.name ?? "Uncategorized";
    if (!byRoom.has(roomName)) byRoom.set(roomName, []);
    byRoom.get(roomName)!.push(sel);
  }

  const grandTotal = selections.reduce(
    (sum, sel) => sum + (sel.items?.price ?? 0),
    0
  );

  function handleDownload() {
    const rows: string[][] = [
      ["Room", "Item", "Vendor", "Price", "URL", "Client Note"],
    ];
    for (const [room, sels] of byRoom) {
      for (const sel of sels) {
        rows.push([
          room,
          sel.items?.name ?? "",
          sel.items?.vendor ?? "",
          sel.items?.price != null ? String(sel.items.price) : "",
          sel.items?.product_url ?? "",
          sel.client_note ?? "",
        ]);
      }
    }
    rows.push(["", "", "TOTAL", String(grandTotal), "", ""]);

    const csv = generateCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${projectName.replace(/\s+/g, "-")}-purchase-list.csv`;
    a.click();
    URL.revokeObjectURL(href);
  }

  if (!selections.length) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>No selections submitted yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="space-y-8">
        {Array.from(byRoom.entries()).map(([room, sels]) => {
          const roomTotal = sels.reduce((sum, s) => sum + (s.items?.price ?? 0), 0);
          return (
            <div key={room}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-lg font-semibold">{room}</h2>
                <span className="text-sm text-muted-foreground">
                  Subtotal: {formatPrice(roomTotal)}
                </span>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Item</th>
                      <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
                      <th className="text-right px-4 py-2.5 font-medium">Price</th>
                      <th className="text-left px-4 py-2.5 font-medium">Note</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sels.map((sel, i) => (
                      <tr
                        key={sel.id}
                        className={i % 2 === 0 ? "bg-card" : "bg-secondary/20"}
                      >
                        <td className="px-4 py-3 font-medium">{sel.items?.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sel.items?.vendor ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {formatPrice(sel.items?.price ?? null)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs italic max-w-xs truncate">
                          {sel.client_note ?? ""}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={sel.items?.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Buy
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grand total */}
      <div className="mt-8 flex justify-end">
        <div className="rounded-lg border bg-card px-6 py-4 text-right">
          <p className="text-sm text-muted-foreground">Estimated total</p>
          <p className="font-serif text-2xl font-semibold">{formatPrice(grandTotal)}</p>
        </div>
      </div>
    </div>
  );
}
