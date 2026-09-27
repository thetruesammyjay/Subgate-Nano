import Link from "next/link";
import { BrandMark } from "./brand-mark";

const linkGroups = [
  {
    title: "Explore",
    links: [
      { href: "/streams", label: "Browse streams" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/payments", label: "Access & payments" },
    ],
  },
  {
    title: "For creators",
    links: [
      { href: "/for-creators", label: "Creator overview" },
      { href: "/creator/register", label: "Create an account" },
      { href: "/creator/login", label: "Creator sign in" },
    ],
  },
  {
    title: "Account",
    links: [{ href: "/login", label: "Wallet sign in" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand-block">
          <Link className="footer-brand" href="/" aria-label="Subgate Nano home">
            <BrandMark />
          </Link>
          <p>Good streams, clear access, and payments that follow the time you actually watch.</p>
          <span className="footer-network"><i aria-hidden="true" /> USDC · ARBITRUM</span>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          {linkGroups.map((group) => (
            <div className="footer-link-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
            </div>
          ))}
        </nav>
      </div>
      <div className="footer-bottom">
        <span>Subgate Nano · Streaming access, made more precise.</span>
        <Link href="#top">Back to top <span aria-hidden="true">↑</span></Link>
      </div>
    </footer>
  );
}
