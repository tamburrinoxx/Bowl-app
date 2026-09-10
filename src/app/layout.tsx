import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import "./globals.css";
import AppNav from "@/components/app-nav";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bowl-app-omega.vercel.app"),
  title: "Pinfall — Tournament Hosting & Handicaps",
  openGraph: {
    title: "Pinfall",
    description: "Pattern-aware handicaps, tournament scoring, and verified bowler profiles.",
    images: ["/pinfall-og.png"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/pinfall-og.png"] },
  description: "Pattern-aware handicaps, tournament scoring, and verified bowler profiles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={oswald.variable}>
      <body className="antialiased"><AppNav />
        {children}</body>
    </html>
  );
}
