"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StampMark } from "@/app/StampMark";
import { sha256OfFile, sha256OfText } from "@/lib/clientHash";

type InputMode = "file" | "text";

type CreateResult = {
  receiptId: number;
  txHash: string;
};

const ERROR_COPY: Record<string, string> = {
  DuplicateFileHash: "This exact file has already been stamped. Each delivery can only be stamped once.",
  InvalidDueDate: "That due date is in the past. Pick today or a future date, or leave it blank.",
  EmptyClientName: "Client name can't be empty.",
};

function friendlyError(error: string): string {
  return ERROR_COPY[error] ?? error;
}

export default function NewReceiptPage() {
  const [mode, setMode] = useState<InputMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [fileHash, setFileHash] = useState<`0x${string}` | null>(null);
  const [hashing, setHashing] = useState(false);

  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFileHash(null);
    if (mode === "file") {
      if (!file) return;
      setHashing(true);
      sha256OfFile(file)
        .then(setFileHash)
        .finally(() => setHashing(false));
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!pastedText.trim()) return;
    debounceRef.current = setTimeout(() => {
      setHashing(true);
      sha256OfText(pastedText)
        .then(setFileHash)
        .finally(() => setHashing(false));
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mode, file, pastedText]);

  const canSubmit =
    !!fileHash && !hashing && !submitting && clientName.trim().length > 0 && description.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileHash) return;

    setSubmitting(true);
    setError(null);

    const dueDateSeconds = dueDate ? Math.floor(new Date(`${dueDate}T00:00:00Z`).getTime() / 1000) : 0;

    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileHash,
          clientName: clientName.trim(),
          description: description.trim(),
          dueDate: dueDateSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(friendlyError(data.error ?? "Something went wrong."));
        return;
      }
      setResult({ receiptId: data.receiptId, txHash: data.txHash });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/receipt/${result.receiptId}` : "";
    return (
      <div className="mx-auto flex max-w-md flex-col items-center space-y-6 py-6 text-center">
        <StampMark receiptId={result.receiptId} className="stamp-press-animate" />

        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Receipt #{String(result.receiptId).padStart(4, "0")} is stamped
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Share this link with your client — it proves exactly what was sent and when.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col items-stretch gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="shrink-0 rounded-md bg-sky px-3 py-2 text-sm font-medium text-white hover:bg-sky-dark"
          >
            Copy link
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          <Link href={`/receipt/${result.receiptId}`} className="text-sky hover:underline">
            View public receipt →
          </Link>
          <Link href="/" className="text-ink-muted hover:text-ink">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Prove you sent it</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Fingerprint the delivery and lock a timestamp onchain. Nothing but the fingerprint ever leaves your browser.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`rounded-md px-3 py-2 ${
                mode === "file" ? "bg-ink text-paper" : "border border-border text-ink-muted"
              }`}
            >
              Upload a file
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`rounded-md px-3 py-2 ${
                mode === "text" ? "bg-ink text-paper" : "border border-border text-ink-muted"
              }`}
            >
              Paste text or a link
            </button>
          </div>

          {mode === "file" ? (
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-md border border-border p-3 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-paper"
            />
          ) : (
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the delivered content, a summary, or a link to it..."
              rows={5}
              className="block w-full rounded-md border border-border p-3 text-sm text-ink outline-none"
            />
          )}

          <p className="mt-2 font-mono text-xs text-ink-muted">
            {hashing && "Fingerprinting..."}
            {!hashing && fileHash && `Fingerprint: ${fileHash.slice(0, 10)}…${fileHash.slice(-8)}`}
            {!hashing && !fileHash && "No fingerprint yet — add a file or paste content above."}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Client name</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Corp"
            required
            className="block w-full rounded-md border border-border p-3 text-sm text-ink outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">What is this?</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Homepage draft v2"
            required
            className="block w-full rounded-md border border-border p-3 text-sm text-ink outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Due date (optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="block w-full rounded-md border border-border p-3 text-sm text-ink outline-none sm:w-56"
          />
        </div>

        {error && (
          <div className="rounded-md border border-stamp/30 bg-stamp/5 p-3 text-sm text-stamp">{error}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-sky px-4 py-3 font-medium text-white hover:bg-sky-dark disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {submitting ? "Stamping..." : "Stamp it"}
        </button>
      </form>
    </div>
  );
}
