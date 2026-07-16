import "server-only";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

function getTreasuryAccount() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not set in the server environment");
  }
  return privateKeyToAccount(key as `0x${string}`);
}

/** The app's own funded wallet — pays gas to onboard new users (see /api/auth/signup). */
export const treasuryAccount = getTreasuryAccount();

export const treasuryWalletClient = createWalletClient({
  account: treasuryAccount,
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz"),
});

/** Builds a wallet client for a specific freelancer's own (decrypted) private key. */
export function getUserWalletClient(privateKey: `0x${string}`) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });
}
