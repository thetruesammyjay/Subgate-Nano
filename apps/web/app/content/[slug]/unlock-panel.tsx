"use client";

import {
  CheckCircle2,
  Clipboard,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import type {
  ContentUnlock,
  X402PaymentRequired,
  X402SettlementResponse,
} from "@subgate/types";
import type { UnlockProxyResponse } from "../../../lib/subgate-api";

type UnlockPanelProps = {
  slug: string;
  initialPaymentRequiredHeader: string | null;
  initialTermsJson: string | null;
};

type UnlockStep = "terms" | "ready" | "signing" | "verifying" | "unlocked" | "error";

type EthereumProvider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

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

const encodeBase64Json = (value: unknown): string => {
  return btoa(JSON.stringify(value));
};

const decodeBase64Json = <T,>(value: string): T => {
  return JSON.parse(atob(value)) as T;
};

const parseTermsJson = (value: string | null): X402PaymentRequired | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as X402PaymentRequired;
  } catch {
    return null;
  }
};

const formatAtomicUsdc = (amount: string) => {
  const value = Number(amount) / 1_000_000;

  return `$${value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} USDC`;
};

const shortAddress = (value: string) => {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
};

const parseSettlementResponse = (
  content: ContentUnlock,
  paymentResponseHeader: string | null,
): X402SettlementResponse | null => {
  if (paymentResponseHeader) {
    try {
      return decodeBase64Json<X402SettlementResponse>(paymentResponseHeader);
    } catch {
      // Fall back to the response body below.
    }
  }

  const record = getRecord(content.paymentResponse);

  if (!record || typeof record.success !== "boolean") {
    return null;
  }

  return {
    success: record.success,
    transaction: typeof record.transaction === "string" ? record.transaction : "",
    network: typeof record.network === "string" ? record.network : "unknown",
    payer: typeof record.payer === "string" ? record.payer : undefined,
    errorReason:
      typeof record.errorReason === "string" ? record.errorReason : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    raw: record.raw,
  };
};

