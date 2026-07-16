import { NextRequest, NextResponse } from "next/server";
import { BaseError, ContractFunctionRevertedError, decodeEventLog } from "viem";
import { getCurrentUser } from "@/lib/auth";
import { publicClient } from "@/lib/chain";
import { STAMPED_ABI, STAMPED_CONTRACT_ADDRESS } from "@/lib/contract";
import { estimateGasWithBuffer } from "@/lib/gas";
import { fetchReceipt, fetchReceiptIdsByCreator } from "@/lib/receipts";
import { getUserWalletClient } from "@/lib/serverWallet";
import { decryptPrivateKey } from "@/lib/walletEncryption";
import { prisma } from "@/lib/db";

function revertReason(error: unknown): string | null {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName ?? revertError.reason ?? null;
    }
  }
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const ids = await fetchReceiptIdsByCreator(user.walletAddress);
    const receipts = await Promise.all(ids.map((id) => fetchReceipt(id)));
    return NextResponse.json({ receipts });
  } catch {
    return NextResponse.json({ error: "Failed to read receipts from chain" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fileHash, clientName, description, dueDate } = body as Record<string, unknown>;

  if (typeof fileHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(fileHash)) {
    return NextResponse.json(
      { error: "fileHash must be a 0x-prefixed 32-byte SHA-256 hash" },
      { status: 400 }
    );
  }
  if (typeof clientName !== "string" || clientName.trim().length === 0) {
    return NextResponse.json({ error: "clientName is required" }, { status: 400 });
  }
  if (typeof description !== "string") {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  const dueDateSeconds = dueDate === null || dueDate === undefined ? 0 : Number(dueDate);
  if (!Number.isInteger(dueDateSeconds) || dueDateSeconds < 0) {
    return NextResponse.json({ error: "dueDate must be a unix timestamp in seconds, or 0" }, { status: 400 });
  }

  const args = [fileHash as `0x${string}`, clientName, description, BigInt(dueDateSeconds)] as const;

  try {
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const walletClient = getUserWalletClient(decryptPrivateKey(dbUser.encryptedKey));

    // Simulate first so a call that would revert never gets broadcast (and
    // never costs gas) — Monad bills on gas_limit, so failed sends are wasteful.
    await publicClient.simulateContract({
      address: STAMPED_CONTRACT_ADDRESS,
      abi: STAMPED_ABI,
      functionName: "createReceipt",
      args,
      account: walletClient.account,
    });

    const gas = await estimateGasWithBuffer({
      address: STAMPED_CONTRACT_ADDRESS,
      abi: STAMPED_ABI,
      functionName: "createReceipt",
      args,
      account: user.walletAddress,
    });

    const txHash = await walletClient.writeContract({
      address: STAMPED_CONTRACT_ADDRESS,
      abi: STAMPED_ABI,
      functionName: "createReceipt",
      args,
      gas,
    });

    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const createdLog = txReceipt.logs
      .map((log) => {
        try {
          return decodeEventLog({ abi: STAMPED_ABI, data: log.data, topics: log.topics });
        } catch {
          return null;
        }
      })
      .find((decoded) => decoded?.eventName === "ReceiptCreated");

    const receiptId =
      createdLog && createdLog.eventName === "ReceiptCreated"
        ? Number(createdLog.args.receiptId)
        : null;

    return NextResponse.json({
      receiptId,
      txHash,
      blockNumber: txReceipt.blockNumber.toString(),
      status: txReceipt.status,
    });
  } catch (error) {
    const reason = revertReason(error);
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 409 });
    }
    console.error("createReceipt failed", error);
    return NextResponse.json({ error: "Failed to create receipt on-chain" }, { status: 502 });
  }
}
