"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BrandMark } from "../../components/brand-mark";
import { MobileNavDrawer } from "../../components/navigation/mobile-nav-drawer";
import {
  Activity,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  Settings,
  WalletCards,
} from "../../components/dashboards/dashboard-icons";
import type { Admin } from "../../types/auth";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/creators", label: "Creators", icon: ClipboardCheck },
  { href: "/admin/streams", label: "Streams", icon: RadioTower },
  { href: "/admin/sessions", label: "Sessions", icon: Activity },
  { href: "/admin/settlements", label: "Settlements", icon: WalletCards },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ admin, children }: { admin: Admin; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const isActive = (href: string) => href === "/admin" ? pathname === href : pathname.startsWith(href);
  const logout = async () => {
    await fetch("/api/auth/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const navigation = (
    <nav className="workspace-nav" aria-label="Admin workspace">
      {links.map(({ href, label, icon: Icon }) => (
        <Link className={isActive(href) ? "workspace-nav-link active" : "workspace-nav-link"} href={href} key={href}>
          <Icon aria-hidden="true" size={18} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="workspace-shell admin-shell">
      <header className="workspace-mobile-header">
        <Link href="/admin" aria-label="Admin overview"><BrandMark compact /></Link>
        <span className="workspace-mobile-title">Admin desk</span>
        <span className="mobile-header-status"><i aria-hidden="true" /> Nominal</span>
      </header>

      <aside className="workspace-sidebar">
        <div className="workspace-brand"><BrandMark /></div>
        <div className="workspace-role"><span>Operations</span><strong>Admin desk</strong></div>
        {navigation}
        <div className="workspace-identity">
          <Activity aria-hidden="true" size={18} />
          <div><strong>{admin.username}</strong><span>{admin.email}</span></div>
        </div>
        <button className="workspace-logout" type="button" onClick={logout}><LogOut aria-hidden="true" size={17} /> Sign out</button>
      </aside>

      <main className="workspace-main">
        <header className="workspace-header">
          <div><span className="utility-label">Admin desk / platform operations</span></div>
          <span className="status-badge published">System nominal</span>
        </header>
        <div className="workspace-content">{children}</div>
      </main>

      <div className="mobile-navigation-dock">
        <nav className="mobile-bottom-nav" aria-label="Admin mobile navigation">
          {links.slice(0, 4).map(({ href, label, icon: Icon }) => (
            <Link className={isActive(href) ? "mobile-nav-link active" : "mobile-nav-link"} href={href} key={href} aria-current={isActive(href) ? "page" : undefined}>
              <Icon aria-hidden="true" size={21} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button className={links.slice(4).some(({ href }) => isActive(href)) ? "mobile-more-button active" : "mobile-more-button"} type="button" onClick={() => setMoreOpen(true)} aria-label="Open more admin pages" aria-haspopup="dialog" aria-controls="mobile-more-sheet" aria-expanded={moreOpen}>
          <Menu aria-hidden="true" size={23} />
          <span>More</span>
        </button>
      </div>

      <MobileNavDrawer
        open={moreOpen}
        onClose={closeMore}
        eyebrow="Operations / navigation"
        title="More in your desk"
        description="Review the payment rail, follow the audit trail, or adjust platform settings."
        identity={`${admin.username} · ${admin.email}`}
        items={links.slice(4).map(({ href, label, icon: Icon }) => ({ href, label, active: isActive(href), icon: <Icon aria-hidden="true" size={22} /> }))}
        onSignOut={logout}
      />
    </div>
  );
}
