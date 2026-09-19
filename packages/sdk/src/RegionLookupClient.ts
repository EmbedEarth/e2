export const DEFAULT_REGION_LOOKUP_URL = "https://e2-snapshots-sqlite.fly.dev/regions/resolve";

export interface RegionLookupResult {
  lat: number;
  lng: number;
  found: boolean;
  c_id: string | null;
  c_name: string | null;
  country_code: string | null;
  s_id: string | null;
  s_name: string | null;
  state_code: string | null;
  r_id: string | null;
  r_name: string | null;
  p_id: string | null;
  p_name: string | null;
}

export interface RegionLookupOptions {
  url?: string;
  headers?: Record<string, string>;
}

export interface RegionPoint {
  lat: number;
  lng: number;
}

/** Select the most specific supported region for snapshot-backed queries. */
export function preferredRegionId(result: RegionLookupResult): string | null {
  return result.r_id ?? result.s_id ?? result.c_id ?? null;
}

function validatePoint(point: RegionPoint): void {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) throw new RangeError("Latitude must be between -90 and 90");
  if (!Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) throw new RangeError("Longitude must be between -180 and 180");
}

function parseResult(value: unknown): RegionLookupResult {
  if (!value || typeof value !== "object") throw new TypeError("Invalid region lookup response");
  const result = value as Record<string, unknown>;
  if (typeof result.lat !== "number" || typeof result.lng !== "number" || typeof result.found !== "boolean") throw new TypeError("Invalid region lookup response");
  for (const key of ["c_id", "c_name", "country_code", "s_id", "s_name", "state_code", "r_id", "r_name", "p_id", "p_name"] as const) {
    if (result[key] !== null && typeof result[key] !== "string") throw new TypeError("Invalid region lookup response");
  }
  return {
    lat: result.lat,
    lng: result.lng,
    found: result.found,
    c_id: result.c_id as string | null,
    c_name: result.c_name as string | null,
    country_code: result.country_code as string | null,
    s_id: result.s_id as string | null,
    s_name: result.s_name as string | null,
    state_code: result.state_code as string | null,
    r_id: result.r_id as string | null,
    r_name: result.r_name as string | null,
    p_id: result.p_id as string | null,
    p_name: result.p_name as string | null,
  };
}

export class RegionLookupClient {
  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor(options: RegionLookupOptions = {}) {
    this.url = options.url ?? DEFAULT_REGION_LOOKUP_URL;
    this.headers = options.headers ?? {};
  }

  async resolve(point: RegionPoint, signal?: AbortSignal): Promise<RegionLookupResult> {
    validatePoint(point);
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body: JSON.stringify({ lat: point.lat, lng: point.lng }),
      signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
        ? String((body as Record<string, unknown>).error)
        : `HTTP ${response.status}`;
      throw new Error(`Region lookup failed: ${message}`);
    }
    return parseResult(body);
  }
}
