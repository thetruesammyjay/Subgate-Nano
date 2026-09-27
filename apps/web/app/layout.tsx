import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Subgate Nano",
  description: "Premium video and livestream access with clear pay-per-view and metered USDC pricing.",
  icons: {
    icon: "/subgate-ico.png",
  },
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
