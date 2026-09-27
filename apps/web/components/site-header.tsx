"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";
import { Menu, X } from "./dashboards/dashboard-icons";

const navItems = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-creators", label: "For creators" },
  { href: "/streams", label: "Explore streams" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 88);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <header className={`site-header${isScrolled ? " is-scrolled" : ""}`}>
      <Link className="brand" href="/" aria-label="Subgate Nano home">
        <span className="brand-wide"><BrandMark /></span>
        <span className="brand-compact"><BrandMark compact /></span>
      </Link>

      <span className="header-separator" aria-hidden="true" />
      <nav className="desktop-nav" aria-label="Primary navigation">
        <div className="desktop-nav-links">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <span className="header-separator" aria-hidden="true" />
        <Link className="nav-action" href="/creator/register">
          Start creating
        </Link>
      </nav>

      <div className="header-mobile-actions">
        <Link className="mobile-scroll-action" href="/creator/register">Start creating</Link>
        <button
          className="menu-button"
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
        </button>
      </div>

      <div id="mobile-menu" className={`mobile-menu ${isOpen ? "open" : ""}`}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link className="mobile-menu-action" href="/creator/register" onClick={() => setIsOpen(false)}>
          Start creating
        </Link>
      </div>
    </header>
  );
}
