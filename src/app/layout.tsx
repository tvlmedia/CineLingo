import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineLingo",
  description: "Duolingo for cinematography",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
