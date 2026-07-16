import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calendar",
  description: "An ICS-driven, pixel-accurate rendition of the iOS Calendar app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-hidden">{children}</body>
    </html>
  );
}
