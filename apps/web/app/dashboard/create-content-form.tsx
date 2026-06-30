"use client";

import { ArrowRight, CheckCircle2, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
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
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [pricingType, setPricingType] = useState<PricingType>("per_access");
  const [amount, setAmount] = useState("0.003");
  const [durationSeconds, setDurationSeconds] = useState("86400");
  const [createdContent, setCreatedContent] = useState<ContentItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSubmit = creators.length > 0 && title && slug && summary && body;

  const generateSlug = () => {
    setSlug(slugify(title));
  };

  const submit = () => {
    setMessage(null);
    setCreatedContent(null);

    startTransition(async () => {
      const price = Number(amount);
      const duration = Number(durationSeconds);

      if (!Number.isFinite(price) || price < 0) {
        setMessage("Price must be a valid non-negative number.");
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
          title,
          slug,
          summary,
          body,
          pricing: buildPricing(pricingType, price, duration),
          isActive: true,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(
          typeof payload?.message === "string"
            ? payload.message
            : "Failed to publish content.",
        );
        return;
      }

      setCreatedContent(payload as ContentItem);
      setMessage("Content published and available in the live catalog.");
    });
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
          <select value={creatorId} onChange={(event) => setCreatorId(event.target.value)}>
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
            onChange={(event) => setPricingType(event.target.value as PricingType)}
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
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Premium Arc settlement memo"
        />
      </label>

      <label>
        <span>Slug</span>
        <div className="slug-control">
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
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
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Short locked preview for the catalog."
        />
      </label>

      <label>
        <span>Body</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="The unlocked content body readers receive after settlement."
        />
      </label>

      <div className="form-grid">
        <label>
          <span>{pricingType === "per_second" ? "Rate USDC / second" : "Price USDC"}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label>
          <span>Duration Seconds</span>
          <input
            disabled={pricingType !== "timed"}
            inputMode="numeric"
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(event.target.value)}
          />
        </label>
      </div>

      <button
        className="button primary"
        type="button"
        disabled={!canSubmit || isPending}
        onClick={submit}
      >
        Publish To API <ArrowRight aria-hidden="true" size={16} />
      </button>

      {message && <p className="dashboard-message">{message}</p>}

      {createdContent && (
        <a className="created-content-link" href={`/content/${createdContent.slug}`}>
          <CheckCircle2 aria-hidden="true" size={17} />
          View {createdContent.title}
        </a>
      )}
    </section>
  );
}
