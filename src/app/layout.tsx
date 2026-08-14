import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bowl — Tournament Hosting & Handicaps",
  description: "Pattern-aware handicaps, tournament scoring, and verified bowler profiles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
