"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BrandMark } from "../../components/brand-mark";
import { MobileNavDrawer } from "../../components/navigation/mobile-nav-drawer";
import {
  Activity,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  ReceiptText,
  Settings,
  WalletCards,
} from "../../components/dashboards/dashboard-icons";
import { shortenAddress } from "../../lib/wallet";
import type { Creator } from "../../types/auth";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/streams", label: "My streams", icon: RadioTower },
  { href: "/dashboard/sessions", label: "Sessions", icon: Activity },
  { href: "/dashboard/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/dashboard/profile", label: "Profile", icon: CircleUserRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

type CreatorSidebarProps = { creator: Creator; children: React.ReactNode };

export function CreatorSidebar({ creator, children }: CreatorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const activeLink = links.find((link) => link.href !== "/dashboard" && pathname.startsWith(link.href)) ?? links[0]!;
  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  const navigation = (
    <nav className="workspace-nav" aria-label="Creator workspace">
      {links.map(({ href, label, icon: Icon }) => (
        <Link className={isActive(href) ? "workspace-nav-link active" : "workspace-nav-link"} href={href} key={href}>
          <Icon aria-hidden="true" size={18} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );

  const moreItems = [
    ...links.slice(4).map(({ href, label, icon: Icon }) => ({ href, label, active: isActive(href), icon: <Icon aria-hidden="true" size={22} /> })),
    { href: "/dashboard/streams/new", label: "Create stream", active: pathname === "/dashboard/streams/new", icon: <RadioTower aria-hidden="true" size={22} /> },
  ];

  return (
    <div className="workspace-shell">
      <header className="workspace-mobile-header">
        <Link href="/dashboard" aria-label="Creator overview"><BrandMark compact /></Link>
        <span className="workspace-mobile-title">{activeLink.label}</span>
        <span className="mobile-header-status"><i aria-hidden="true" /> Creator desk</span>
      </header>

      <aside className="workspace-sidebar">
        <div className="workspace-brand"><BrandMark /></div>
        <div className="workspace-role"><span>Creator desk</span><strong>Broadcast control</strong></div>
        {navigation}
        <div className="workspace-identity">
          <WalletCards aria-hidden="true" size={18} />
          <div><strong>{creator.display_name}</strong><span>{shortenAddress(creator.wallet_address)}</span></div>
        </div>
        <button className="workspace-logout" type="button" onClick={logout}><LogOut aria-hidden="true" size={17} /> Sign out</button>
      </aside>

      <main className="workspace-main">
        <header className="workspace-header">
          <div><span className="utility-label">Creator desk / {new Date().getFullYear()}</span><span className="workspace-header-wallet">{shortenAddress(creator.wallet_address)}</span></div>
          <Link className="button primary compact-button" href="/dashboard/streams/new"><RadioTower aria-hidden="true" size={17} /> New stream</Link>
        </header>
        <div className="workspace-content">{children}</div>
      </main>

      <div className="mobile-navigation-dock">
        <nav className="mobile-bottom-nav" aria-label="Creator mobile navigation">
          {links.slice(0, 4).map(({ href, label, icon: Icon }) => (
            <Link className={isActive(href) ? "mobile-nav-link active" : "mobile-nav-link"} href={href} key={href} aria-current={isActive(href) ? "page" : undefined}>
              <Icon aria-hidden="true" size={21} />
              <span>{label === "My streams" ? "Streams" : label}</span>
            </Link>
          ))}
        </nav>
        <button className={links.slice(4).some(({ href }) => isActive(href)) || pathname === "/dashboard/streams/new" ? "mobile-more-button active" : "mobile-more-button"} type="button" onClick={() => setMoreOpen(true)} aria-label="Open more creator pages" aria-haspopup="dialog" aria-controls="mobile-more-sheet" aria-expanded={moreOpen}>
          <Menu aria-hidden="true" size={23} />
          <span>More</span>
        </button>
      </div>

      <MobileNavDrawer
        open={moreOpen}
        onClose={closeMore}
        eyebrow="Creator desk / navigation"
        title="More in your desk"
        description="Manage your public identity, tune your preferences, or create another stream."
        identity={`${creator.display_name} · ${shortenAddress(creator.wallet_address)}`}
        items={moreItems}
        onSignOut={logout}
      />
    </div>
  );
}
