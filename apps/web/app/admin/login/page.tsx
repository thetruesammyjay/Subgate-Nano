import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "../../../components/brand-mark";
import { AdminLoginForm } from "./login-form";

export default function AdminLoginPage() {
  return <main className="auth-page"><div className="auth-topbar"><Link href="/" aria-label="Return to Subgate home"><BrandMark /></Link><span className="utility-label">Operations / restricted access</span></div><section className="auth-layout"><div className="auth-intro"><p className="eyebrow">PLATFORM OPERATIONS</p><h1>A clear view of the network.</h1><p className="hero-text">The admin desk is reserved for seeded platform operators reviewing creators, streams, sessions, and settlements.</p><div className="auth-proof"><span>01</span><p>Use the administrator credentials provisioned by the deployment team.</p><span>02</span><p>Every admin session is short-lived and revocable.</p></div></div><Suspense fallback={<section className="auth-card"><p className="dashboard-message">Loading operations access...</p></section>}><AdminLoginForm /></Suspense></section></main>;
}
