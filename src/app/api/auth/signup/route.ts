import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { encryptPrivateKey } from "@/lib/walletEncryption";
import { ensureWalletFunded } from "@/lib/walletFunding";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newPrivateKey = generatePrivateKey();
  const newAccount = privateKeyToAccount(newPrivateKey);
  const encryptedKey = encryptPrivateKey(newPrivateKey);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      walletAddress: newAccount.address,
      encryptedKey,
    },
  });

  // Fund the new wallet from the app's treasury so the freelancer can start
  // stamping receipts immediately, with no manual faucet step of their own.
  // Signup succeeds either way — a failure here is recorded (walletFundedAt
  // stays null) and self-heals on the user's first on-chain action instead
  // of leaving them permanently stuck.
  await ensureWalletFunded({ id: user.id, walletAddress: newAccount.address, walletFundedAt: null });

  await createSession(user.id);

  return NextResponse.json({ success: true, walletAddress: newAccount.address });
}
