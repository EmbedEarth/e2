import Database from "better-sqlite3";
import { baseCell, isValid, parse, resolveWindow } from "@embedearth/core";
import { schema } from "./schema.js";
import type { ComputeRequest, E2DatasetRow, E2Query } from "./query.js";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

export class SQLiteStore {
  private constructor(private readonly db: Database.Database) {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(schema);
    try { this.db.exec("ALTER TABLE observations ADD COLUMN name TEXT"); } catch { /* Existing databases already have the column. */ }
  }
  static open(path: string): SQLiteStore { return new SQLiteStore(new Database(path)); }
  close(): void { this.db.close(); }
  importRows(rows: Iterable<E2DatasetRow>): number {
    const statement = this.db.prepare(`INSERT OR REPLACE INTO observations (id,feature_id,feature,e2_id,base_e2_id,h3,temporal_resolution,temporal_bucket,observed_at,lat,lng,geometry_json,source,source_id,country_region_id,state_region_id,city_region_id,region_type,properties_json) VALUES (@id,@feature_id,@feature,@e2_id,@base_e2_id,@h3,@temporal_resolution,@temporal_bucket,@observed_at,@lat,@lng,@geometry_json,@source,@source_id,@country_region_id,@state_region_id,@city_region_id,@region_type,@properties_json)`);
    let count = 0; this.db.transaction((values: Iterable<E2DatasetRow>) => { for (const row of values) { if (!isValid(row.e2_id) || parse(row.e2_id).featureId !== row.feature_id) throw new Error(`Invalid E2 feature cell for row ${row.id}`); const cell = parse(row.e2_id); statement.run({ ...row, base_e2_id: baseCell(row.e2_id), temporal_resolution: cell.temporal.resolution, temporal_bucket: String(cell.temporal.bucket), observed_at: row.observed_at ?? null, geometry_json: row.geometry ? JSON.stringify(row.geometry) : null, country_region_id: row.country_region_id ?? null, state_region_id: row.state_region_id ?? null, city_region_id: row.city_region_id ?? null, region_type: row.region_type ?? null, properties_json: JSON.stringify(row.properties ?? {}) }); count++; } })(rows); return count;
  }
  async importParquet(path: string, region?: string): Promise<number> {
    const file = await asyncBufferFromFile(path); const records = await parquetReadObjects({ file, compressors });
    const rows = records.filter((row) => !region || row.city_region_id === region || row.state_region_id === region || row.country_region_id === region).map((row) => {
      const lat = Number(row.lat); const lng = Number(row.lng);
      return { ...row, feature_id: Number(row.feature_id), lat, lng, geometry: { type: "Point", coordinates: [lng, lat] }, properties: typeof row.properties === "string" ? JSON.parse(row.properties) : row.properties } as E2DatasetRow;
    });
    return this.importRows(rows);
  }

