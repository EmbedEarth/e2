import type { SearchExecutor, SearchQuery, SearchQueryResult } from "./SearchClient.js";

export interface HttpSearchOptions {
  url?: string;
  headers?: Record<string, string>;
}

/** Browser-compatible search backend for an E2 HTTP `/search` endpoint. */
export class HttpSearchExecutor implements SearchExecutor {
  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor(options: HttpSearchOptions = {}) {
    this.url = options.url ?? "/search";
    this.headers = options.headers ?? {};
  }

  async query(query: SearchQuery): Promise<SearchQueryResult> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body: JSON.stringify({
        feature: query.feature,
        area: query.regionId,
        regionId: query.regionId,
        h3Cells: query.h3Cells,
        country_code: query.country_code,
        state_code: query.state_code,
        ...(query.year !== undefined && query.year !== null ? { year: query.year } : {}),
        mode: query.mode,
        limit: query.limit,
      }),
      signal: query.signal,
    });
    if (!response.ok) throw new Error(`E2 search failed: HTTP ${response.status}`);
    const result = await response.json() as {
      type?: string;
      features?: Array<{ id?: string | number; geometry?: unknown; properties?: Record<string, unknown> }>;
      results?: Array<Record<string, unknown>>;
    } | SearchQueryResult;
    if ("rows" in result && Array.isArray(result.rows)) return result;
    if ("results" in result && Array.isArray(result.results)) {
      return {
        rows: result.results.map((item) => ({
          id: typeof item.id === "string" || typeof item.id === "number" ? item.id : undefined,
          geometry: item.geometry ?? null,
          properties: item,
        })),
      };
    }
    const collection = result as { type?: string; features?: Array<{ id?: string | number; geometry?: unknown; properties?: Record<string, unknown> }> };
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new TypeError("Invalid E2 search response");
    return {
      rows: collection.features.map((item) => ({ id: item.id, geometry: item.geometry, properties: item.properties ?? {} })),
    };
  }
}
