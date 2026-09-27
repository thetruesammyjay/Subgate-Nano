"use client";

import { ArrowLeft, Check, Save } from "../../components/dashboards/dashboard-icons";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Creator } from "../../types/auth";
import type { PricingModel, StreamType } from "../../types/stream";

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function StreamForm({ creator }: { creator: Creator }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [streamType, setStreamType] = useState<StreamType>("video");
  const [pricingModel, setPricingModel] = useState<PricingModel>("pay_per_view");
  const [amount, setAmount] = useState("0.10");
  const [preview, setPreview] = useState("30");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [published, setPublished] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const generatedSlug = useMemo(() => slug || slugify(title), [slug, title]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const amountAtomic = Math.round(Number(amount) * 1_000_000);
    const payload = {
      creator_wallet: creator.wallet_address,
      creator_display_name: creator.display_name,
      slug: generatedSlug,
      title,
      description,
      stream_type: streamType,
      pricing: pricingModel === "pay_per_view"
        ? { model: pricingModel, price_atomic: amountAtomic, rate_atomic_per_minute: null }
        : { model: pricingModel, price_atomic: null, rate_atomic_per_minute: amountAtomic },
      free_preview_seconds: Number(preview) || 0,
      playback_url: playbackUrl,
      is_published: published,
    };

    try {
      const response = await fetch("/api/streams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.detail ?? result?.message ?? "Unable to create the stream.");
      router.push("/dashboard/streams");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the stream.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="dashboard-page">
      <Link className="back-link" href="/dashboard/streams"><ArrowLeft size={15} /> Back to streams</Link>
      <div className="page-heading-row form-heading"><div><p className="eyebrow">NEW ACCESS POINT</p><h1>Give your next stream a door.</h1><p className="page-lede">Keep the offer clear. Viewers should understand the price before they press play.</p></div></div>
      <form className="editor-layout" onSubmit={submit}>
        <section className="panel form-panel"><div className="panel-heading"><div><span className="utility-label">Stream details</span><h2>What are you publishing?</h2></div></div>
          <label className="field-label"><span>Title</span><input required maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); if (!slug) setSlug(slugify(event.target.value)); }} placeholder="A clear name for the stream" /></label>
          <label className="field-label"><span>Public slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={generatedSlug} onChange={(event) => setSlug(event.target.value)} /><small>subgate.app/streams/{generatedSlug || "your-stream"}</small></label>
          <label className="field-label"><span>Description</span><textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will a viewer get when they open this?" /></label>
          <div className="field-grid"><label className="field-label"><span>Stream type</span><select value={streamType} onChange={(event) => setStreamType(event.target.value as StreamType)}><option value="video">Video</option><option value="livestream">Livestream</option></select></label><label className="field-label"><span>Free preview (seconds)</span><input min="0" max="3600" type="number" value={preview} onChange={(event) => setPreview(event.target.value)} /></label></div>
          <label className="field-label"><span>Playback URL</span><input required type="url" value={playbackUrl} onChange={(event) => setPlaybackUrl(event.target.value)} placeholder="https://.../playlist.m3u8" /><small>Use a public HLS, MP4, or live playback URL for now.</small></label>
        </section>
        <aside className="panel form-panel editor-aside"><div className="panel-heading"><div><span className="utility-label">Access rule</span><h2>How should it charge?</h2></div></div>
          <div className="pricing-switch"><button className={pricingModel === "pay_per_view" ? "selected" : ""} type="button" onClick={() => setPricingModel("pay_per_view")}>Pay per view<small>One settled access</small></button><button className={pricingModel === "metered" ? "selected" : ""} type="button" onClick={() => setPricingModel("metered")}>Pay as you watch<small>USDC per minute</small></button></div>
          <label className="field-label"><span>{pricingModel === "pay_per_view" ? "Price per access (USDC)" : "Rate per minute (USDC)"}</span><input required min="0.000001" step="0.000001" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label className="toggle-row"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>Publish immediately</strong><small>Make this stream visible as soon as it is saved.</small></span><Check aria-hidden="true" size={16} /></label>
          <div className="editor-preview"><span className="utility-label">Viewer sees</span><strong>{title || "Your stream title"}</strong><p>{pricingModel === "pay_per_view" ? `${amount || "0.00"} USDC once` : `${amount || "0.00"} USDC per minute`}</p></div>
          {message ? <p className="form-message error-message">{message}</p> : null}
          <button className="button primary button-wide" type="submit" disabled={pending}><Save aria-hidden="true" size={16} /> {pending ? "Saving..." : "Save stream"}</button>
        </aside>
      </form>
    </div>
  );
}
