import type { Metadata, Viewport } from "next";
import { Manrope, Syne } from "next/font/google";
import { SceneRoot } from "@/components/scene";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IonexFlow — Autonomous AI Agent Workflows",
    template: "%s — IonexFlow",
  },
  description:
    "Build, orchestrate, and monitor autonomous AI agent workflows visually — with live execution, human approvals, and enterprise control.",
  applicationName: "IonexFlow",
  keywords: [
    "AI agents",
    "workflow automation",
    "visual orchestration",
    "human-in-the-loop",
    "IonexFlow",
  ],
  authors: [{ name: "IonexFlow" }],
  creator: "IonexFlow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "IonexFlow",
    title: "IonexFlow — Autonomous AI Agent Workflows",
    description:
      "Orchestrate autonomous AI agent workflows visually with live pulses, approvals, and enterprise-grade control.",
  },
  twitter: {
    card: "summary_large_image",
    title: "IonexFlow — Autonomous AI Agent Workflows",
    description:
      "Orchestrate autonomous AI agent workflows visually with live pulses, approvals, and enterprise-grade control.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-screen overflow-x-hidden antialiased">
        <SceneRoot />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
