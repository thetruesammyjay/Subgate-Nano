import { Suspense } from "react";
import { FloatingIcons } from "../../components/floating-icons";
import { SiteHeader } from "../../components/site-header";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main id="top">
      <SiteHeader />
      <FloatingIcons />

      <section className="login-shell section-shell">
        <div>
          <p className="eyebrow">CREATOR AUTH / DASHBOARD SESSION</p>
          <h1>One more lock before the creator console.</h1>
          <p className="hero-text">
            The browser signs in with a dashboard password. Publishing still goes
            through the server-side proxy, so internal API credentials never reach
            the client.
          </p>
        </div>

        <Suspense
          fallback={
            <section className="login-card">
              <p className="dashboard-message">Loading creator login...</p>
            </section>
          }
        >
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
