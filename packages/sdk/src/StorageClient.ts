import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, basename, dirname } from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { encode, isValid, parse } from "@embedearth/core";
import { FeatureClient } from "./FeatureClient.js";
import { LocalDatabase } from "./LocalDatabase.js";
import { getSpatialDuckDBInstance } from "./DuckDB.js";
import type { E2DatasetRow } from "@embedearth/storage-sqlite";

export interface StorageUploadOptions {
  path: string;
  database: string | LocalDatabase;
  feature?: string | number;
  connectTo?: string | number;
  featureId?: number;
  /** Required with a custom feature name; creates a local-only feature key. */
  namespace?: string;
  source?: string;
  region?: string;
  output?: string;
  observedAt?: string;
}

function localFeatureKey(namespace: string, feature: string): string {
  const normalize = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  const scope = normalize(namespace); const name = normalize(feature);
  if (!scope || !name) throw new TypeError("Local feature namespace and feature must contain letters or numbers");
  return `local:${scope}:${name}`;
}

function localFeatureId(key: string): number {
  let hash = 2166136261;
  for (const character of key) { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619); }
  return 1_500_000_000 + ((hash >>> 0) % 500_000_000);
}

export interface StorageUploadResult {
  rows: number;
  feature: string;
  featureId: number;
  database: string;
  geoparquetPath: string;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(value); value = "";
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ""])));
}

function pointFrom(value: unknown): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const geometry = value as { type?: string; coordinates?: unknown };
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return undefined;
}

function firstCoordinate(value: unknown): { lat: number; lng: number } | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") return { lng: value[0], lat: value[1] };
  for (const item of value) { const point = firstCoordinate(item); if (point) return point; }
  return undefined;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
  return typeof value === "object" ? value as Record<string, unknown> : {};
}

async function sourceRows(path: string): Promise<Array<Record<string, unknown>>> {
  const extension = extname(path).toLowerCase();
  if (extension === ".parquet" || extension === ".geoparquet") {
    const file = await asyncBufferFromFile(path);
    return await parquetReadObjects({ file, compressors }) as Array<Record<string, unknown>>;
  }
  const text = await readFile(path, "utf8");
  if (extension === ".csv") return parseCsv(text);
  const document = JSON.parse(text) as { type?: string; features?: unknown[] } | Record<string, unknown>;
  if ((document as { type?: string }).type === "FeatureCollection") return ((document as { features: unknown[] }).features ?? []).map((item) => item as Record<string, unknown>);
  if ((document as { type?: string }).type === "Feature") return [document as Record<string, unknown>];
  if (Array.isArray(document)) return document as Array<Record<string, unknown>>;
  return [document];
}

function normaliseRows(items: Array<Record<string, unknown>>, options: StorageUploadOptions, featureClient: FeatureClient): { rows: E2DatasetRow[]; feature: string; featureId: number } {
  const linked = options.feature ?? options.connectTo;
  let featureId = options.featureId;
  let feature = typeof linked === "string" ? linked : undefined;
  if (options.namespace !== undefined) {
    if (typeof linked !== "string") throw new TypeError("A local feature namespace requires a string feature name");
    feature = localFeatureKey(options.namespace, linked);
    featureId = localFeatureId(feature);
  } else if (linked !== undefined) {
    const resolved = featureClient.resolve(linked);
    featureId = resolved.id;
    feature = resolved.key;
  }
  if (featureId === undefined && feature) featureId = featureClient.resolve(feature).id;
  if (featureId === undefined) {
    const candidate = items.find((item) => item.feature_id !== undefined || item.feature !== undefined);
    if (candidate?.feature_id !== undefined) featureId = Number(candidate.feature_id);
    if (!feature && typeof candidate?.feature === "string") feature = candidate.feature;
  }
  if (feature && options.namespace === undefined) {
    const resolved = featureClient.resolve(feature);
    featureId = resolved.id;
    feature = resolved.key;
  } else if (featureId !== undefined && options.namespace === undefined) {
    feature = featureClient.resolve(featureId).key;
  }
  if (featureId === undefined || !Number.isInteger(featureId) || featureId < 1 || !feature) throw new TypeError("Storage upload requires feature_id or an existing feature connection");
  const rows = items.map((item, index) => {
    const properties = jsonObject(item.properties ?? (item.type === "Feature" ? item.properties : undefined));
    const geometry = item.geometry ?? (item.type === "Feature" ? item.geometry : undefined);
    const point = pointFrom(geometry) ?? firstCoordinate((geometry as { coordinates?: unknown } | undefined)?.coordinates) ?? {
      lat: Number(item.lat ?? item.latitude), lng: Number(item.lng ?? item.lon ?? item.longitude),
    };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) throw new TypeError(`Storage row ${index + 1} has no valid latitude/longitude`);
    const observedAt = String(item.observed_at ?? options.observedAt ?? new Date().toISOString());
    const existingId = typeof item.e2_id === "string" && isValid(item.e2_id) && parse(item.e2_id).featureId === featureId ? item.e2_id : undefined;
    const e2Id = existingId ?? encode({ lat: point.lat, lng: point.lng, time: observedAt, spatialResolution: 10, temporalResolution: "1d", featureId });
    const known = new Set(["id", "feature_id", "feature", "name", "lat", "lng", "lon", "latitude", "longitude", "geometry", "h3", "e2_id", "observed_at", "source", "source_id", "country_region_id", "state_region_id", "city_region_id", "region_type", "properties", "type"]);
    const inline = Object.fromEntries(Object.entries(item).filter(([key]) => !known.has(key)));
    return {
      id: String(item.id ?? item.source_id ?? randomUUID()), feature_id: featureId!, feature: feature!, name: item.name == null ? (typeof properties.name === "string" ? properties.name : null) : String(item.name),
      lat: point.lat, lng: point.lng, geometry: geometry ?? { type: "Point", coordinates: [point.lng, point.lat] }, h3: String(item.h3 ?? parse(e2Id).spatial), e2_id: e2Id,
      observed_at: observedAt, source: options.source ?? String(item.source ?? "user"), source_id: String(item.source_id ?? item.id ?? index),
      country_region_id: item.country_region_id == null ? null : String(item.country_region_id), state_region_id: item.state_region_id == null ? null : String(item.state_region_id), city_region_id: options.region ?? (item.city_region_id == null ? null : String(item.city_region_id)), region_type: item.region_type == null ? null : String(item.region_type), properties: { ...inline, ...properties },
    };
  });
  return { rows, feature, featureId };
}

