"use client";

import { Menu, X, Zap } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "#flow", label: "Flow" },
  { href: "#dashboard", label: "Dashboard" },
  { href: "#agents", label: "Agents" },
  { href: "#footer", label: "Links" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Subgate Nano home">
        <span className="brand-mark">
          <Zap aria-hidden="true" size={16} strokeWidth={1.7} />
        </span>
        <span>Subgate Nano</span>
      </a>

      <nav className="desktop-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
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
          <a key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}
