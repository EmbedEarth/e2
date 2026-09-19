import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { normalizeSnapshotYear, type PublishedSnapshot } from "@embedearth/datasets";
import { DatasetClient } from "./DatasetClient.js";
import { CacheClient, DEFAULT_CACHE_DIRECTORY } from "./CacheClient.js";
import { getSpatialDuckDBInstance } from "./DuckDB.js";
import { isInternalResponseColumn, stripInternalColumns } from "./internalColumns.js";

export type SnapshotMode = "cloud" | "offline" | "auto";
export type SnapshotScalar = string | number | boolean;

export interface SnapshotQuery {
  feature: string | number;
  regionId?: string | null;
  /** Internal route candidate narrowing against the published H3 column. */
  h3Cells?: readonly string[];
  /**
   * Optional snapshot year (for example `"2026"`). Year-split features
   * (anything that is not `osm` or `visual`) default to the newest available
   * year, cascading down from the current year.
   */
  year?: string | number | null;
  mode?: SnapshotMode;
  localPath?: string;
  cacheDirectory?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface SnapshotResult {
  mode: "cloud" | "offline";
  snapshot: PublishedSnapshot;
  rows: Record<string, unknown>[];
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export class SnapshotQueryClient {
  constructor(private readonly datasets = new DatasetClient(), private readonly cache = new CacheClient()) {}

  cachePath(snapshot: PublishedSnapshot, directory = DEFAULT_CACHE_DIRECTORY): string {
    return join(directory, `${snapshot.id}.parquet`);
  }

  async download(options: { feature: string | number; regionId?: string | null; year?: string | number | null; output?: string; cacheDirectory?: string; signal?: AbortSignal }): Promise<string> {
    const snapshot = await this.datasets.resolveSnapshot(options.feature, options.regionId ?? null, options.signal, options.year);
    const output = options.output ?? this.cachePath(snapshot, options.cacheDirectory);
    await mkdir(dirname(output), { recursive: true });
    if (await exists(output)) {
      if (await sha256(output) === snapshot.sha256.toLowerCase()) {
        if (!options.output) await new CacheClient(options.cacheDirectory ?? this.cache.directory).touch(output, { key: snapshot.id, snapshotId: snapshot.id, feature: snapshot.feature, regionId: snapshot.regionId });
        return output;
      }
      await rm(output, { force: true });
    }
    const temporary = `${output}.part`;
    const response = await fetch(snapshot.downloadUrl, { signal: options.signal });
    if (!response.ok || !response.body) throw new Error(`Snapshot download failed: HTTP ${response.status}`);
    try {
      if (!options.output) await new CacheClient(options.cacheDirectory ?? this.cache.directory).ensureCapacity(snapshot.sizeBytes);
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(temporary));
      if (await sha256(temporary) !== snapshot.sha256.toLowerCase()) throw new Error(`Snapshot checksum mismatch for ${snapshot.id}`);
      await rename(temporary, output);
      if (!options.output) await new CacheClient(options.cacheDirectory ?? this.cache.directory).touch(output, { key: snapshot.id, snapshotId: snapshot.id, feature: snapshot.feature, regionId: snapshot.regionId });
      return output;
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async query(query: SnapshotQuery): Promise<SnapshotResult> {
    const snapshot = await this.datasets.resolveSnapshot(query.feature, query.regionId ?? null, query.signal, query.year);
    const requestedYear = normalizeSnapshotYear(query.year) ?? (snapshot.year !== "0000" ? snapshot.year : null);
    if (snapshot.format !== "geoparquet" || snapshot.schemaVersion < 2) throw new Error(`Snapshot ${snapshot.id} is not a supported GeoParquet snapshot`);
    const mode = query.mode ?? "auto";
    const cached = query.localPath ?? this.cachePath(snapshot, query.cacheDirectory);
    let source: string;
    let resolvedMode: "cloud" | "offline";
    if (mode === "offline") {
      if (!(await exists(cached))) throw new Error(`Offline snapshot is not cached: ${cached}`);
      if (await sha256(cached) !== snapshot.sha256.toLowerCase()) throw new Error(`Cached snapshot checksum mismatch for ${snapshot.id}`);
      source = cached; resolvedMode = "offline";
      if (!query.localPath) await new CacheClient(query.cacheDirectory ?? this.cache.directory).touch(cached, { key: snapshot.id, snapshotId: snapshot.id, feature: snapshot.feature, regionId: snapshot.regionId });
    } else if (mode === "auto" && await exists(cached) && await sha256(cached) === snapshot.sha256.toLowerCase()) {
      source = cached; resolvedMode = "offline";
      if (!query.localPath) await new CacheClient(query.cacheDirectory ?? this.cache.directory).touch(cached, { key: snapshot.id, snapshotId: snapshot.id, feature: snapshot.feature, regionId: snapshot.regionId });
    } else {
      source = snapshot.downloadUrl; resolvedMode = "cloud";
    }

    const parameters: SnapshotScalar[] = [source];

    const instance = await getSpatialDuckDBInstance();
    const connection = await instance.connect();
    try {
      const description = await connection.runAndReadAll("DESCRIBE SELECT * FROM read_parquet($1)", [source]);
      const available = new Set((description.getRowObjectsJson() as Array<{ column_name?: unknown }>).map((row) => String(row.column_name ?? "")));
      const limit = Math.min(Math.max(query.limit ?? 1000, 1), 100_000);
      const selectedColumns = [...available].filter((column) => column !== "geometry" && column !== "properties" && !isInternalResponseColumn(column)).map(quoteIdentifier);
      const selected = selectedColumns.length ? `${selectedColumns.join(", ")}, ` : "";
      const properties = available.has("properties") ? "properties::JSON" : "NULL::JSON";
      const geometry = available.has("geometry") ? "ST_AsGeoJSON(geometry)::JSON" : "NULL::JSON";
      const h3Cells = [...new Set(query.h3Cells ?? [])].filter((cell) => /^[0-9a-f]+$/iu.test(cell));
      const filters: string[] = [];
      if (h3Cells.length && available.has("h3_r7")) {
        filters.push(`"h3_r7" IN (${h3Cells.map((_, index) => `$${parameters.length + 1 + index}`).join(", ")})`);
        parameters.push(...h3Cells);
      }
      // Some snapshots carry a `year` column (notably the combined year=0000
      // snapshots). Narrow it when the caller asked for a year or when the
      // resolved snapshot is itself a single year.
      if (requestedYear && requestedYear !== "0000" && available.has("year")) {
        filters.push(`CAST("year" AS VARCHAR) = $${parameters.length + 1}`);
        parameters.push(requestedYear);
      }
      const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
      const sql = `SELECT ${selected}${properties} AS properties, ${geometry} AS geometry FROM read_parquet($1)${where} LIMIT ${limit}`;
      const reader = await connection.runAndReadAll(sql, parameters);
      const rows = (reader.getRowObjectsJson() as Record<string, unknown>[]).map((row) => stripInternalColumns({
        ...row, properties: parseJsonValue(row.properties), geometry: parseJsonValue(row.geometry),
      }));
      return { mode: resolvedMode, snapshot, rows };
    } finally {
      connection.closeSync();
    }
  }
}

export function snapshotGeoJSON(result: SnapshotResult): { type: "FeatureCollection"; features: unknown[] } {
  return {
    type: "FeatureCollection",
    features: result.rows.map((row) => {
      const cleaned = stripInternalColumns(row);
      const { geometry, properties, ...fields } = cleaned;
      const sourceId = fields.source_id ?? (properties && typeof properties === "object" ? (properties as Record<string, unknown>).source_id : undefined);
      return { type: "Feature", ...(fields.id !== undefined || sourceId !== undefined ? { id: fields.id ?? sourceId } : {}), geometry, properties: { ...fields, ...((properties as Record<string, unknown> ?? {})) } };
    }),
  };
}
