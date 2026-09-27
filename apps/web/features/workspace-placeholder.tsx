import { ArrowUpRight, Construction } from "../components/dashboards/dashboard-icons";
import Link from "next/link";

type WorkspacePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function WorkspacePlaceholder({ eyebrow, title, description, actionHref, actionLabel }: WorkspacePlaceholderProps) {
  return <div className="dashboard-page"><div className="page-heading-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-lede">{description}</p></div>{actionHref && actionLabel ? <Link className="button primary desktop-action" href={actionHref}>{actionLabel} <ArrowUpRight size={15} /></Link> : null}</div><section className="panel placeholder-panel"><span className="admin-empty-icon"><Construction size={22} /></span><h2>Workspace view is ready for data.</h2><p>The shell, responsive layout, and state language are in place. Connect this view to its role-scoped FastAPI endpoint when that API surface is available.</p></section></div>;
}