function sqlPath(path: string): string { return path.replace(/'/gu, "''"); }

/** Convert GeoJSON, CSV, or Parquet into a WKB GeoParquet file using DuckDB. */
export async function convertToGeoParquet(input: string, output = `${input.replace(/\.[^.]+$/u, "")}.geoparquet`): Promise<string> {
  const extension = extname(input).toLowerCase();
  let source = input;
  let temporary: string | undefined;
  try {
    if (extension === ".geojson" || extension === ".json") {
      const items = await sourceRows(input);
      temporary = join(dirname(output), `.${basename(output)}.jsonl`);
      await writeFile(temporary, `${items.map((item) => JSON.stringify({ ...item, geometry: typeof item.geometry === "string" ? item.geometry : JSON.stringify(item.geometry ?? null) })).join("\n")}\n`);
      source = temporary;
    }
    await mkdir(dirname(output), { recursive: true });
    const instance = await getSpatialDuckDBInstance();
    const connection = await instance.connect();
    try {
      const sourceSql = extension === ".csv" ? `read_csv_auto('${sqlPath(source)}')` : extension === ".parquet" || extension === ".geoparquet" ? `read_parquet('${sqlPath(source)}')` : `read_json_auto('${sqlPath(source)}', format='newline_delimited')`;
      const select = extension === ".csv"
        ? `SELECT * EXCLUDE (lat, lng), ST_AsWKB(ST_Point(CAST(lng AS DOUBLE), CAST(lat AS DOUBLE))) AS geometry FROM ${sourceSql}`
        : extension === ".parquet" || extension === ".geoparquet"
          ? `SELECT * FROM ${sourceSql}`
          : `SELECT * EXCLUDE (geometry), ST_AsWKB(ST_GeomFromGeoJSON(geometry)) AS geometry FROM ${sourceSql}`;
      await connection.run(`COPY (${select}) TO '${sqlPath(output)}' (FORMAT PARQUET)`);
    } finally { connection.closeSync(); }
    return output;
  } finally {
    if (temporary) await rm(temporary, { force: true });
  }
}

export class StorageClient {
  constructor(private readonly features = new FeatureClient()) {}

  async upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const { rows, feature, featureId } = normaliseRows(await sourceRows(options.path), options, this.features);
    const databasePath = typeof options.database === "string" ? options.database : "memory";
    const database = typeof options.database === "string" ? await LocalDatabase.open(options.database) : options.database;
    const output = options.output ?? `${options.path.replace(/\.[^.]+$/u, "")}.geoparquet`;
    const temporary = join(dirname(output), `.${randomUUID()}.json`);
    try {
      const imported = database.importRows(rows);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(temporary, JSON.stringify(rows.map((row) => ({ ...row, geometry: JSON.stringify(row.geometry ?? null) }))));
      const geoparquetPath = await convertToGeoParquet(temporary, output);
      return { rows: imported, feature, featureId, database: databasePath, geoparquetPath };
    } finally {
      await rm(temporary, { force: true });
      if (typeof options.database === "string") database.close();
    }
  }
}
