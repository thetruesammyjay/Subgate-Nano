"use client";

import { CheckCircle2, Clipboard, LockKeyhole, ShieldAlert } from "lucide-react";
import { useState, useTransition } from "react";
import type { ContentUnlock } from "@subgate/types";
import type { UnlockProxyResponse } from "../../../lib/subgate-api";

type UnlockPanelProps = {
  slug: string;
  initialPaymentRequiredHeader: string | null;
  initialTermsJson: string | null;
};

type UnlockStep = "terms" | "ready" | "verifying" | "unlocked" | "error";

const fetchUnlockTerms = async (slug: string): Promise<UnlockProxyResponse> => {
  const response = await fetch(`/api/content/${encodeURIComponent(slug)}/unlock`, {
    cache: "no-store",
  });

  return response.json() as Promise<UnlockProxyResponse>;
};

const submitPaymentSignature = async (
  slug: string,
  paymentSignature: string,
): Promise<UnlockProxyResponse> => {
  const response = await fetch(`/api/content/${encodeURIComponent(slug)}/unlock`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ paymentSignature }),
  });

  return response.json() as Promise<UnlockProxyResponse>;
};

export function UnlockPanel({
  slug,
  initialPaymentRequiredHeader,
  initialTermsJson,
}: UnlockPanelProps) {
  const [paymentRequiredHeader, setPaymentRequiredHeader] = useState(
    initialPaymentRequiredHeader,
  );
  const [termsJson, setTermsJson] = useState(initialTermsJson);
  const [paymentSignature, setPaymentSignature] = useState("");
  const [unlockedContent, setUnlockedContent] = useState<ContentUnlock | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<UnlockStep>(
    initialPaymentRequiredHeader ? "ready" : "terms",
  );
  const [isPending, startTransition] = useTransition();

  const copyTerms = async () => {
    if (!paymentRequiredHeader) {
      return;
    }

    await navigator.clipboard.writeText(paymentRequiredHeader);
    setMessage("PAYMENT-REQUIRED header copied.");
  };

  const refreshTerms = () => {
    setMessage(null);
    setStep("terms");

    startTransition(async () => {
      const result = await fetchUnlockTerms(slug);

      if (result.status === "payment_required") {
        setPaymentRequiredHeader(result.paymentRequiredHeader);
        setTermsJson(JSON.stringify(result.paymentRequired, null, 2));
        setStep("ready");
        setMessage("Fresh payment terms loaded.");
        return;
      }

      if (result.status === "unlocked") {
        setUnlockedContent(result.content);
        setStep("unlocked");
        setMessage("Content unlocked.");
        return;
      }

      setStep("error");
      setMessage(result.message);
    });
  };

  const verifyPayment = () => {
    setMessage(null);
    setStep("verifying");

    startTransition(async () => {
      const result = await submitPaymentSignature(slug, paymentSignature);

      if (result.status === "unlocked") {
        setUnlockedContent(result.content);
        setStep("unlocked");
        setMessage("Payment verified and access granted.");
        return;
      }

      if (result.status === "payment_required") {
        setPaymentRequiredHeader(result.paymentRequiredHeader);
        setTermsJson(JSON.stringify(result.paymentRequired, null, 2));
        setStep("ready");
        setMessage("Payment was not accepted yet. Review the latest terms.");
        return;
      }

      setStep("error");
      setMessage(result.message);
    });
  };

  return (
    <section className="unlock-panel" aria-label="Unlock content with x402">
      <div className="unlock-panel-header">
        <span>
          {step === "unlocked" ? (
            <CheckCircle2 aria-hidden="true" size={18} />
          ) : (
            <LockKeyhole aria-hidden="true" size={18} />
          )}
          X402 Unlock
        </span>
        <strong>{step.toUpperCase()}</strong>
      </div>

      {message && <p className="unlock-message">{message}</p>}

      {unlockedContent ? (
        <article className="unlocked-content">
          <span>UNLOCKED BODY</span>
          <h2>{unlockedContent.title}</h2>
          <pre>{unlockedContent.body}</pre>
          <small>Access grant: {unlockedContent.accessGrantId}</small>
        </article>
      ) : (
        <>
          <div className="unlock-terms">
            <div>
              <span>PAYMENT-REQUIRED</span>
              <button
                className="mini-button"
                type="button"
                onClick={copyTerms}
                disabled={!paymentRequiredHeader}
              >
                <Clipboard aria-hidden="true" size={14} /> Copy Header
              </button>
            </div>
            <pre>
              {termsJson ??
                "No terms loaded yet. Request fresh terms from the API."}
            </pre>
          </div>

          <label className="signature-field">
            <span>PAYMENT-SIGNATURE</span>
            <textarea
              value={paymentSignature}
              onChange={(event) => setPaymentSignature(event.target.value)}
              placeholder="Paste the base64 x402 payment signature produced by GatewayClient or a compatible wallet."
            />
          </label>

          <div className="unlock-actions">
            <button
              className="button secondary"
              type="button"
              onClick={refreshTerms}
              disabled={isPending}
            >
              Refresh Terms
            </button>
            <button
              className="button primary"
              type="button"
              onClick={verifyPayment}
              disabled={isPending || paymentSignature.trim().length === 0}
            >
              Verify And Unlock
            </button>
          </div>

          <p className="unlock-note">
            <ShieldAlert aria-hidden="true" size={16} />
            Browser private-key signing is intentionally not implemented yet. Use
            `apps/agent-demo` or a compatible wallet/Gateway adapter to produce
            the signature safely.
          </p>
        </>
      )}
    </section>
  );
}
