import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Pure AES-256-GCM primitives with no `server-only` import and no
 * `process.env` access, so standalone scripts (e.g. scripts/rotate-wallet-key.ts,
 * run via tsx/Node directly) can import this safely. `server-only`'s package
 * resolves to a no-op only under Next's "react-server" export condition —
 * under plain Node it unconditionally throws, so anything that needs to run
 * outside the Next server (like a key-rotation CLI) can't go through
 * walletEncryption.ts directly.
 */

const KEY_LENGTH_BYTES = 32;

export function parseKeyHex(hex: string, label: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`${label} must be a ${KEY_LENGTH_BYTES}-byte hex string`);
  }
  return key;
}

/** Encrypts a private key for storage. Format: iv:authTag:ciphertext, all hex. */
export function encryptWithKey(privateKey: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptWithKey(encrypted: string, key: Buffer): `0x${string}` {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Malformed encrypted key");

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8") as `0x${string}`;
}
