import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider, themeScript } from "@/components/theme/ThemeProvider";
import { StorageNotice } from "@/components/storage/StorageNotice";
import { Toaster } from "@/components/ui";
import "./globals.css";

// One family, two jobs. Notability's headings are heavy and tightly tracked but
// their terminals are flat, not rounded — a grotesque, not a soft display face.
// Inter at 800 with negative tracking gets that weight and density; anything
// rounded reads as a different, friendlier product than the reference.
//
// next/font self-hosts it, so there are still no runtime font requests, and
// dropping the second family takes a whole font payload out of the bundle.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FreeNote — notes and study, on your device",
  description:
    "Open-source note-taking and flashcard study app. Handwriting, audio, and five study modes. No account, no cloud, no tracking.",
  applicationName: "FreeNote",
  manifest: "/manifest.webmanifest",
  // Lets "Add to Home Screen" open FreeNote as a standalone app — which on iOS
  // is also what exempts its stored notes from Safari's 7-day data eviction.
  appleWebApp: { capable: true, title: "FreeNote", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131315" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <ThemeProvider>
          <StorageNotice />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
