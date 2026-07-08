import type { Metadata, Viewport } from "next";
import { Syne, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/shared/Providers";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { PwaInit } from "@/components/shared/PwaInit";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10B981",
};

export const metadata: Metadata = {
  title: {
    default: "DrowsyShield — Driver Risk Intelligence Platform",
    template: "%s | DrowsyShield",
  },
  description:
    "Real-time multimodal driver drowsiness detection for motor insurance agencies. Risk scoring, claims evidence, fleet compliance — powered by computer vision.",
  keywords: [
    "driver monitoring system",
    "drowsiness detection",
    "motor insurance",
    "fleet safety",
    "DMS",
    "usage-based insurance",
    "driver risk score",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DrowsyShield",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  openGraph: {
    title: "DrowsyShield — Driver Risk Intelligence Platform",
    description:
      "Real-time driver drowsiness detection for motor insurance agencies.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased bg-background text-foreground`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <PwaInit />
          <Navbar />
          <main className="flex-1 pt-20 bg-background">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
