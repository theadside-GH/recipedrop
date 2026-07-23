import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { getViewerEmail } from "@/lib/auth";
import { env } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  // metadataBase makes relative og:image paths absolute — required for link
  // previews. Set NEXT_PUBLIC_SITE_URL when not on Vercel; localhost is the
  // dev fallback so metadata never hard-fails.
  metadataBase: new URL(env.siteUrl || "http://localhost:3000"),
  title: {
    default: "DishCovered — what did you Dishcover this week?",
    template: "%s — DishCovered",
  },
  description:
    "Discover your next favorite dish. Import recipes from anywhere, plan your week, and get one smart shopping list.",
  openGraph: {
    siteName: "DishCovered",
    type: "website",
    title: "DishCovered — what did you Dishcover this week?",
    description:
      "Import recipes from TikTok, Instagram, YouTube, or any website — then cook, plan, and shop from one place.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DishCovered", statusBarStyle: "default" },
  // ?v=2 busts cached copies of the old RecipeDrop logo (pre-2026-07-11) in
  // browser favicon caches and installed-PWA manifests. Bump together with
  // manifest.webmanifest and the sw.js cache version if the logo changes again.
  icons: { icon: "/icon-192.png?v=2", apple: "/icon-192.png?v=2" },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f0612f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewerEmail();
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <ServiceWorkerRegister />
        <SiteNav signedIn={!!viewer} />
        <InstallAppPrompt />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pb-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
