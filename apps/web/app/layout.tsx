import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import { SceneRoot } from "@/components/scene";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "IonexFlow — Autonomous AI Agent Workflows",
  description:
    "Build, orchestrate, and monitor autonomous AI agent workflows visually.",
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
