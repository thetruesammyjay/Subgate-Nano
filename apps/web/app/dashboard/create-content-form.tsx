"use client";

import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import type { ContentItem, Creator, PricingModel } from "@subgate/types";

type CreateContentFormProps = {
  creators: Creator[];
};

type PricingType = PricingModel["type"];

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const buildPricing = (
  pricingType: PricingType,
  amount: number,
  durationSeconds: number,
): PricingModel => {
  switch (pricingType) {
    case "per_access":
      return { type: "per_access", priceUsdc: amount };
    case "per_citation":
      return { type: "per_citation", priceUsdc: amount };
    case "per_second":
      return { type: "per_second", rateUsdc: amount };
    case "timed":
      return { type: "timed", priceUsdc: amount, durationSeconds };
  }
};

export function CreateContentForm({ creators }: CreateContentFormProps) {
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugDirty, setIsSlugDirty] = useState(false);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [pricingType, setPricingType] = useState<PricingType>("per_access");
  const [amount, setAmount] = useState("0.003");
  const [durationSeconds, setDurationSeconds] = useState("86400");
  const [createdContent, setCreatedContent] = useState<ContentItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createdPath = createdContent ? `/content/${createdContent.slug}` : "";
  const canSubmit = Boolean(
    creators.length > 0 &&
      title.trim() &&
      slug.trim() &&
      summary.trim() &&
      body.trim() &&
      Number(amount) > 0,
  );

  const clearResult = () => {
    setCreatedContent(null);
    setHasCopied(false);
    setMessage(null);
  };

  const generateSlug = () => {
    clearResult();
    setSlug(slugify(title));
    setIsSlugDirty(false);
  };

  const changeTitle = (value: string) => {
    clearResult();
    setTitle(value);

    if (!isSlugDirty) {
      setSlug(slugify(value));
    }
  };

  const changeSlug = (value: string) => {
    clearResult();
    setIsSlugDirty(true);
    setSlug(slugify(value));
  };

  const copyCreatedLink = async () => {
    if (!createdContent) {
      return;
    }

    const origin = globalThis.location?.origin ?? "";

    try {
      await navigator.clipboard.writeText(`${origin}${createdPath}`);
      setHasCopied(true);
    } catch {
      setMessage("Could not copy the link. Open the content and copy it from the address bar.");
    }
  };

  const submit = async () => {
    setMessage(null);
    setCreatedContent(null);
    setHasCopied(false);
    setIsSubmitting(true);

    try {
      const price = Number(amount);
      const duration = Number(durationSeconds);
      const normalizedSlug = slugify(slug);

      if (!normalizedSlug) {
        setMessage("Add a URL slug before publishing.");
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        setMessage("Price must be greater than zero.");
        return;
      }

      if (pricingType === "timed" && (!Number.isInteger(duration) || duration <= 0)) {
        setMessage("Timed pricing requires a positive duration in seconds.");
        return;
      }

      const response = await fetch("/api/dashboard/content", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          creatorId,
          title: title.trim(),
          slug: normalizedSlug,
          summary: summary.trim(),
          body: body.trim(),
          pricing: buildPricing(pricingType, price, duration),
          isActive: true,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          typeof payload?.message === "string"
            ? payload.message
            : "Failed to publish content.",
        );
        return;
      }

      setCreatedContent(payload as ContentItem);
      setSlug(normalizedSlug);
      setMessage("Content published and available in the live catalog.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to publish content.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="dashboard-form-panel">
      <div className="dashboard-panel-heading">
        <span>
          <Wand2 aria-hidden="true" size={16} /> Publish Content
        </span>
        <strong>PROTECTED POST</strong>
      </div>

      <div className="form-grid">
        <label>
          <span>Creator</span>
          <select
            value={creatorId}
            onChange={(event) => {
              clearResult();
              setCreatorId(event.target.value);
            }}
          >
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.displayName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Pricing Type</span>
          <select
            value={pricingType}
            onChange={(event) => {
              clearResult();
              setPricingType(event.target.value as PricingType);
            }}
          >
            <option value="per_access">Per access</option>
            <option value="per_citation">Per citation</option>
            <option value="per_second">Per second</option>
            <option value="timed">Timed access</option>
          </select>
        </label>
      </div>

      <label>
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => changeTitle(event.target.value)}
          placeholder="Premium Arc settlement memo"
        />
      </label>

      <label>
        <span>Slug</span>
        <div className="slug-control">
          <input
            value={slug}
            onChange={(event) => changeSlug(event.target.value)}
            placeholder="premium-arc-settlement-memo"
          />
          <button className="mini-button" type="button" onClick={generateSlug}>
            Generate
          </button>
        </div>
      </label>

      <label>
        <span>Summary</span>
        <textarea
          value={summary}
          onChange={(event) => {
            clearResult();
            setSummary(event.target.value);
          }}
          placeholder="Short locked preview for the catalog."
        />
      </label>

      <label>
        <span>Body</span>
        <textarea
          value={body}
          onChange={(event) => {
            clearResult();
            setBody(event.target.value);
          }}
          placeholder="The unlocked content body readers receive after settlement."
        />
      </label>

      <div className="form-grid">
        <label>
          <span>{pricingType === "per_second" ? "Rate USDC / second" : "Price USDC"}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              clearResult();
              setAmount(event.target.value);
            }}
          />
        </label>

        <label>
          <span>Duration Seconds</span>
          <input
            disabled={pricingType !== "timed"}
            inputMode="numeric"
            value={durationSeconds}
            onChange={(event) => {
              clearResult();
              setDurationSeconds(event.target.value);
            }}
          />
        </label>
      </div>

      <button
        className="button primary"
        type="button"
        disabled={!canSubmit || isSubmitting}
        onClick={submit}
      >
        {isSubmitting ? "Publishing" : "Publish Content"}{" "}
        <ArrowRight aria-hidden="true" size={16} />
      </button>

      {message && <p className="dashboard-message">{message}</p>}

      {createdContent && (
        <div className="created-content-panel">
          <div>
            <span>
              <CheckCircle2 aria-hidden="true" size={16} /> Ready To Sell
            </span>
            <strong>{createdContent.title}</strong>
            <code>{createdPath}</code>
          </div>

          <div className="created-content-actions">
            <button className="mini-button" type="button" onClick={copyCreatedLink}>
              <Copy aria-hidden="true" size={15} />
              {hasCopied ? "Copied" : "Copy Link"}
            </button>
            <a className="created-content-link" href={createdPath}>
              <ExternalLink aria-hidden="true" size={15} />
              Open
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
