import { NextResponse } from "next/server";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { getCurrentUser } from "@/lib/auth";
import { publicClient } from "@/lib/chain";
import { STAMPED_ABI, STAMPED_CONTRACT_ADDRESS } from "@/lib/contract";
import { prisma } from "@/lib/db";
import { estimateGasWithBuffer } from "@/lib/gas";
import { getUserWalletClient } from "@/lib/serverWallet";
import { decryptPrivateKey } from "@/lib/walletEncryption";

function revertReason(error: unknown): string | null {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName ?? revertError.reason ?? null;
    }
  }
  return null;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await context.params;
  const receiptId = Number(id);

  if (!Number.isInteger(receiptId) || receiptId <= 0) {
    return NextResponse.json({ error: "Invalid receipt id" }, { status: 400 });
  }

  const args = [BigInt(receiptId)] as const;

  try {
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const walletClient = getUserWalletClient(decryptPrivateKey(dbUser.encryptedKey));

    // The contract itself enforces that only the receipt's original creator
    // can mark it paid — simulate first to fail cheaply if this user isn't it.
    await publicClient.simulateContract({
      address: STAMPED_CONTRACT_ADDRESS,
      abi: STAMPED_ABI,
      functionName: "markPaid",
      args,
      account: walletClient.account,
    });

    const gas = await estimateGasWithBuffer({
      address: STAMPED_CONTRACT_ADDRESS,
      abi: STAMPED_ABI,
      functionName: "markPaid",
      args,
      account: user.walletAddress,
    });

    const txHash = await walletClient.writeContract({
      address: STAMPED_CONTRACT_ADDRESS,
      abi: STAMPED_ABI,
      functionName: "markPaid",
      args,
      gas,
    });

    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({
      txHash,
      blockNumber: txReceipt.blockNumber.toString(),
      status: txReceipt.status,
    });
  } catch (error) {
    const reason = revertReason(error);
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 409 });
    }
    console.error("markPaid failed", error);
    return NextResponse.json({ error: "Failed to mark receipt paid on-chain" }, { status: 502 });
  }
}
