import "server-only";
import { parseEther } from "viem";
import { prisma } from "./db";
import { publicClient } from "./chain";
import { treasuryWalletClient } from "./serverWallet";

export const SIGNUP_FUNDING_AMOUNT = parseEther("0.05");

export const WALLET_FUNDING_ERROR_MESSAGE =
  "We couldn't fund your wallet for gas just now — this is usually temporary. Please try again in a minute.";
const FUNDING_GAS = 21000n; // native MON transfers are always exactly 21,000 gas on Monad

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

// Caps how much the treasury will hand out per rolling hour, so a signup-spam
// burst can't silently drain it. Overridable via env for real traffic tuning;
// the default assumes this is still a low-traffic testnet MVP.
const MAX_HOURLY_FUNDING_MON = Number(process.env.MAX_HOURLY_FUNDING_MON ?? "5");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FundableUser = {
  id: string;
  walletAddress: `0x${string}`;
  walletFundedAt: Date | null;
};

/**
 * Funds a user's wallet from the treasury if it hasn't been funded yet,
 * self-healing a signup where the original auto-funding attempt failed.
 * Returns true once `walletFundedAt` reflects a confirmed funding tx (either
 * one this call just sent, or one a concurrent call already claimed).
 */
export async function ensureWalletFunded(dbUser: FundableUser): Promise<boolean> {
  if (dbUser.walletFundedAt) return true;

  // Atomically claim the attempt so two concurrent requests for the same
  // never-funded user (e.g. two tabs right after signup) can't both fire a
  // treasury send. Every serverless request is a fresh invocation, so this
  // has to be a DB-level lock, not an in-process one.
  const claim = await prisma.user.updateMany({
    where: { id: dbUser.id, walletFundedAt: null },
    data: { walletFundedAt: new Date() },
  });
  if (claim.count === 0) {
    // Someone else already claimed (or completed) this -- trust it rather
    // than sending a second funding tx.
    return true;
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentlyFundedCount = await prisma.user.count({ where: { walletFundedAt: { gte: hourAgo } } });
  const projectedSpendMon = (Number(SIGNUP_FUNDING_AMOUNT) / 1e18) * recentlyFundedCount;
  if (projectedSpendMon > MAX_HOURLY_FUNDING_MON) {
    console.error(
      `wallet funding paused: hourly ceiling reached (${recentlyFundedCount} wallets funded in the last hour)`
    );
    await prisma.user.update({ where: { id: dbUser.id }, data: { walletFundedAt: null } });
    return false;
  }

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const txHash = await treasuryWalletClient.sendTransaction({
        to: dbUser.walletAddress,
        value: SIGNUP_FUNDING_AMOUNT,
        gas: FUNDING_GAS,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`wallet funded user=${dbUser.id} tx=${txHash}`);
      return true;
    } catch (error) {
      console.error(`wallet funding attempt ${attempt} failed for user=${dbUser.id}`, error);
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }

  // Every attempt failed -- release the claim so a later call can retry.
  await prisma.user.update({ where: { id: dbUser.id }, data: { walletFundedAt: null } });
  return false;
}
