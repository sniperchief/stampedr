"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkPaidButton({ receiptId }: { receiptId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/paid`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to mark as paid.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-border px-3 py-2 text-xs font-medium text-ink hover:border-sky hover:text-sky disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Marking..." : "Mark as paid"}
      </button>
      {error && <p className="text-xs text-stamp">{error}</p>}
    </div>
  );
}
