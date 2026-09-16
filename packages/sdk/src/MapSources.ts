import { loadSnapshotIndex, type PublishedSnapshot } from "@embedearth/datasets";

export const PLANET_PMTILES_URL = "https://tiles.embed.earth/basemaps/planet.pmtiles";

export type MapSource = {
  type: "planet" | "feature";
  id: string;
  feature?: string;
  featureId?: number;
  snapshotId?: string;
  snapshotDate?: string;
  url: string;
  regionId?: string | null;
};

function normalize(value: string): string {
  return decodeURIComponent(value).trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function aliases(value: string): string[] {
  const normalized = normalize(value);
  const values = [normalized];
  if (normalized.endsWith("ies")) values.push(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith("s")) values.push(normalized.slice(0, -1));
  return values;
}

export function selectMapSnapshot(snapshots: PublishedSnapshot[], feature: string | number, regionId: string | null = null): PublishedSnapshot | undefined {
  const requested = new Set(aliases(String(feature)));
  return snapshots
    .filter((snapshot) => snapshot.schemaVersion === 2 && snapshot.regionId === regionId && snapshot.pmtilesDownloadUrl && (!snapshot.pmtilesStatus || snapshot.pmtilesStatus === "published"))
    .filter((snapshot) => snapshot.featureId === feature || [snapshot.feature, snapshot.featureName].filter(Boolean).some((value) => aliases(String(value)).some((alias) => requested.has(alias))))
    .sort((first, second) => second.snapshotDate.localeCompare(first.snapshotDate))[0];
}

export function mapSources(snapshots: PublishedSnapshot[], features: Array<string | number> = []): MapSource[] {
  const sources: MapSource[] = [{ type: "planet", id: "planet", url: PLANET_PMTILES_URL }];
  for (const feature of features) {
    const snapshot = selectMapSnapshot(snapshots, feature);
    if (!snapshot?.pmtilesDownloadUrl) continue;
    sources.push({
      type: "feature", id: `feature-${snapshot.featureId}`, feature: snapshot.feature,
      featureId: snapshot.featureId, snapshotId: String(snapshot.id), snapshotDate: snapshot.snapshotDate,
      url: snapshot.pmtilesDownloadUrl, regionId: snapshot.regionId,
    });
  }
  return sources;
}

export async function listMapSources(features: Array<string | number> = [], signal?: AbortSignal): Promise<MapSource[]> {
  return mapSources((await loadSnapshotIndex(undefined, signal)).snapshots, features);
}
