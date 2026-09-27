import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "../../components/brand-mark";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-topbar">
        <Link href="/" aria-label="Return to Subgate home"><BrandMark /></Link>
        <span className="utility-label">Creator access / wallet session</span>
      </div>
      <section className="auth-layout">
        <div className="auth-intro">
          <p className="eyebrow">CREATOR CONSOLE</p>
          <h1>A quiet desk for streams that earn as they play.</h1>
          <p className="hero-text">
            Publish access rules, watch sessions settle, and keep your audience
            out of subscription pressure.
          </p>
          <div className="auth-proof">
            <span>01</span><p>Connect the wallet that owns your streams.</p>
            <span>02</span><p>Sign a readable challenge in your wallet.</p>
          </div>
        </div>
        <Suspense fallback={<section className="auth-card"><p className="dashboard-message">Loading wallet sign-in...</p></section>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
