import { getAbiItem } from "viem";
import { publicClient } from "./chain";
import { STAMPED_ABI, STAMPED_CONTRACT_ADDRESS, STAMPED_DEPLOY_BLOCK } from "./contract";

const receiptCreatedEvent = getAbiItem({ abi: STAMPED_ABI, name: "ReceiptCreated" });

export type SerializedReceipt = {
  id: number;
  fileHash: string;
  creator: string;
  clientName: string;
  description: string;
  dueDate: number;
  createdAt: number;
  paid: boolean;
};

export async function fetchReceipt(id: number): Promise<SerializedReceipt> {
  const r = await publicClient.readContract({
    address: STAMPED_CONTRACT_ADDRESS,
    abi: STAMPED_ABI,
    functionName: "getReceipt",
    args: [BigInt(id)],
  });

  return {
    id,
    fileHash: r.fileHash,
    creator: r.creator,
    clientName: r.clientName,
    description: r.description,
    dueDate: Number(r.dueDate),
    createdAt: Number(r.createdAt),
    paid: r.paid,
  };
}

export async function fetchReceiptIdsByCreator(creator: `0x${string}`): Promise<number[]> {
  const ids = await publicClient.readContract({
    address: STAMPED_CONTRACT_ADDRESS,
    abi: STAMPED_ABI,
    functionName: "getReceiptsByCreator",
    args: [creator],
  });
  return ids.map((id) => Number(id));
}

/**
 * Receipt ids are a single counter shared across every creator on the
 * contract, so a brand-new user's first-ever receipt can land on a high
 * number (e.g. #0047) just because other freelancers used the app before
 * them. `creatorIds` (from fetchReceiptIdsByCreator, already in creation
 * order) lets us show each freelancer their own 1-indexed sequence instead
 * — the on-chain id remains the real identifier for lookups/URLs.
 */
export function receiptDisplayNumber(creatorIds: number[], id: number): number {
  const index = creatorIds.indexOf(id);
  return index === -1 ? id : index + 1;
}

export type CreationInfo = { txHash: `0x${string}`; blockNumber: bigint };

const LOG_RANGE_CHUNK = 100n; // Monad's public testnet RPC caps eth_getLogs to a 100-block range per call.
const MAX_CHUNKS_TO_SCAN = 20; // ~2000 blocks back (well over a minute of chain history) before giving up.

/**
 * Finds the tx that created a receipt by reading its on-chain event log
 * directly — no off-chain index needed. Scans backward from the latest
 * block in bounded windows (see LOG_RANGE_CHUNK). Receipts created recently
 * (the common case right after stamping one) resolve in a single call;
 * very old receipts beyond the scan window return null rather than making
 * an unbounded number of requests.
 */
export async function fetchCreationInfo(id: number): Promise<CreationInfo | null> {
  const latest = await publicClient.getBlockNumber();
  let to = latest;

  for (let i = 0; i < MAX_CHUNKS_TO_SCAN; i++) {
    const from = to - LOG_RANGE_CHUNK + 1n > STAMPED_DEPLOY_BLOCK ? to - LOG_RANGE_CHUNK + 1n : STAMPED_DEPLOY_BLOCK;

    const logs = await publicClient.getLogs({
      address: STAMPED_CONTRACT_ADDRESS,
      event: receiptCreatedEvent,
      args: { receiptId: BigInt(id) },
      fromBlock: from,
      toBlock: to,
    });
    const log = logs[0];
    if (log) return { txHash: log.transactionHash, blockNumber: log.blockNumber };

    if (from <= STAMPED_DEPLOY_BLOCK) break;
    to = from - 1n;
  }

  return null;
}

export type BlockState = {
  txBlockNumber: number;
  latestBlockNumber: number;
  confirmations: number;
  finalized: boolean;
};

/**
 * Monad's consensus progresses blocks through Proposed -> Voted -> Finalized
 * -> Verified, with a ~3-block-delayed state view under async execution. We
 * don't have confirmed support for the 'finalized' block tag on Monad's
 * testnet RPC, and a tag it doesn't recognize can hang rather than fail
 * fast — so we use a confirmation-depth heuristic instead of an unverified
 * RPC call.
 */
export async function fetchBlockState(txBlockNumber: bigint): Promise<BlockState> {
  const latestBlockNumber = await publicClient.getBlockNumber();
  const confirmations = latestBlockNumber - txBlockNumber;

  return {
    txBlockNumber: Number(txBlockNumber),
    latestBlockNumber: Number(latestBlockNumber),
    confirmations: Number(confirmations),
    finalized: confirmations >= 3n,
  };
}
