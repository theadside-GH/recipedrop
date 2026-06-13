import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "RecipeDrop - your recipes, sorted",
  description:
    "Import recipes from anywhere, plan your week, and get one smart shopping list.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RecipeDrop", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f0612f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background">
        <SiteNav />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
