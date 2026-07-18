# Security notes: wallet custody

Stampedr generates and custodies a private key for every user (a fresh EOA
wallet created server-side at signup). This document describes what's
protected today, what isn't, and what to do in an incident. It's written for
the current stage of the project — a Monad **testnet** MVP with no real
value at stake yet — and should be revisited before this ever handles
mainnet funds (see "Future work" below).

## What's protected today

- Every private key is encrypted at rest with AES-256-GCM (fresh random IV
  per record, authenticated with a tag — see `src/lib/walletKeyCipher.ts`).
  The primitive itself is sound; nothing here changes it.
- The decrypted key is never cached — it's rebuilt fresh from the DB on each
  signing request and not held anywhere long-lived.
- All four secrets (`DEPLOYER_PRIVATE_KEY`, `WALLET_ENCRYPTION_KEY`,
  `SESSION_SECRET`, `DATABASE_URL`) are stored as Vercel encrypted
  ("sensitive") environment variables, scoped to **Production only** — not
  exposed to Preview deployments, which tend to be shared more loosely (PR
  links, less scrutiny). Verify this hasn't drifted with `vercel env ls`.
- Local `.env`/`.env.local` files are gitignored and excluded from Vercel
  CLI uploads via `.vercelignore` (a real gap that existed briefly during
  initial deployment and was caught and fixed the same session).

## Known gaps

- **Single master key, no KMS.** `WALLET_ENCRYPTION_KEY` is one symmetric
  key that decrypts every user's wallet. If it leaks — a misconfigured log,
  a compromised deploy pipeline, an overprivileged Vercel team member — every
  wallet is compromised at once. Per-user key derivation (HKDF with a stored
  salt) was considered and rejected: it only protects against master-key
  exposure and DB exposure being *independent* events, but here they're not
  — both secrets live as Vercel Production env vars on the same project, so
  anyone who can read one can plausibly read the other, and a salt sitting
  in the same DB an attacker already has access to buys nothing. Making them
  genuinely independent means an external secret store with separate access
  control — that's a KMS, not a code fix (see "Future work").
- **No durable audit trail.** Minimal structured logging exists (see below)
  at each decrypt/sign point, relying on Vercel's built-in log capture —
  which has short retention on most plans without a log drain. If asked
  "which users were affected by this incident," the honest answer today is
  "best effort from recent logs," not a durable table.
- **Decrypted key material has no secure-wipe.** JS gives no primitive to
  scrub a string/Buffer from memory once no longer needed — accepted as an
  unfixable-cheaply limitation, not an oversight.

## Incident response — suspected `WALLET_ENCRYPTION_KEY` leak

1. Set `OLD_WALLET_KEY` (the current, possibly-leaked key) and
   `NEW_WALLET_KEY` (freshly generated: `openssl rand -hex 32`) directly in
   your shell — **never** write both into a file together.
2. Dry run: `OLD_WALLET_KEY=... NEW_WALLET_KEY=... DATABASE_URL=... npm run rotate-wallet-key -- --confirm=<db-host>`.
   Confirms every row round-trips cleanly under the new key before anything
   is written. `<db-host>` must match the host in `DATABASE_URL` exactly —
   a fat-finger guard against pointing at the wrong database.
3. Review the output. If all rows pass, re-run with `--apply` to write the
   re-encrypted keys in a single all-or-nothing transaction.
4. Update `WALLET_ENCRYPTION_KEY` in Vercel (`vercel env rm` +
   `vercel env add ... --sensitive`) to `NEW_WALLET_KEY`, then redeploy.
5. **Expect a short error window** between step 3 and step 4 completing —
   the deployed app is still holding the old key in memory while the DB now
   has ciphertext encrypted under the new one, so in-flight requests will
   hit GCM auth-tag failures until the redeploy finishes. For this project's
   current traffic, the right call is to accept that window (do it at a
   quiet time) rather than build dual-key fallback decryption.

## Incident response — suspected `DEPLOYER_PRIVATE_KEY` (treasury) leak

1. Generate a new key, fund it (from a faucet, or by sweeping remaining
   balance from the old treasury address).
2. Update `DEPLOYER_PRIVATE_KEY` in Vercel, redeploy.
3. Sweep any remaining funds from the old treasury address.
4. There's no DB-side rotation needed for this one — it isn't stored per-user.

## Treasury spend control

`ensureWalletFunded` (`src/lib/walletFunding.ts`) caps total signup funding
to `MAX_HOURLY_FUNDING_MON` (default: 5 MON/hour) as a narrow circuit
breaker against signup-spam draining the treasury. This is **not** general
rate limiting — brute-force protection on `/api/auth/login` and broader
signup abuse protection remain open follow-up items, tracked separately
since they're cross-cutting concerns rather than wallet-custody-specific.

## Future work (before this ever handles real value)

- Move `WALLET_ENCRYPTION_KEY` custody to an external KMS (AWS KMS/GCP Cloud
  KMS) so decrypting a wallet requires a remote, IAM-audited API call rather
  than holding the raw key in application memory/env vars.
- Replace best-effort log-based tracing with a durable audit table
  (`userId`, action, txHash, timestamp) for real incident forensics.
- General rate limiting / anti-abuse on auth endpoints.
