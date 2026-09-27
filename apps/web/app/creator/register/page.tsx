import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "../../../components/brand-mark";
import { CreatorRegisterForm } from "./register-form";

export default function CreatorRegisterPage() {
  return <main className="auth-page"><div className="auth-topbar"><Link href="/" aria-label="Return to Subgate home"><BrandMark /></Link><span className="utility-label">Creator desk / registration</span></div><section className="auth-layout"><div className="auth-intro"><p className="eyebrow">CREATOR SETUP</p><h1>Build the desk behind your next stream.</h1><p className="hero-text">Start with the details your audience will recognize. Wallet linking can happen after the account is ready.</p><div className="auth-proof"><span>01</span><p>Choose a username people can remember.</p><span>02</span><p>Add your public links and connect a wallet later.</p></div></div><Suspense fallback={<section className="auth-card"><p className="dashboard-message">Loading registration...</p></section>}><CreatorRegisterForm /></Suspense></section></main>;
}
