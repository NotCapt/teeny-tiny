import type { Metadata } from "next";
import "./veil.css";

export const metadata: Metadata = {
  title: "Veil — Your privacy, reclaimed",
  description: "Discover your digital exposure. Take action. Verify what changed. Powered by TinyFish.",
  icons: {
    icon: "/veil.svg",
    shortcut: "/veil.svg",
  },
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
