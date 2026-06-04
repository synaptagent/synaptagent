import "server-only";

// Image generation via Pollinations (Flux). Anonymous access now returns 402,
// so it needs a free token (register at pollinations.ai). Token-gated so the
// agent never shows a broken image when image-gen isn't configured. The simple
// URL shape means we can swap to Replicate/Fal later without changing callers.
export function hasImageGen(): boolean {
  return Boolean(process.env.POLLINATIONS_TOKEN);
}

export function generateImageUrl(prompt: string): string {
  const p = encodeURIComponent(prompt.replace(/\s+/g, " ").trim().slice(0, 400));
  const token = encodeURIComponent(process.env.POLLINATIONS_TOKEN ?? "");
  return `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true&token=${token}`;
}
