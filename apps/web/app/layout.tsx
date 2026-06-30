import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Subgate Nano",
  description: "Nanopayment access gateway for creator content and agent tools.",
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
