import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatDateOnly, formatUnixSeconds } from "@/lib/format";
import { fetchReceipt, fetchReceiptIdsByCreator, receiptDisplayNumber } from "@/lib/receipts";
import { MarkPaidButton } from "./MarkPaidButton";

// Always reflect live chain state — never a cached/static snapshot.
export const dynamic = "force-dynamic";

function receiptNumber(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

function daysOverdue(dueDate: number, nowSeconds: number): number {
  return Math.floor((nowSeconds - dueDate) / 86400);
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload or paste",
    body: "Add the file, text, or link you're delivering. It's fingerprinted right in your browser — never uploaded anywhere.",
  },
  {
    step: "2",
    title: "Stamp it",
    body: "That fingerprint plus a timestamp gets locked permanently on Monad. Nobody — including you — can alter it afterward.",
  },
  {
    step: "3",
    title: "Share the link",
    body: "If a client ever disputes what was sent or when, you send one link instead of arguing.",
  },
];

function Homepage() {
  return (
    <div className="space-y-24 py-8">
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-sky">
            Freelance proof of delivery
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Prove you sent it.
          </h1>
          <p className="mt-5 max-w-md text-base text-ink-muted">
            Stampedr fingerprints every file or delivery you send and locks a timestamp for it
            permanently on the blockchain. When a client says &ldquo;I never got that&rdquo; or
            &ldquo;that wasn&apos;t due yet,&rdquo; you send them a link instead of arguing.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-sky px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-dark"
            >
              Sign up free
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-ink hover:border-sky hover:text-sky"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="perforated mx-auto w-full max-w-xs border border-border bg-paper px-6 pb-6 pt-8 shadow-[0_1px_3px_rgba(28,27,25,0.08)]">
          <p className="text-center font-display text-sm font-semibold uppercase tracking-wide text-ink">
            Stampedr — Receipt #0042
          </p>
          <dl className="mt-6 space-y-2 text-xs">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-muted">To</dt>
              <dd className="text-ink">Acme Corp</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-muted">What</dt>
              <dd className="text-ink">Homepage draft v2</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-muted">Sent</dt>
              <dd className="font-mono text-ink">Jul 17, 2026</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-muted">Hash</dt>
              <dd className="font-mono text-ink">9f3a...c221</dd>
            </div>
          </dl>
          <p className="mt-6 text-center text-xs text-sky">✓ verified unchanged since Jul 17, 2026</p>
        </div>
      </section>

      <section>
        <h2 className="text-center font-display text-2xl font-semibold text-ink">How it works</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step}>
              <span className="font-display text-2xl text-sky">{item.step}</span>
              <h3 className="mt-2 font-medium text-ink">{item.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xl text-ink">
            &ldquo;We never received your file, and you missed the deadline.&rdquo;
          </p>
          <p className="mt-4 text-sm text-ink-muted">
            That&apos;s the argument Stampedr ends. Your fingerprinted, timestamped record was
            locked on Monad the moment you sent it — independently verifiable by anyone, and
            impossible for either side to alter after the fact. No more he-said-she-said. Just a
            link that settles it.
          </p>
        </div>
      </section>
    </div>
  );
}

async function Dashboard({ walletAddress }: { walletAddress: `0x${string}` }) {
  const ids = await fetchReceiptIdsByCreator(walletAddress);
  const receipts = await Promise.all(ids.map((id) => fetchReceipt(id)));
  receipts.sort((a, b) => b.createdAt - a.createdAt);

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (receipts.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            Stampedr fingerprints every file or delivery you send and locks a timestamp for it permanently.
            If a client ever says &ldquo;I never got that&rdquo; or &ldquo;that wasn&apos;t due yet,&rdquo; you
            send them the receipt link instead of arguing.
          </p>
        </div>

        <ol className="max-w-md space-y-2 text-sm text-ink-muted">
          <li>
            <span className="font-mono text-sky">1.</span> Upload a file or paste what you&apos;re delivering
          </li>
          <li>
            <span className="font-mono text-sky">2.</span> We fingerprint it and stamp a timestamp on it,
            permanently
          </li>
          <li>
            <span className="font-mono text-sky">3.</span> Share the receipt link with your client as proof
          </li>
        </ol>

        <Link
          href="/new"
          className="rounded-md bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-dark"
        >
          + Create your first receipt
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every row below is a delivery you&apos;ve fingerprinted and permanently timestamped — proof of
            exactly what you sent and when.
          </p>
        </div>
        <Link
          href="/new"
          className="self-start rounded-md bg-sky px-3 py-2 text-sm font-medium text-white hover:bg-sky-dark sm:shrink-0"
        >
          + New receipt
        </Link>
      </div>

      <div className="divide-y divide-border border-y border-border">
        {receipts.map((receipt) => {
          const isOverdue = receipt.dueDate > 0 && receipt.dueDate < nowSeconds && !receipt.paid;
          return (
            <div
              key={receipt.id}
              className={`flex flex-col gap-2 border-l-4 py-3 pl-4 pr-2 sm:flex-row sm:items-center sm:gap-4 ${
                isOverdue ? "border-l-stamp" : "border-l-transparent"
              }`}
            >
              <div className="flex items-center gap-3 sm:contents">
                <span className="w-10 shrink-0 font-mono text-xs text-ink-muted sm:w-14">
                  {receiptNumber(receiptDisplayNumber(ids, receipt.id))}
                </span>

                <div className="min-w-0 flex-1">
                  <Link href={`/receipt/${receipt.id}`} className="font-medium text-ink hover:underline">
                    {receipt.description}
                  </Link>
                  <p className="text-sm text-ink-muted">{receipt.clientName}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:contents">
                {receipt.paid ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-sky">
                    <span aria-hidden>✓</span> Paid
                  </span>
                ) : (
                  <MarkPaidButton receiptId={receipt.id} />
                )}

                <div
                  className="text-right font-mono text-xs text-ink-muted sm:w-28 sm:shrink-0"
                  title={formatUnixSeconds(receipt.createdAt)}
                >
                  {receipt.dueDate > 0 ? (
                    <>
                      <div>due {formatDateOnly(receipt.dueDate)}</div>
                      {isOverdue && (
                        <div className="text-stamp">{daysOverdue(receipt.dueDate, nowSeconds)}d overdue</div>
                      )}
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) return <Homepage />;
  return <Dashboard walletAddress={user.walletAddress} />;
}
