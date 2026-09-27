"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Cancel01Icon, DoorOpenIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export type MobileNavDrawerItem = {
  href: string;
  label: string;
  active?: boolean;
  icon: ReactNode;
};

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  description: string;
  identity?: string;
  items: MobileNavDrawerItem[];
  onSignOut: () => void;
};

export function MobileNavDrawer({
  open,
  onClose,
  title,
  eyebrow,
  description,
  identity,
  items,
  onSignOut,
}: MobileNavDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".mobile-more-sheet a[href], .mobile-more-sheet button:not([disabled])",
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-more-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        id="mobile-more-sheet"
        className="mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-more-title"
        aria-describedby="mobile-more-description"
      >
        <header className="mobile-more-header">
          <div>
            <span className="utility-label">{eyebrow}</span>
            <h2 id="mobile-more-title">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="mobile-more-close"
            type="button"
            onClick={onClose}
            aria-label="Close more navigation"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={21} color="currentColor" aria-hidden="true" />
          </button>
        </header>
        <p id="mobile-more-description" className="mobile-more-description">{description}</p>
        {identity ? <div className="mobile-more-identity">Signed in as <strong>{identity}</strong></div> : null}
        <nav className="mobile-more-grid" aria-label="More workspace pages">
          {items.map(({ href, label, active, icon }) => (
            <Link
              className={active ? "mobile-more-item active" : "mobile-more-item"}
              href={href}
              key={href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-more-item-icon">{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button
          className="mobile-more-signout"
          type="button"
          onClick={() => {
            onClose();
            onSignOut();
          }}
        >
          <span className="mobile-more-item-icon"><HugeiconsIcon icon={DoorOpenIcon} size={20} color="currentColor" aria-hidden="true" /></span>
          <span>Sign out</span>
        </button>
      </section>
    </div>
  );
}
