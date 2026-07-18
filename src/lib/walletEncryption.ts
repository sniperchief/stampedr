import "server-only";
import { decryptWithKey, encryptWithKey, parseKeyHex } from "./walletKeyCipher";

function getKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY;
  if (!hex) throw new Error("WALLET_ENCRYPTION_KEY is not set in the server environment");
  return parseKeyHex(hex, "WALLET_ENCRYPTION_KEY");
}

/** Encrypts a private key for storage. Format: iv:authTag:ciphertext, all hex. */
export function encryptPrivateKey(privateKey: string, key: Buffer = getKey()): string {
  return encryptWithKey(privateKey, key);
}

export function decryptPrivateKey(encrypted: string, key: Buffer = getKey()): `0x${string}` {
  return decryptWithKey(encrypted, key);
}
