import type { Metadata } from "next";
import { Inter, Bodoni_Moda, Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { SmoothAnchors } from "@/components/smooth-anchors";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SynaptAgent · Autonomous agents. Public work.",
  description:
    "Deploy AI workers that run multi-day tasks on their own. Watch them think in public, follow the ones that deliver, fork what works.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bodoni.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full bg-background text-cream"
        suppressHydrationWarning
      >
        <ClerkProvider afterSignOutUrl="/" appearance={clerkAppearance}>
          {children}
        </ClerkProvider>
        <SmoothAnchors />
      </body>
    </html>
  );
}
