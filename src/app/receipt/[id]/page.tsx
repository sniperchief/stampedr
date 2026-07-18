import { BaseError, ContractFunctionRevertedError } from "viem";
import { StampMark } from "@/app/StampMark";
import { MONAD_TESTNET_EXPLORER } from "@/lib/chain";
import { formatDateOnly, formatUnixSeconds } from "@/lib/format";
import {
  fetchBlockState,
  fetchCreationInfo,
  fetchReceipt,
  fetchReceiptIdsByCreator,
  receiptDisplayNumber,
} from "@/lib/receipts";

// This page must reflect real chain state on every visit, never a cached snapshot.
export const dynamic = "force-dynamic";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName === "ReceiptNotFound";
    }
  }
  return false;
}

export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receiptId = Number(id);

  if (!Number.isInteger(receiptId) || receiptId <= 0) {
    return <NotFound />;
  }

  let receipt;
  try {
    receipt = await fetchReceipt(receiptId);
  } catch (error) {
    if (isNotFoundError(error)) return <NotFound />;
    return <LoadError />;
  }

  const creation = await fetchCreationInfo(receiptId);
  const blockState = creation ? await fetchBlockState(creation.blockNumber) : null;
  const creatorIds = await fetchReceiptIdsByCreator(receipt.creator as `0x${string}`);
  const displayNumber = receiptDisplayNumber(creatorIds, receiptId);

  const hasDueDate = receipt.dueDate > 0;
  const deliveredOnTime = hasDueDate ? receipt.createdAt <= receipt.dueDate : null;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="perforated w-full max-w-md border border-border bg-paper px-8 pb-8 pt-10 shadow-[0_1px_3px_rgba(28,27,25,0.08)]">
        <h1 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-ink">
          Stampedr — Receipt #{String(displayNumber).padStart(4, "0")}
        </h1>

        <dl className="mt-8 space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-muted">Delivered to</dt>
            <dd className="min-w-0 flex-1 break-words text-ink">{receipt.clientName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-muted">What</dt>
            <dd className="min-w-0 flex-1 break-words text-ink">{receipt.description}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-muted">Sent</dt>
            <dd className="font-mono text-xs text-ink">{formatUnixSeconds(receipt.createdAt)}</dd>
          </div>
          {hasDueDate && (
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-ink-muted">Due</dt>
              <dd className="text-ink">
                {formatDateOnly(receipt.dueDate)}{" "}
                <span className={deliveredOnTime ? "text-sky" : "text-stamp"}>
                  ({deliveredOnTime ? "on time" : "after due date"})
                </span>
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-ink-muted">Hash</dt>
            <dd className="font-mono text-xs text-ink" title={receipt.fileHash}>
              {truncateHash(receipt.fileHash)}
            </dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-col items-center">
          <StampMark receiptId={displayNumber} />
          <p className="mt-4 text-center text-sm text-ink-muted">
            verified unchanged
            <br />
            since {formatDateOnly(receipt.createdAt)}
          </p>
          {blockState && !blockState.finalized && (
            <p className="mt-1 text-center text-xs text-ink-muted">finalizing...</p>
          )}
        </div>

        {creation && (
          <div className="mt-8 text-center">
            <a
              href={`${MONAD_TESTNET_EXPLORER}/tx/${creation.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sky hover:underline"
            >
              View the permanent record →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-xl font-semibold text-ink">Receipt not found</h1>
        <p className="mt-2 text-sm text-ink-muted">This receipt doesn&apos;t exist or the link is incorrect.</p>
      </div>
    </div>
  );
}

function LoadError() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-xl font-semibold text-ink">Couldn&apos;t load this receipt</h1>
        <p className="mt-2 text-sm text-ink-muted">Please try again in a moment.</p>
      </div>
    </div>
  );
}
