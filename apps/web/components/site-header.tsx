"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "./brand-mark";

const navItems = [
  { href: "/#flow", label: "How it works" },
  { href: "/streams", label: "Explore streams" },
  { href: "/dashboard", label: "Creator desk" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Subgate Nano home">
        <span className="brand-wide"><BrandMark /></span>
        <span className="brand-compact"><BrandMark compact /></span>
      </Link>

      <nav className="desktop-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link className="nav-action" href="/dashboard/streams/new">
          Create stream
        </Link>
      </nav>

      <button
        className="menu-button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      <div id="mobile-menu" className={`mobile-menu ${isOpen ? "open" : ""}`}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link className="mobile-menu-action" href="/dashboard/streams/new" onClick={() => setIsOpen(false)}>
          Create stream
        </Link>
      </div>
    </header>
  );
}
