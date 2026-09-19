import { stripInternalColumns } from "./internalColumns.js";

export type SearchFeature = string | number;

export interface SearchQuery {
  feature: SearchFeature;
  regionId?: string | null;
  /** Internal route candidate narrowing; not a general search filter. */
  h3Cells?: readonly string[];
  /**
   * Optional snapshot year (for example `"2026"`). Year-split features
   * (anything that is not `osm` or `visual`) default to the newest available
   * year, cascading down from the current year.
   */
  year?: string | number | null;
  country_code?: string;
  state_code?: string;
  mode?: "cloud" | "offline" | "auto";
  limit?: number;
  cacheDirectory?: string;
  signal?: AbortSignal;
}

export interface SearchRow {
  id?: string | number;
  geometry?: unknown;
  properties?: unknown;
  [key: string]: unknown;
}

export interface SearchQueryResult {
  rows: SearchRow[];
}

export interface SearchExecutor {
  query(query: SearchQuery): Promise<SearchQueryResult>;
}

export interface SearchOptions extends Omit<SearchQuery, "feature" | "regionId" | "h3Cells"> {
  feature: SearchFeature | SearchFeature[];
  area?: string | string[];
  area_id?: string | string[];
  country_code?: string;
  state_code?: string;
  year?: string | number | null;
  latitude?: number;
  longitude?: number;
}

export interface SearchFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string | number;
    geometry: unknown;
    properties: Record<string, unknown>;
  }>;
}

function values<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function asFeature(row: SearchRow, imageUrlMessage?: string): SearchFeatureCollection["features"][number] {
  const { geometry = null, properties, id, ...fields } = row;
  const merged = stripInternalColumns({
    ...fields,
    ...(properties && typeof properties === "object" ? properties : {}),
  } as Record<string, unknown>);
  if (imageUrlMessage) merged.image_url = imageUrlMessage;
  const feature = { type: "Feature" as const, geometry, properties: merged };
  const sourceId = fields.source_id ?? (properties && typeof properties === "object" ? (properties as Record<string, unknown>).source_id : undefined);
  if (id !== undefined || sourceId !== undefined) return { ...feature, id: id ?? sourceId as string | number };
  return feature;
}

/** Query one or more published features and areas as one GeoJSON collection. */
export class SearchClient {
  constructor(
    private readonly executor?: SearchExecutor,
    private readonly resolveArea: (area: string) => string = (area) => area,
    private readonly imageUrlMessage: (feature: SearchFeature) => string | undefined = () => undefined,
  ) {}

  async search(options: SearchOptions): Promise<SearchFeatureCollection> {
    return this.searchInternal(options);
  }

  /** @internal Search entry point used when a coordinate has already been narrowed through H3. */
  async searchWithH3(options: SearchOptions, h3Cells: readonly string[]): Promise<SearchFeatureCollection> {
    return this.searchInternal(options, h3Cells);
  }

  private async searchInternal(options: SearchOptions, h3Cells?: readonly string[]): Promise<SearchFeatureCollection> {
    if (!this.executor) throw new Error("Search is not configured. Use the Node SDK or provide a SearchExecutor to E2.");
    const features = values(options.feature);
    if (!features.length) throw new TypeError("Search requires at least one feature");
    const rawAreas = values(options.area);
    const rawAreaIds = values(options.area_id);
    if (rawAreas.length && rawAreaIds.length) throw new TypeError("Use area or area_id, not both");
    const regions: Array<string | null> = rawAreas.length
      ? rawAreas.map(this.resolveArea)
      : rawAreaIds.length ? rawAreaIds : [null];
    const limit = Math.min(Math.max(options.limit ?? 1000, 1), 100_000);
    const batches: SearchFeatureCollection["features"][] = [];
    const combinations = features.length * regions.length;
    const perQueryLimit = Math.max(1, Math.ceil(limit / combinations));
    for (const feature of features) {
      for (const regionId of regions) {
        const result = await this.executor.query({
          feature,
          regionId,
          ...(h3Cells?.length ? { h3Cells } : {}),
          ...(options.country_code ? { country_code: options.country_code } : {}),
          ...(options.state_code ? { state_code: options.state_code } : {}),
          ...(options.year !== undefined && options.year !== null ? { year: options.year } : {}),
          mode: options.mode,
          cacheDirectory: options.cacheDirectory,
          limit: perQueryLimit,
          signal: options.signal,
        });
        batches.push(result.rows.slice(0, perQueryLimit).map((row) => asFeature(row, this.imageUrlMessage(feature))));
      }
    }

    const featuresOut: SearchFeatureCollection["features"] = [];
    for (let index = 0; featuresOut.length < limit; index++) {
      let added = false;
      for (const batch of batches) {
        const item = batch[index];
        if (item) { featuresOut.push(item); added = true; if (featuresOut.length >= limit) break; }
      }
      if (!added) break;
    }
    return { type: "FeatureCollection", features: featuresOut };
  }
}
