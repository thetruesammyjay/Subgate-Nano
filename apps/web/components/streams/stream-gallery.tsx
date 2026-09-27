"use client";

import { useEffect, useState } from "react";
import { RadioTower, RefreshCw } from "../dashboards/dashboard-icons";
import type { Stream } from "../../types/stream";
import { StreamCard } from "./stream-card";

export function StreamGallery() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/streams", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "The stream directory is unavailable.");
      setStreams(Array.isArray(payload) ? payload : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load streams.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="gallery-state"><span className="loading-pulse" /><p>Listening for published streams...</p></div>;
  if (error) return <div className="gallery-state gallery-error"><p>{error}</p><button className="button secondary" type="button" onClick={() => void load()}><RefreshCw size={15} /> Try again</button></div>;
  if (!streams.length) return <div className="gallery-state"><RadioTower aria-hidden="true" size={24} /><h3>No published streams yet.</h3><p>Creators are setting the first access points. Check back soon, or publish your own.</p></div>;
  return <div className="stream-gallery">{streams.map((stream) => <StreamCard key={stream.id} stream={stream} />)}</div>;
}
