"use client";

import { ArrowRight, Link2, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(tokenFromUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const completeLogin = (magicToken: string) => {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ token: magicToken }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          typeof payload?.message === "string"
            ? payload.message
            : "Unable to verify magic link.",
        );
        return;
      }

      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    });
  };

  useEffect(() => {
    if (tokenFromUrl) {
      completeLogin(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const requestMagicLink = () => {
    setMessage(null);
    setDevMagicLink(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          typeof payload?.message === "string"
            ? payload.message
            : "Unable to request magic link.",
        );
        return;
      }

      setMessage(
        typeof payload?.message === "string"
          ? payload.message
          : "If that creator exists, a magic link has been issued.",
      );

      if (typeof payload?.devMagicLinkToken === "string") {
        const link = `/login?token=${encodeURIComponent(payload.devMagicLinkToken)}&next=${encodeURIComponent(nextPath)}`;
        setToken(payload.devMagicLinkToken);
        setDevMagicLink(link);
      }
    });
  };

  return (
    <section className="login-card" aria-label="Creator magic-link login">
      <div className="dashboard-panel-heading">
        <span>
          <Mail aria-hidden="true" size={16} /> Creator Magic Link
        </span>
        <strong>DB SESSION</strong>
      </div>

      <label>
        <span>Creator Email</span>
        <input
          autoComplete="email"
          autoFocus
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && email) {
              requestMagicLink();
            }
          }}
        />
      </label>

      <button
        className="button primary"
        type="button"
        disabled={!email || isPending}
        onClick={requestMagicLink}
      >
        Request Magic Link <ArrowRight aria-hidden="true" size={16} />
      </button>

      <label>
        <span>Magic-Link Token</span>
        <input
          autoComplete="one-time-code"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && token) {
              completeLogin(token);
            }
          }}
        />
      </label>

      <button
        className="button secondary"
        type="button"
        disabled={!token || isPending}
        onClick={() => completeLogin(token)}
      >
        Verify Token <ArrowRight aria-hidden="true" size={16} />
      </button>

      {devMagicLink && (
        <a className="created-content-link" href={devMagicLink}>
          <Link2 aria-hidden="true" size={16} /> Open development magic link
        </a>
      )}

      {message && <p className="dashboard-message">{message}</p>}
    </section>
  );
}
