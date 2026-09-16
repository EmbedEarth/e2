import { polygonToCells } from "h3-js";
import type { Polygon, MultiPolygon } from "geojson";
import { stringify } from "./cell.js";
import { timeToCell } from "./temporal.js";
import type { TemporalResolution } from "./constants.js";

export interface CoverOptions { geometry: Polygon | MultiPolygon; start: Date | string; end: Date | string; spatialResolution: number; temporalResolution: TemporalResolution; featureId?: number; }
function spatialCells(geometry: Polygon | MultiPolygon, resolution: number): string[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return [...new Set(polygons.flatMap((coordinates) => polygonToCells(coordinates as number[][][], resolution, true)))];
}
export function* coverIterator(options: CoverOptions): Generator<string> {
  const start = new Date(options.start); const end = new Date(options.end); if (!(start < end)) throw new RangeError("Cover start must precede end");
  const first = timeToCell(start, options.temporalResolution).bucket; const last = timeToCell(new Date(end.getTime() - 1), options.temporalResolution).bucket;
  const spatial = spatialCells(options.geometry, options.spatialResolution);
  for (let bucket = first; bucket <= last; bucket++) for (const cell of spatial) yield stringify({ version: 1, spatial: cell, temporal: { resolution: options.temporalResolution, bucket }, featureId: options.featureId ?? null });
}
export function cover(options: CoverOptions): string[] { return [...coverIterator(options)]; }
export function estimateCoverSize(options: CoverOptions): number { let count = 0; for (const cell of coverIterator(options)) { if (cell) count++; } return count; }
