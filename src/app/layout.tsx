import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider, themeScript } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui";
import "./globals.css";

// Notability's chrome is set in SF Pro, which is Apple's and not redistributable.
// Inter is the closest open equivalent — a neutral interface grotesque with the
// same generous x-height and unfussy letterforms. next/font self-hosts it, so
// there are no runtime font requests, which matters for an app that promises to
// work offline.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
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
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
