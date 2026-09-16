import { describe, expect, it } from "vitest";
import { selectSnapshot, snapshotFromApiRow, type SnapshotIndex } from "../src/snapshots.js";

const index: SnapshotIndex = {
  schemaVersion: 2,
  datasetSchemaVersion: 2,
  generatedAt: "2026-08-13T00:00:00Z",
  capabilities: { modes: ["cloud", "offline", "auto"], format: "geoparquet", geometry: "WKB", crs: "OGC:CRS84", httpRangeQueries: true, propertyFilters: true },
  featureIndexes: {},
  snapshots: [
    { id: "old", featureId: 113, feature: "schools", featureName: "Schools", regionId: null, regionName: null, regionType: null, downloadUrl: "https://example.test/old", totalRows: 1, sizeBytes: 1, downloadMb: 0, sha256: "a".repeat(64), year: "0000", snapshotDate: "2025-01-01", lastPublished: "2025-01-01", format: "geoparquet", schemaVersion: 2, geoParquetVersion: "1.1.0", geometryColumn: "geometry", crs: "OGC:CRS84", h3Resolution: 10 },
    { id: "new", featureId: 113, feature: "schools", featureName: "Schools", regionId: "1", regionName: "New York", regionType: "city", downloadUrl: "https://example.test/new", totalRows: 2, sizeBytes: 2, downloadMb: 0, sha256: "b".repeat(64), year: "0000", snapshotDate: "2026-01-01", lastPublished: "2026-01-01", format: "geoparquet", schemaVersion: 2, geoParquetVersion: "1.1.0", geometryColumn: "geometry", crs: "OGC:CRS84", h3Resolution: 10 },
  ],
};

describe("snapshot selection", () => {
  it("selects an exact feature and region", () => expect(selectSnapshot(index, 113, "1").id).toBe("new"));
  it("keeps overall and region scopes distinct", () => expect(selectSnapshot(index, 113).id).toBe("old"));
  it("does not silently fall back to overall", () => expect(() => selectSnapshot(index, 113, "2")).toThrow("No published snapshot"));

  it("maps a resolved Snapshot API row to the downloadable GeoParquet asset", () => {
    const snapshot = snapshotFromApiRow({
      id: "api", feature_id: 113, region_id: null,
      download_url: "https://example.test/api.parquet", total_rows: 4, size_bytes: 16, download_mb: 0.001,
      sha256: "c".repeat(64), year: "0000", snapshot_date: "2026-09-09", last_published: null,
      format: "geoparquet", schema_version: 2, geoparquet_version: "1.1.0", geometry_column: "geometry", crs: "OGC:CRS84", h3_resolution: 10,
    }, "school", "Schools");
    expect(snapshot.downloadUrl).toBe("https://example.test/api.parquet");
    expect(snapshot.regionId).toBeNull();
    expect(snapshot.lastPublished).toBe("2026-09-09");
  });
});