  private computeRows(feature: string | number | Array<string | number>, region?: string): Array<Record<string, unknown> & { lat: number; lng: number }> {
    const features = Array.isArray(feature) ? feature : [feature];
    const where: string[] = [];
    const parameters: unknown[] = [];
    const strings = features.filter((value): value is string => typeof value === "string");
    const numbers = features.filter((value): value is number => typeof value === "number");
    if (strings.length) { where.push(`feature IN (${strings.map(() => "?").join(",")})`); parameters.push(...strings); }
    if (numbers.length) { where.push(`feature_id IN (${numbers.map(() => "?").join(",")})`); parameters.push(...numbers); }
    if (!where.length) throw new TypeError("Compute requires at least one feature");
    if (region) { where.push("(city_region_id = ? OR state_region_id = ? OR country_region_id = ?)"); parameters.push(region, region, region); }
    const rows = this.db.prepare(`SELECT id, feature_id, feature, name, lat, lng, geometry_json, properties_json FROM observations WHERE (${where.join(" OR ")})`).all(...parameters) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ ...row, geometry: row.geometry_json ? JSON.parse(String(row.geometry_json)) : null, properties: row.properties_json ? JSON.parse(String(row.properties_json)) : {}, lat: Number(row.lat), lng: Number(row.lng) }));
  }

  compute(request: ComputeRequest): unknown {
    const source = this.computeRows(request.feature, request.region);
    const relation = request.within ?? request.near;
    const targets = relation ? this.computeRows(relation.feature, request.region) : [];
    const limit = Math.min(Math.max(request.limit ?? 1000, 1), 100_000);
    const distances: Array<Record<string, unknown> & { lat: number; lng: number; distanceMeters: number | null; nearest?: Record<string, unknown> }> = source.map((row) => {
      let nearest: Record<string, unknown> | undefined;
      let distanceMeters = Number.POSITIVE_INFINITY;
      for (const target of targets) {
        const distance = haversineMeters(row.lat, row.lng, target.lat, target.lng);
        if (distance < distanceMeters) { distanceMeters = distance; nearest = target; }
      }
      return { ...row, distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null, nearest };
    });
    const within = relation ? distances.filter((row) => row.distanceMeters !== null && Number(row.distanceMeters) <= relation.distanceMeters) : distances;
    switch (request.primitive) {
      case "NEAREST": return distances.filter((row) => row.distanceMeters !== null).sort((a, b) => Number(a.distanceMeters) - Number(b.distanceMeters)).slice(0, limit);
      case "DISTANCE": return distances.filter((row) => row.distanceMeters !== null).sort((a, b) => Number(a.distanceMeters) - Number(b.distanceMeters)).slice(0, limit).map((row) => ({ id: row["id"], feature: row["feature"], nearest: row.nearest?.["id"], distanceMeters: row.distanceMeters }));
      case "WITHIN": return within.slice(0, limit);
      case "COUNT": return within.length;
      case "DENSITY": {
        const radius = request.radiusMeters ?? relation?.distanceMeters;
        const areaSquareKilometers = radius ? Math.PI * (radius / 1000) ** 2 : 1;
        return within.length / areaSquareKilometers;
      }
      case "COVERAGE": {
        if (!targets.length || !relation) return 0;
        const served = targets.filter((target) => source.some((row) => haversineMeters(row.lat, row.lng, target.lat, target.lng) <= relation.distanceMeters)).length;
        return served / targets.length;
      }
      case "GAPS": {
        if (!targets.length || !relation) return [];
        return targets.filter((target) => !source.some((row) => haversineMeters(row.lat, row.lng, target.lat, target.lng) <= relation.distanceMeters)).slice(0, limit);
      }
      case "CLUSTER": {
        const radius = request.radiusMeters ?? relation?.distanceMeters ?? 1000;
        const latitudeSize = Math.max(radius / 111_000, 0.00001);
        const longitudeSize = Math.max(radius / 111_000, 0.00001);
        const clusters = new Map<string, { lat: number; lng: number; count: number; ids: unknown[] }>();
        for (const row of within) {
          const lat = Math.floor(row.lat / latitudeSize) * latitudeSize;
          const lng = Math.floor(row.lng / longitudeSize) * longitudeSize;
          const key = `${lat}:${lng}`;
          const cluster = clusters.get(key) ?? { lat, lng, count: 0, ids: [] };
          cluster.count++;
          if (cluster.ids.length < limit) cluster.ids.push(row["id"]);
          clusters.set(key, cluster);
        }
        return [...clusters.values()].sort((a, b) => b.count - a.count).slice(0, limit);
      }
    }
  }
  query(query: E2Query = {}): Record<string, unknown>[] {
    const where: string[] = []; const parameters: unknown[] = [];
    const addIn = (column: string, values: unknown[]) => { where.push(`${column} IN (${values.map(() => "?").join(",")})`); parameters.push(...values); };
    if (query.feature) addIn("feature", Array.isArray(query.feature) ? query.feature : [query.feature]);
    if (query.featureId) addIn("feature_id", Array.isArray(query.featureId) ? query.featureId : [query.featureId]);
    if (query.e2) addIn("e2_id", Array.isArray(query.e2) ? query.e2 : [query.e2]);
    if (query.region) { where.push("(city_region_id = ? OR state_region_id = ? OR country_region_id = ?)"); parameters.push(query.region, query.region, query.region); }
    let start = query.start ? new Date(query.start) : null; const end = query.end ? new Date(query.end) : null;
    if (query.window) start = resolveWindow(query.window).start;
    if (start) { where.push("observed_at >= ?"); parameters.push(start.toISOString()); } if (end) { where.push("observed_at < ?"); parameters.push(end.toISOString()); }
    const limit = Math.min(Math.max(query.limit ?? 1000, 1), 100_000); const sql = `SELECT * FROM observations${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY COALESCE(observed_at,'') ${query.order === "asc" ? "ASC" : "DESC"} LIMIT ?`; return this.db.prepare(sql).all(...parameters, limit) as Record<string, unknown>[];
  }
  stats(): Array<{ feature: string; rows: number }> { return this.db.prepare("SELECT feature, COUNT(*) AS rows FROM observations GROUP BY feature ORDER BY feature").all() as Array<{ feature: string; rows: number }>; }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = Math.PI / 180;
  const latDelta = (lat2 - lat1) * radians;
  const lngDelta = (lng2 - lng1) * radians;
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(lngDelta / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
