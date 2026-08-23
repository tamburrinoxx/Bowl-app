import type { Metadata } from "next";
import "./globals.css";
import AppNav from "@/components/app-nav";

export const metadata: Metadata = {
  title: "Pinfall — Tournament Hosting & Handicaps",
  description: "Pattern-aware handicaps, tournament scoring, and verified bowler profiles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><AppNav />
        {children}</body>
    </html>
  );
}
