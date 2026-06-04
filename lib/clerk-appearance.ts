// Shared Clerk appearance — SynaptAgent dark brand theme.
// Applied globally on <ClerkProvider> so SignIn / SignUp / UserButton all inherit it.
// Uses Clerk's current `variables` keys (colorForeground / colorInput / colorMuted ...).
export const clerkAppearance = {
  variables: {
    colorPrimary: "#ff5722", // signal orange
    colorPrimaryForeground: "#0a0a0a", // text on orange buttons
    colorBackground: "#0a0a0a", // card background (near-black)
    colorForeground: "#ebe4d5", // primary text (cream)
    colorMutedForeground: "#9b958a", // secondary / hint text
    colorMuted: "#15120e", // muted surface
    colorInput: "#141210", // input background
    colorInputForeground: "#ebe4d5", // input text
    colorNeutral: "#ebe4d5", // base for borders / hovers (light, for dark theme)
    colorBorder: "rgba(235, 228, 213, 0.12)",
    colorRing: "#ff5722", // focus ring
    colorShadow: "rgba(0, 0, 0, 0.55)",
    colorModalBackdrop: "rgba(0, 0, 0, 0.7)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-inter)",
    fontFamilyMono: "var(--font-geist-mono)",
  },
};
