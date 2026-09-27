import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { StreamViewer } from "../../../features/viewer/stream-viewer";
import { getStream } from "../../../lib/api-client";

export const dynamic = "force-dynamic";

export default async function StreamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stream = await getStream(slug).catch(() => null);
  if (!stream) notFound();
  return <main className="public-page"><SiteHeader /><StreamViewer stream={stream} /></main>;
}
