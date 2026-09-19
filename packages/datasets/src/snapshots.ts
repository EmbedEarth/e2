import document from "../../../catalog/datasets.json" with { type: "json" };

export interface PublishedSnapshot {
  id: string; featureId: number; feature: string; featureName: string;
  regionId: string | null; regionName: string | null; regionType: string | null;
  downloadUrl: string; totalRows: number; sizeBytes: number; downloadMb: number;
  sha256: string; year: string; snapshotDate: string; lastPublished: string;
  pmtilesDownloadUrl?: string | null; pmtilesStatus?: string | null;
  pmtilesSizeBytes?: number | null; pmtilesSha256?: string | null; pmtilesCompletedAt?: string | null;
  format: "geoparquet"; schemaVersion: number; geoParquetVersion: string;
  geometryColumn: "geometry"; crs: string; h3Resolution: number;
}
export interface SnapshotCapabilities {
  modes: Array<"cloud" | "offline" | "auto">; format: "geoparquet";
  geometry: "WKB"; crs: string; httpRangeQueries: boolean; propertyFilters: boolean;
}
export interface SnapshotIndex {
  schemaVersion: 2; datasetSchemaVersion: number; generatedAt: string;
  capabilities: SnapshotCapabilities; featureIndexes: Record<string, string>;
  snapshots: PublishedSnapshot[];
}
type CacheEntry = { etag?: string; value: SnapshotIndex };
const cache = new Map<string, CacheEntry>();
export const DEFAULT_SNAPSHOT_INDEX_URL = document.snapshotIndex.url;
export const DEFAULT_SNAPSHOT_API_URL = "https://e2-snapshots-sqlite.fly.dev";

export interface SnapshotApiRow {
  id: string; feature_id: number; region_id: number | null;
  download_url: string; total_rows: number; size_bytes: number; download_mb: number;
  sha256: string; year: string; snapshot_date: string; last_published: string | null;
  format: "geoparquet"; schema_version: number; geoparquet_version: string;
  geometry_column: "geometry"; crs: string; h3_resolution: number;
  pmtiles_download_url?: string | null; pmtiles_status?: string | null;
  pmtiles_size_bytes?: number | null; pmtiles_sha256?: string | null; pmtiles_completed_at?: string | null;
}
interface SnapshotApiResolution { asset: "geoparquet"; url: string; snapshot: SnapshotApiRow; }

function apiRegionId(regionId: string | null): string | null {
  if (!regionId) return null;
  const matched = /^(\d+)$/u.exec(regionId);
  if (!matched) throw new TypeError(`Snapshot API requires a numeric region ID, received ${regionId}`);
  return matched[1]!;
}

export function snapshotFromApiRow(row: SnapshotApiRow, feature: string, featureName: string): PublishedSnapshot {
  if (row.format !== "geoparquet" || row.schema_version < 2 || !row.download_url || !row.sha256) throw new TypeError("Invalid published snapshot from Snapshot API");
  return {
    id: row.id, featureId: row.feature_id, feature, featureName,
    regionId: row.region_id === null ? null : String(row.region_id),
    regionName: null, regionType: null, downloadUrl: row.download_url,
    totalRows: row.total_rows, sizeBytes: row.size_bytes, downloadMb: row.download_mb,
    sha256: row.sha256, year: row.year, snapshotDate: row.snapshot_date,
    lastPublished: row.last_published ?? row.snapshot_date,
    format: row.format, schemaVersion: row.schema_version,
    geoParquetVersion: row.geoparquet_version, geometryColumn: row.geometry_column,
    crs: row.crs, h3Resolution: row.h3_resolution,
    pmtilesDownloadUrl: row.pmtiles_download_url ?? null, pmtilesStatus: row.pmtiles_status ?? null,
    pmtilesSizeBytes: row.pmtiles_size_bytes ?? null, pmtilesSha256: row.pmtiles_sha256 ?? null,
    pmtilesCompletedAt: row.pmtiles_completed_at ?? null,
  };
}

export function normalizeSnapshotYear(year: string | number | null | undefined): string | null {
  if (year === undefined || year === null) return null;
  const value = String(year).trim();
  if (!value) return null;
  if (!/^\d{1,4}$/u.test(value)) throw new TypeError(`Snapshot year must be a 1-4 digit year, received ${year}`);
  return value.padStart(4, "0");
}

export async function resolveSnapshotFromApi(options: { featureId: number; feature: string; featureName: string; regionId?: string | null; year?: string | number | null; apiUrl?: string; signal?: AbortSignal }): Promise<PublishedSnapshot> {
  const url = new URL("/search", options.apiUrl ?? DEFAULT_SNAPSHOT_API_URL);
  url.searchParams.set("feature_id", String(options.featureId));
  const regionId = apiRegionId(options.regionId ?? null);
  if (regionId) url.searchParams.set("region_id", regionId);
  const year = normalizeSnapshotYear(options.year);
  if (year) url.searchParams.set("year", year);
  const response = await fetch(url, { signal: options.signal });
  if (response.status === 404) throw new Error(`No published snapshot for feature ${options.featureId}${regionId ? ` in ${options.regionId}` : " overall"}`);
  if (!response.ok) throw new Error(`Snapshot API request failed: HTTP ${response.status}`);
  const value = await response.json() as SnapshotApiResolution;
  if (value.asset !== "geoparquet" || !value.snapshot || value.url !== value.snapshot.download_url) throw new TypeError("Invalid snapshot API resolution");
  return snapshotFromApiRow(value.snapshot, options.feature, options.featureName);
}

export async function loadSnapshotIndex(url = DEFAULT_SNAPSHOT_INDEX_URL, signal?: AbortSignal): Promise<SnapshotIndex> {
  const previous = cache.get(url); const headers = new Headers();
  if (previous?.etag) headers.set("If-None-Match", previous.etag);
  const response = await fetch(url, { headers, signal });
  if (response.status === 304 && previous) return previous.value;
  if (!response.ok) throw new Error(`Snapshot index request failed: HTTP ${response.status}`);
  const value = await response.json() as SnapshotIndex;
  if (value.schemaVersion !== 2 || value.capabilities?.format !== "geoparquet" || !Array.isArray(value.snapshots)) throw new TypeError("Invalid snapshot index");
  cache.set(url, { etag: response.headers.get("etag") ?? undefined, value });
  return value;
}

export function selectSnapshot(index: SnapshotIndex, featureId: number, regionId: string | null = null, year?: string | number | null): PublishedSnapshot {
  const normalizedYear = normalizeSnapshotYear(year);
  const scopeMatches = index.snapshots.filter((item) => item.featureId === featureId && item.regionId === regionId);
  if (normalizedYear) {
    const matches = scopeMatches.filter((item) => item.year === normalizedYear).sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
    if (!matches[0]) throw new Error(`No published snapshot for feature ${featureId}${regionId ? ` in ${regionId}` : " overall"} for year ${normalizedYear}`);
    return matches[0];
  }
  const matches = scopeMatches.sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
  if (!matches[0]) throw new Error(`No published snapshot for feature ${featureId}${regionId ? ` in ${regionId}` : " overall"}`);
  return matches[0];
}
export function clearSnapshotIndexCache(): void { cache.clear(); }
