import { DEFAULT_SNAPSHOT_API_URL, downloadSnapshot, loadSnapshotIndex, resolveSnapshotFromApi, type PublishedSnapshot } from "@embedearth/datasets";
import { FeatureClient } from "./FeatureClient.js";

export interface DatasetListing {
  featureId: number;
  feature: string;
  name: string;
  source: string;
  status: "snapshot_index";
}

export class DatasetClient {
  constructor(private readonly features = new FeatureClient(), private readonly stratumApiUrl = DEFAULT_SNAPSHOT_API_URL) {}
  list(): DatasetListing[] { return this.features.list().map((item) => ({ featureId: item.id, feature: item.key, name: item.name, source: item.featureType, status: "snapshot_index" })); }
  info(feature: string | number): DatasetListing { const item = this.features.resolve(feature); return { featureId: item.id, feature: item.key, name: item.name, source: item.featureType, status: "snapshot_index" }; }
  async listSnapshots(signal?: AbortSignal): Promise<PublishedSnapshot[]> { return (await loadSnapshotIndex(undefined, signal)).snapshots; }
  async resolveSnapshot(feature: string | number, regionId: string | null = null, signal?: AbortSignal): Promise<PublishedSnapshot> {
    const resolved = this.features.resolve(feature);
    return resolveSnapshotFromApi({ featureId: resolved.id, feature: resolved.key, featureName: resolved.name, regionId, apiUrl: this.stratumApiUrl, signal });
  }
  async download(options: { feature: string | number; regionId?: string | null; signal?: AbortSignal }): Promise<Uint8Array> {
    return downloadSnapshot(await this.resolveSnapshot(options.feature, options.regionId ?? null, options.signal), options.signal);
  }
}
