import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` (runs on the Node.js runtime).
// Gate the app routes; everything else (landing, /sign-in, /sign-up) stays public.
const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/api/chat(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
