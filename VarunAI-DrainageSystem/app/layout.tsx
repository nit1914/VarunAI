import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://drainguard-ai-earth.vercel.app"),
  title: "DrainGuard AI — Which drain should your crew inspect before the storm?",
  description: "DrainGuard turns visible street evidence and changing conditions into explainable inspection priorities, then verifies whether cleanup worked.",
  applicationName: "DrainGuard AI",
  keywords: ["environmental technology", "climate tech", "storm drains", "computer vision", "waterway protection", "smart cities"],
  authors: [{ name: "Bhavya Keerthi", url: "https://github.com/bhavyakeerthi3" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "DrainGuard AI",
    description: "Identify blocked, litter-filled drains, add rainfall and waterway context, and verify cleanup with evidence.",
    type: "website",
    url: "/",
    images: [{ url: "/og.jpg", width: 1536, height: 1024, alt: "DrainGuard AI storm-drain risk map" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DrainGuard AI",
    description: "Which drain should your crew inspect before the storm? Detect, prioritize, allocate, act, and verify cleanup with evidence.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
