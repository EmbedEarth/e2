import { DEFAULT_SNAPSHOT_API_URL, downloadSnapshot, loadSnapshotIndex, normalizeSnapshotYear, resolveSnapshotFromApi, type PublishedSnapshot } from "@embedearth/datasets";
import { FeatureClient } from "./FeatureClient.js";

/**
 * First year tried when a caller omits `year` for a year-split feature.
 * Year-split snapshots (anything that is not `osm` or `visual`) publish one
 * snapshot per year, so the default narrows to the newest available year by
 * trying this year first and cascading down.
 */
export const DEFAULT_SNAPSHOT_YEAR_START = 2026;
const SNAPSHOT_YEAR_FLOOR = 2000;
const NON_YEAR_SPLIT_TYPES = new Set(["osm", "visual"]);

function cascadeStartYear(): number {
  return Math.max(new Date().getUTCFullYear(), DEFAULT_SNAPSHOT_YEAR_START);
}

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
  async resolveSnapshot(feature: string | number, regionId: string | null = null, signal?: AbortSignal, year?: string | number | null): Promise<PublishedSnapshot> {
    const resolved = this.features.resolve(feature);
    const normalizedYear = normalizeSnapshotYear(year);
    if (normalizedYear) {
      return resolveSnapshotFromApi({ featureId: resolved.id, feature: resolved.key, featureName: resolved.name, regionId, year: normalizedYear, apiUrl: this.stratumApiUrl, signal });
    }
    if (NON_YEAR_SPLIT_TYPES.has(resolved.featureType)) {
      return resolveSnapshotFromApi({ featureId: resolved.id, feature: resolved.key, featureName: resolved.name, regionId, apiUrl: this.stratumApiUrl, signal });
    }
    // Year-split features default to the newest available year: try the
    // current year first and cascade down (2026, 2025, ...) before falling
    // back to the combined snapshot.
    for (let candidate = cascadeStartYear(); candidate >= SNAPSHOT_YEAR_FLOOR; candidate--) {
      try {
        return await resolveSnapshotFromApi({ featureId: resolved.id, feature: resolved.key, featureName: resolved.name, regionId, year: String(candidate), apiUrl: this.stratumApiUrl, signal });
      } catch (error) {
        if (signal?.aborted) throw error;
        if (error instanceof Error && /HTTP 404|No published snapshot/i.test(error.message)) continue;
        throw error;
      }
    }
    return resolveSnapshotFromApi({ featureId: resolved.id, feature: resolved.key, featureName: resolved.name, regionId, apiUrl: this.stratumApiUrl, signal });
  }
  async download(options: { feature: string | number; regionId?: string | null; year?: string | number | null; signal?: AbortSignal }): Promise<Uint8Array> {
    return downloadSnapshot(await this.resolveSnapshot(options.feature, options.regionId ?? null, options.signal, options.year), options.signal);
  }
}