const createPaymentSignature = async (
  paymentRequired: X402PaymentRequired,
): Promise<string> => {
  const accepted = paymentRequired.accepts[0];

  if (!accepted) {
    throw new Error("No supported payment terms were returned.");
  }

  if (!accepted.extra) {
    throw new Error("Gateway payment terms are missing batching metadata.");
  }

  if (!window.ethereum) {
    throw new Error("No browser wallet was found.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  const account = Array.isArray(accounts) ? accounts[0] : null;

  if (typeof account !== "string" || !account.startsWith("0x")) {
    throw new Error("No wallet account was selected.");
  }

  const { BatchEvmScheme } = await import("@circle-fin/x402-batching/client");
  const scheme = new BatchEvmScheme({
    address: account as `0x${string}`,
    async signTypedData(params) {
      const signature = await window.ethereum?.request({
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(params)],
      });

      if (typeof signature !== "string" || !signature.startsWith("0x")) {
        throw new Error("Wallet did not return a valid signature.");
      }

      return signature as `0x${string}`;
    },
  });
  const payment = await scheme.createPaymentPayload(
    paymentRequired.x402Version,
    {
      scheme: accepted.scheme,
      network: accepted.network,
      asset: accepted.asset,
      amount: accepted.amount,
      payTo: accepted.payTo,
      maxTimeoutSeconds: accepted.maxTimeoutSeconds,
      extra: accepted.extra,
    },
  );

  return encodeBase64Json(payment);
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
  const [unlockedContent, setUnlockedContent] = useState<ContentUnlock | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<X402SettlementResponse | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<UnlockStep>(
    initialPaymentRequiredHeader ? "ready" : "terms",
  );
  const [isWorking, setIsWorking] = useState(false);
  const paymentRequired = parseTermsJson(termsJson);
  const acceptedTerms = paymentRequired?.accepts[0] ?? null;

  const copyTerms = async () => {
    if (!paymentRequiredHeader) {
      return;
    }

    try {
      await navigator.clipboard.writeText(paymentRequiredHeader);
      setMessage("PAYMENT-REQUIRED header copied.");
    } catch {
      setMessage("Could not copy payment terms from this browser.");
    }
  };

  const copyReceipt = async () => {
    if (!unlockedContent) {
      return;
    }

    const receipt = {
      contentId: unlockedContent.id,
      paymentId: unlockedContent.paymentId,
      accessGrantId: unlockedContent.accessGrantId,
      settlement: paymentReceipt,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setMessage("Receipt copied.");
    } catch {
      setMessage("Could not copy the receipt from this browser.");
    }
  };

  const refreshTerms = async () => {
    setMessage(null);
    setStep("terms");
    setIsWorking(true);

    try {
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
    } catch (error) {
      setStep("error");
      setMessage(error instanceof Error ? error.message : "Unable to refresh payment terms.");
    } finally {
      setIsWorking(false);
    }
  };

  const payAndUnlock = async () => {
    setMessage(null);
    setStep("signing");
    setIsWorking(true);

    try {
      let latestPaymentRequired = paymentRequired;

      if (!latestPaymentRequired) {
        setStep("terms");
        setMessage("Loading fresh payment terms.");
        const termsResult = await fetchUnlockTerms(slug);

        if (termsResult.status !== "payment_required") {
          if (termsResult.status === "unlocked") {
            setUnlockedContent(termsResult.content);
            setPaymentReceipt(
              parseSettlementResponse(
                termsResult.content,
                termsResult.paymentResponseHeader,
              ),
            );
            setStep("unlocked");
            setMessage("Content unlocked.");
            return;
          }

          setStep("error");
          setMessage(termsResult.message);
          return;
        }

        latestPaymentRequired = termsResult.paymentRequired;
        setPaymentRequiredHeader(termsResult.paymentRequiredHeader);
        setTermsJson(JSON.stringify(termsResult.paymentRequired, null, 2));
      }

      let signature: string;

      try {
        setStep("signing");
        setMessage("Review and sign the x402 authorization in your wallet.");
        signature = await createPaymentSignature(latestPaymentRequired);
      } catch (error) {
        setStep("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Wallet could not create the x402 payment.",
        );
        return;
      }

      setStep("verifying");
      setMessage("Submitting payment for settlement.");
      const result = await submitPaymentSignature(slug, signature);

      if (result.status === "unlocked") {
        setUnlockedContent(result.content);
        setPaymentReceipt(
          parseSettlementResponse(result.content, result.paymentResponseHeader),
        );
        setStep("unlocked");
        setMessage("Payment signed, settled, and access granted.");
        return;
      }

      if (result.status === "payment_required") {
        setPaymentRequiredHeader(result.paymentRequiredHeader);
        setTermsJson(JSON.stringify(result.paymentRequired, null, 2));
        setStep("ready");
        setMessage("Payment was not accepted. Review the latest terms and try again.");
        return;
      }

      setStep("error");
      setMessage(result.message);
    } catch (error) {
      setStep("error");
      setMessage(error instanceof Error ? error.message : "Unable to complete payment.");
    } finally {
      setIsWorking(false);
    }
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
          <div className="unlock-receipt">
            <div>
              <span>
                <ReceiptText aria-hidden="true" size={16} /> Receipt
              </span>
              <button className="mini-button" type="button" onClick={copyReceipt}>
                <Clipboard aria-hidden="true" size={14} /> Copy Receipt
              </button>
            </div>
            <div className="unlock-receipt-grid">
              <article>
                <span>Payment</span>
                <strong>{unlockedContent.paymentId}</strong>
              </article>
              <article>
                <span>Access Grant</span>
                <strong>{unlockedContent.accessGrantId}</strong>
              </article>
              <article>
                <span>Transaction</span>
                <strong>
                  {paymentReceipt?.transaction
                    ? shortAddress(paymentReceipt.transaction)
                    : "Recorded"}
                </strong>
              </article>
              <article>
                <span>Network</span>
                <strong>{paymentReceipt?.network ?? "Gateway"}</strong>
              </article>
            </div>
          </div>
        </article>
      ) : (
        <>
          <div className="unlock-terms">
            <div>
              <span>Payment Terms</span>
              <button
                className="mini-button"
                type="button"
                onClick={copyTerms}
                disabled={!paymentRequiredHeader}
              >
                <Clipboard aria-hidden="true" size={14} /> Copy Header
              </button>
            </div>
            {acceptedTerms ? (
              <div className="reader-payment-summary">
                <article>
                  <span>Amount</span>
                  <strong>{formatAtomicUsdc(acceptedTerms.amount)}</strong>
                </article>
                <article>
                  <span>Network</span>
                  <strong>{acceptedTerms.network}</strong>
                </article>
                <article>
                  <span>Seller</span>
                  <strong>{shortAddress(acceptedTerms.payTo)}</strong>
                </article>
              </div>
            ) : (
              <pre>No terms loaded yet. Request fresh terms from the API.</pre>
            )}
          </div>

          <div className="unlock-actions">
            <button
              className="button secondary"
              type="button"
              onClick={refreshTerms}
              disabled={isWorking}
            >
              <RefreshCw aria-hidden="true" size={16} /> Refresh Terms
            </button>
            <button
              className="button primary"
              type="button"
              onClick={payAndUnlock}
              disabled={isWorking}
            >
              <WalletCards aria-hidden="true" size={16} />{" "}
              {step === "signing"
                ? "Awaiting Signature"
                : step === "verifying"
                  ? "Verifying"
                  : "Pay And Unlock"}
            </button>
          </div>

          <p className="unlock-note">
            <ShieldAlert aria-hidden="true" size={16} />
            Your wallet signs the x402 Gateway authorization in-browser; private
            keys never enter Subgate. The wallet needs an available Gateway USDC
            balance for settlement to succeed.
          </p>
        </>
      )}
    </section>
  );
}
