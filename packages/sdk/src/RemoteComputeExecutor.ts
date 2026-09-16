import type { SearchExecutor, SearchFeature, SearchRow } from "./SearchClient.js";
import type { ComputeExecutor, ComputeRequest, ComputeRelation } from "./ComputeClient.js";

interface ComputeRow extends SearchRow {
  lat: number;
  lng: number;
}

function pointFrom(row: SearchRow): { lat: number; lng: number } | undefined {
  if (typeof row.lat === "number" && typeof row.lng === "number") return { lat: row.lat, lng: row.lng };
  const geometry = row.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return undefined;
}

function rowsFrom(result: { rows: SearchRow[] }): ComputeRow[] {
  return result.rows.flatMap((row) => {
    const point = pointFrom(row);
    return point ? [{ ...row, ...point }] : [];
  });
}

function distanceMeters(a: ComputeRow, b: ComputeRow): number {
  const radians = Math.PI / 180;
  const latDelta = (b.lat - a.lat) * radians;
  const lngDelta = (b.lng - a.lng) * radians;
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lngDelta / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function nearestRows(source: ComputeRow[], targets: ComputeRow[]): Array<ComputeRow & { distanceMeters: number | null; nearest?: ComputeRow }> {
  return source.map((row) => {
    let nearest: ComputeRow | undefined;
    let closest = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      const distance = distanceMeters(row, target);
      if (distance < closest) { closest = distance; nearest = target; }
    }
    return { ...row, distanceMeters: Number.isFinite(closest) ? closest : null, nearest };
  });
}

function relatedRows(source: ComputeRow[], targets: ComputeRow[], relation: ComputeRelation | undefined) {
  const distances = nearestRows(source, targets);
  return relation ? distances.filter((row) => row.distanceMeters !== null && row.distanceMeters <= relation.distanceMeters) : distances;
}

function compute(request: ComputeRequest, source: ComputeRow[], targets: ComputeRow[]): unknown {
  const relation = request.within ?? request.near;
  const distances = nearestRows(source, targets);
  const within = relatedRows(source, targets, relation);
  const limit = Math.min(Math.max(request.limit ?? 1000, 1), 100_000);
  switch (request.primitive) {
    case "NEAREST": return distances.filter((row) => row.distanceMeters !== null).sort((a, b) => Number(a.distanceMeters) - Number(b.distanceMeters)).slice(0, limit);
    case "DISTANCE": return distances.filter((row) => row.distanceMeters !== null).sort((a, b) => Number(a.distanceMeters) - Number(b.distanceMeters)).slice(0, limit).map((row) => ({ id: row.id, feature: row.feature, nearest: row.nearest?.id, distanceMeters: row.distanceMeters }));
    case "WITHIN": return within.slice(0, limit);
    case "COUNT": return within.length;
    case "DENSITY": {
      const radius = request.radiusMeters ?? relation?.distanceMeters;
      return within.length / (radius ? Math.PI * (radius / 1000) ** 2 : 1);
    }
    case "COVERAGE": {
      if (!targets.length || !relation) return 0;
      const served = targets.filter((target) => source.some((row) => distanceMeters(row, target) <= relation.distanceMeters)).length;
      return served / targets.length;
    }
    case "GAPS": {
      if (!targets.length || !relation) return [];
      return targets.filter((target) => !source.some((row) => distanceMeters(row, target) <= relation.distanceMeters)).slice(0, limit);
    }
    case "CLUSTER": {
      const radius = request.radiusMeters ?? relation?.distanceMeters ?? 1000;
      const cellSize = Math.max(radius / 111_000, 0.00001);
      const clusters = new Map<string, { lat: number; lng: number; count: number; ids: unknown[] }>();
      for (const row of within) {
        const lat = Math.floor(row.lat / cellSize) * cellSize;
        const lng = Math.floor(row.lng / cellSize) * cellSize;
        const key = `${lat}:${lng}`;
        const cluster = clusters.get(key) ?? { lat, lng, count: 0, ids: [] };
        cluster.count++;
        if (cluster.ids.length < limit) cluster.ids.push(row.id);
        clusters.set(key, cluster);
      }
      return [...clusters.values()].sort((a, b) => b.count - a.count).slice(0, limit);
    }
  }
}

/** Fetches feature rows through the configured search backend and computes in memory. */
export class RemoteComputeExecutor implements ComputeExecutor {
  constructor(private readonly search: SearchExecutor) {}

  private async load(feature: SearchFeature | SearchFeature[], areaId: string | undefined, mode: ComputeRequest["mode"]): Promise<ComputeRow[]> {
    const features = Array.isArray(feature) ? feature : [feature];
    const results = await Promise.all(features.map((value) => this.search.query({ feature: value, regionId: areaId, mode, limit: 100_000 })));
    return results.flatMap(rowsFrom);
  }

  async compute(request: Omit<ComputeRequest, "area" | "area_id"> & { area_id?: string }): Promise<unknown> {
    const source = await this.load(request.feature, request.area_id, request.mode);
    const relation = request.within ?? request.near;
    const targets = relation ? await this.load(relation.feature, request.area_id, request.mode) : [];
    return compute(request, source, targets);
  }
}
