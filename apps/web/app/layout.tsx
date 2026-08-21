import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BasketMatch",
    template: "%s · BasketMatch",
  },
  description: "Compare grocery baskets against trusted prices, offers, and rebates.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">
            <span className="wordmark-mark" aria-hidden="true">B</span>
            <span>BasketMatch</span>
          </Link>
          <nav aria-label="Primary navigation" className="site-nav">
            <Link href="/">Consumer app</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          Trusted totals keep checkout discounts and post-purchase rebates separate.
        </footer>
      </body>
    </html>
  );
}
