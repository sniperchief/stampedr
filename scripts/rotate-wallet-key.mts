/**
 * Re-encrypts every User.encryptedKey from OLD_WALLET_KEY to NEW_WALLET_KEY.
 *
 * Deliberately NOT an API route -- this touches every user's wallet key and
 * is meant to be run by hand, once, during a suspected-key-leak incident.
 * See SECURITY.md for the full incident-response runbook.
 *
 * Usage:
 *   OLD_WALLET_KEY=<hex> NEW_WALLET_KEY=<hex> DATABASE_URL=<url> \
 *     npm run rotate-wallet-key -- --confirm=<db-host>          # dry run (default)
 *   OLD_WALLET_KEY=<hex> NEW_WALLET_KEY=<hex> DATABASE_URL=<url> \
 *     npm run rotate-wallet-key -- --confirm=<db-host> --apply  # writes
 *
 * OLD_WALLET_KEY/NEW_WALLET_KEY must be set directly in the invoking shell,
 * never sourced from a committed/synced .env file -- the whole point is that
 * both keys should never sit together in one place that could itself leak.
 *
 * Runs on Node's built-in TypeScript support (Node 22.6+) -- no ts-node/tsx
 * needed. Uses an explicit .ts extension on the relative import below
 * because Node's native loader (unlike this project's "bundler"
 * moduleResolution used for app code) requires it; tsconfig.json has
 * allowImportingTsExtensions enabled to keep `tsc --noEmit` happy about it.
 */
import { PrismaClient } from "@prisma/client";
import { decryptWithKey, encryptWithKey, parseKeyHex } from "../src/lib/walletKeyCipher.ts";

function parseArgs(argv: string[]): { apply: boolean; confirmHost: string | null } {
  let apply = false;
  let confirmHost: string | null = null;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg.startsWith("--confirm=")) confirmHost = arg.slice("--confirm=".length);
  }
  return { apply, confirmHost };
}

function dbHostFromUrl(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).host;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL -- can't determine which database this would touch");
  }
}

async function main() {
  const { apply, confirmHost } = parseArgs(process.argv.slice(2));

  const oldHex = process.env.OLD_WALLET_KEY;
  const newHex = process.env.NEW_WALLET_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!oldHex || !newHex) {
    throw new Error("Set OLD_WALLET_KEY and NEW_WALLET_KEY in the invoking shell (not in a .env file).");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const oldKey = parseKeyHex(oldHex, "OLD_WALLET_KEY");
  const newKey = parseKeyHex(newHex, "NEW_WALLET_KEY");
  if (oldKey.equals(newKey)) {
    throw new Error("OLD_WALLET_KEY and NEW_WALLET_KEY must be different.");
  }

  const host = dbHostFromUrl(databaseUrl);
  if (confirmHost !== host) {
    throw new Error(
      `Refusing to run: pass --confirm=${host} to explicitly acknowledge which database this will touch.`
    );
  }

  console.log(`${apply ? "APPLY" : "DRY RUN"} against database host: ${host}`);

  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ select: { id: true, encryptedKey: true } });
    console.log(`Found ${users.length} user row(s).`);

    const rewritten: { id: string; encryptedKey: string }[] = [];
    let failures = 0;

    for (const user of users) {
      try {
        const plaintext = decryptWithKey(user.encryptedKey, oldKey);
        const newCiphertext = encryptWithKey(plaintext, newKey);
        const roundTrip = decryptWithKey(newCiphertext, newKey);
        if (roundTrip !== plaintext) {
          throw new Error("round-trip mismatch after re-encryption");
        }
        rewritten.push({ id: user.id, encryptedKey: newCiphertext });
      } catch (error) {
        failures++;
        console.error(`user ${user.id}: FAILED -- ${error instanceof Error ? error.message : error}`);
      }
    }

    console.log(`Verified ${rewritten.length}/${users.length} row(s); ${failures} failure(s).`);

    if (failures > 0) {
      console.error("Aborting -- fix the failures above before rotating (no writes were made).");
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log("Dry run complete, all rows would rotate cleanly. Re-run with --apply to write changes.");
      return;
    }

    await prisma.$transaction(
      rewritten.map(({ id, encryptedKey }) => prisma.user.update({ where: { id }, data: { encryptedKey } }))
    );
    console.log(`Rotated ${rewritten.length} row(s). Now update WALLET_ENCRYPTION_KEY in Vercel and redeploy.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
