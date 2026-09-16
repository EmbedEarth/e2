import type { DatasetManifest } from "./manifest.js";
import type { PublishedSnapshot } from "./snapshots.js";
export async function downloadDataset(dataset: DatasetManifest, signal?: AbortSignal): Promise<Uint8Array> {
  if (!dataset.download?.url || dataset.status === "not_published") throw new Error(`Dataset ${dataset.feature} is not published yet`);
  const response = await fetch(dataset.download.url, { signal }); if (!response.ok) throw new Error(`Dataset download failed: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (dataset.bytes > 0 && bytes.byteLength !== dataset.bytes) throw new Error(`Dataset size mismatch for ${dataset.feature}`);
  if (dataset.sha256) { const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join(""); if (hash !== dataset.sha256.toLowerCase()) throw new Error(`Dataset checksum mismatch for ${dataset.feature}`); }
  return bytes;
}

export async function downloadSnapshot(snapshot: PublishedSnapshot, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(snapshot.downloadUrl, { signal });
  if (!response.ok) throw new Error(`Snapshot download failed: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== snapshot.sizeBytes) throw new Error(`Snapshot size mismatch for ${snapshot.id}`);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
  if (hash !== snapshot.sha256.toLowerCase()) throw new Error(`Snapshot checksum mismatch for ${snapshot.id}`);
  return bytes;
}
