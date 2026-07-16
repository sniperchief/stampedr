import "server-only";
import { prisma } from "./db";
import { getSessionUserId } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  walletAddress: `0x${string}`;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    walletAddress: user.walletAddress as `0x${string}`,
  };
}
