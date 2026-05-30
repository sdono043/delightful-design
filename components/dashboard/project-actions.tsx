"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Copy, CheckCheck, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/lib/types";
import Link from "next/link";

interface Props {
  projectId: string;
  status: ProjectStatus;
  clientEmail: string;
  unsourcedCount: number;
  token: {
    token: string;
    submitted_at: string | null;
  } | null;
}

export function ProjectActions({ projectId, status, clientEmail, unsourcedCount, token }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (
      unsourcedCount > 0 &&
      !confirm(
        `${unsourcedCount} item${unsourcedCount !== 1 ? "s" : ""} still need sourcing and won't appear in the client portal. Send anyway?`
      )
    ) {
      return;
    }
    setSending(true);
    setError(null);

    const res = await fetch("/api/send-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to send link");
    } else {
      router.refresh();
    }
    setSending(false);
  }

  async function handleCopy() {
    if (!token) return;
    const url = `${window.location.origin}/portal/${token.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {token?.submitted_at && (
        <Link href={`/dashboard/projects/${projectId}/purchase-list`}>
          <Button variant="default">
            <ShoppingCart className="h-4 w-4" />
            Purchase list
          </Button>
        </Link>
      )}

      {token && (
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy link"}
        </Button>
      )}

      <Button
        onClick={handleSend}
        disabled={sending}
        variant={status === "draft" ? "default" : "outline"}
        size={status === "draft" ? "default" : "sm"}
      >
        <Send className="h-4 w-4" />
        {sending
          ? "Sending..."
          : status === "draft"
          ? `Send to ${clientEmail}`
          : "Resend link"}
      </Button>
    </div>
  );
}
