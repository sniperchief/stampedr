import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { MONAD_TESTNET_EXPLORER } from "@/lib/chain";
import { STAMPED_CONTRACT_ADDRESS } from "@/lib/contract";
import { LogoutButton } from "./LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b-2 border-sky">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/">
            <Image
              src="/stampedr-logo.png"
              alt="Stampedr"
              width={928}
              height={202}
              priority
              className="h-12 w-auto sm:h-14"
            />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link href="/" className="text-ink-muted hover:text-ink">
                  Dashboard
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" className="text-ink-muted hover:text-ink">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-sky px-3 py-1.5 font-medium text-white hover:bg-sky-dark"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-display text-sm font-semibold text-ink">Stampedr</p>
            <p className="mt-0.5 text-xs text-ink-muted">Proof you sent it.</p>
          </div>
          <a
            href={`${MONAD_TESTNET_EXPLORER}/address/${STAMPED_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-muted hover:text-sky"
          >
            View the contract on Monad Explorer →
          </a>
        </div>
      </footer>
    </div>
  );
}
