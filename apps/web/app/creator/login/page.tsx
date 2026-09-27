import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "../../../components/brand-mark";
import { CreatorLoginForm } from "./login-form";

export default function CreatorLoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-topbar">
        <Link href="/" aria-label="Return to Subgate home"><BrandMark /></Link>
        <span className="utility-label">Creator desk / sign in</span>
      </div>
      <section className="auth-layout">
        <div className="auth-intro">
          <p className="eyebrow">CREATOR ACCESS</p>
          <h1>Your stream desk, ready when you are.</h1>
          <p className="hero-text">Manage access, publish new streams, and see settlement activity from one calm workspace.</p>
          <div className="auth-proof"><span>01</span><p>Use your creator account for everyday access.</p><span>02</span><p>Connect a wallet when you are ready to publish.</p></div>
        </div>
        <Suspense fallback={<section className="auth-card"><p className="dashboard-message">Loading creator access...</p></section>}>
          <CreatorLoginForm />
        </Suspense>
      </section>
    </main>
  );
}
