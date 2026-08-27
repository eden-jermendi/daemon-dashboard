import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAEMON DASHBOARD",
  description: "Personal modular dashboard and service control plane",
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
