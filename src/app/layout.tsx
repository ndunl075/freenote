import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import { ThemeProvider, themeScript } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui";
import "./globals.css";

// Two faces, because Notability uses two. Headings are a heavy rounded display
// type — that chunky friendliness is the interface's loudest signal, and Nunito
// is the closest open match for it. Body copy stays on a neutral grotesque so
// long lists and note titles read cleanly at small sizes.
//
// next/font self-hosts both, so there are still no runtime font requests.
const display = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FreeNote — notes and study, on your device",
  description:
    "Open-source note-taking and flashcard study app. Handwriting, audio, and five study modes. No account, no cloud, no tracking.",
  applicationName: "FreeNote",
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
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
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
