// Pure handle derivation, safe on client + server (no server-only imports).
// Uses the Clerk username if the user set one, otherwise a neutral id-based
// handle. NEVER derived from email, so a gmail address can't be guessed from it.
export function baseHandle(
  username: string | null | undefined,
  clerkId: string,
): string {
  if (username) return username;
  return `u${clerkId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase()}`;
}
