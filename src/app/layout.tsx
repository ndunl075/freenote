import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { ThemeProvider, themeScript } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui";
import "./globals.css";

// Quizlet ships Hurme Geometric Sans, which is proprietary. Figtree is the
// closest open geometric-humanist match: same double-storey `a`, same tight
// heading colour. next/font self-hosts it, so there are no runtime font
// requests — which matters for an app that promises to work offline.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "freenote — notes and study, on your device",
  description:
    "Open-source note-taking and flashcard study app. Handwriting, audio, and five study modes. No account, no cloud, no tracking.",
  applicationName: "freenote",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a092d" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
