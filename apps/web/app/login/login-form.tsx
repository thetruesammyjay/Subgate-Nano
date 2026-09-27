"use client";

import { ArrowRight, Check, WalletCards } from "../../components/dashboards/dashboard-icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { connectWallet, shortenAddress, signWalletMessage } from "../../lib/wallet";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.startsWith("/")
    ? searchParams.get("next")!
    : "/dashboard";
  const [wallet, setWallet] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const signIn = async () => {
    setMessage(null);
    setIsPending(true);
    try {
      const connectedWallet = wallet || (await connectWallet());
      setWallet(connectedWallet);
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet_address: connectedWallet }),
      });
      const challenge = await challengeResponse.json().catch(() => null);
      if (!challengeResponse.ok || typeof challenge?.message !== "string") {
        throw new Error(challenge?.message ?? "Unable to create a wallet challenge.");
      }

      const signature = await signWalletMessage(challenge.message, connectedWallet);
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          wallet_address: connectedWallet,
          signature,
          display_name: displayName || undefined,
        }),
      });
      const verified = await verifyResponse.json().catch(() => null);
      if (!verifyResponse.ok) {
        throw new Error(verified?.message ?? "Your wallet signature could not be verified.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet sign-in failed.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section className="auth-card" aria-label="Creator wallet sign-in">
      <div className="auth-card-heading">
        <span className="icon-square"><WalletCards aria-hidden="true" size={18} /></span>
        <div>
          <p className="utility-label">Creator access</p>
          <h2>Sign in with your wallet.</h2>
        </div>
      </div>

      <p className="auth-card-copy">
        Subgate asks you to sign a one-time challenge. The signature proves wallet
        ownership; it never authorizes a blockchain transaction.
      </p>

      <label className="field-label">
        <span>Display name <em>optional</em></span>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How your streams should appear"
          autoComplete="nickname"
        />
      </label>

      {wallet ? (
        <div className="connected-wallet">
          <Check aria-hidden="true" size={16} />
          <span>Wallet connected</span>
          <code>{shortenAddress(wallet)}</code>
        </div>
      ) : null}

      <button className="button primary button-wide" type="button" onClick={signIn} disabled={isPending}>
        {isPending ? "Waiting for wallet..." : wallet ? "Sign challenge" : "Connect wallet"}
        <ArrowRight aria-hidden="true" size={16} />
      </button>

      {message ? <p className="form-message error-message">{message}</p> : null}
      <p className="auth-footnote">Wallet sessions expire automatically and can be revoked from the API.</p>
      <div className="auth-links"><Link href="/creator/login">Use email and password</Link><Link href="/creator/register">Create creator account</Link></div>
    </section>
  );
}
