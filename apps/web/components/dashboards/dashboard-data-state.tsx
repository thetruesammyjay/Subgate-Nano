import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Inbox } from "./dashboard-icons";

export function DashboardDataError({ message }: { message: string }) {
  return (
    <section className="dashboard-data-notice error" role="alert">
      <AlertCircle aria-hidden="true" size={18} />
      <div><strong>Dashboard data is unavailable.</strong><p>{message}</p></div>
    </section>
  );
}

export function DashboardEmpty({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <section className="dashboard-empty-state">
      <span className="admin-empty-icon"><Inbox aria-hidden="true" size={21} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && action ? <Link className="text-link" href={href}>{action}<ArrowUpRight aria-hidden="true" size={15} /></Link> : null}
    </section>
  );
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="page-heading-row dashboard-page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-lede">{description}</p></div>
      {aside}
    </div>
  );
}
