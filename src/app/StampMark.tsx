export function StampMark({
  receiptId,
  rotate = -8,
  className = "",
}: {
  /** Omit for a purely decorative stamp (e.g. marketing hero) with no receipt number shown. */
  receiptId?: number;
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-sky text-sky ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="absolute inset-1.5 rounded-full border border-sky/50" />
      <span className="font-display text-[11px] font-bold uppercase tracking-widest">Verified</span>
      {receiptId !== undefined && (
        <span className="mt-0.5 font-mono text-xs">#{String(receiptId).padStart(4, "0")}</span>
      )}
    </div>
  );
}
