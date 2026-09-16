import { latLngToCell } from "h3-js";
import { E2_VERSION, type TemporalResolution } from "./constants.js";
import { InvalidCellError } from "./errors.js";
import { timeToCell } from "./temporal.js";
import { assertFeatureId, assertH3, isTemporalResolution } from "./validation.js";

export interface ParsedE2Cell {
  version: 1;
  spatial: string;
  temporal: { resolution: TemporalResolution; bucket: bigint };
  featureId: number | null;
}

export interface EncodeOptions {
  lat: number;
  lng: number;
  time: Date | string | number;
  spatialResolution: number;
  temporalResolution: TemporalResolution;
  featureId?: number;
}

export function parse(id: string): ParsedE2Cell {
  if (typeof id !== "string") throw new InvalidCellError("E2 cell must be a string");
  const parts = id.split(":");
  if (parts.length !== 5 && parts.length !== 6) throw new InvalidCellError("Invalid E2 cell segment count");
  if (parts[0] !== "e2" || parts[1] !== String(E2_VERSION)) throw new InvalidCellError("Unsupported E2 cell version");
  const spatial = parts[2]!;
  assertH3(spatial);
  const resolution = parts[3]!;
  if (!isTemporalResolution(resolution)) throw new InvalidCellError(`Invalid temporal resolution: ${resolution}`);
  if (!/^-?\d+$/.test(parts[4]!)) throw new InvalidCellError("Temporal bucket must be an integer");
  const bucket = BigInt(parts[4]!);
  let featureId: number | null = null;
  if (parts.length === 6) {
    if (!/^\d+$/.test(parts[5]!)) throw new InvalidCellError("Feature ID must be a positive integer");
    featureId = Number(parts[5]);
    assertFeatureId(featureId);
  }
  return { version: E2_VERSION, spatial, temporal: { resolution, bucket }, featureId };
}

export function stringify(cell: ParsedE2Cell): string {
  assertH3(cell.spatial);
  const base = `e2:${cell.version}:${cell.spatial}:${cell.temporal.resolution}:${cell.temporal.bucket}`;
  if (cell.featureId === null) return base;
  assertFeatureId(cell.featureId);
  return `${base}:${cell.featureId}`;
}

export function encode(options: EncodeOptions): string {
  if (!Number.isFinite(options.lat) || options.lat < -90 || options.lat > 90) throw new RangeError("Latitude must be between -90 and 90");
  if (!Number.isFinite(options.lng) || options.lng < -180 || options.lng > 180) throw new RangeError("Longitude must be between -180 and 180");
  if (!Number.isInteger(options.spatialResolution) || options.spatialResolution < 0 || options.spatialResolution > 15) throw new RangeError("H3 resolution must be between 0 and 15");
  const spatial = latLngToCell(options.lat, options.lng, options.spatialResolution);
  const temporal = timeToCell(options.time, options.temporalResolution);
  return stringify({ version: 1, spatial, temporal, featureId: options.featureId ?? null });
}

export const decode = parse;
export function isValid(id: string): boolean { try { parse(id); return true; } catch { return false; } }
export function baseCell(id: string): string { const value = parse(id); return stringify({ ...value, featureId: null }); }
export const withoutFeature = baseCell;
export function withFeature(id: string, featureId: number): string { const value = parse(id); return stringify({ ...value, featureId }); }
export function hasFeature(id: string): boolean { return parse(id).featureId !== null; }
export function getFeatureId(id: string): number | null { return parse(id).featureId; }
