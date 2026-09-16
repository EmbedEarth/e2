import type { SearchExecutor, SearchRow } from "./SearchClient.js";
import { cellToParent, getResolution, gridDisk, latLngToCell } from "h3-js";

export type RouteMode =
  | "driving"
  | "walking"
  | "cycling"
  | "multimodal"
  | "truck"
  | "motorcycle"
  | "motor_scooter"
  | "bus"
  | "taxi"
  | "hov"
  | "transit";

export interface RouteLocation {
  lat: number;
  lon?: number;
  lng?: number;
  type?: string;
  heading?: number;
  date_time?: string;
}

export interface ValhallaRequest extends Record<string, unknown> {
  locations?: RouteLocation[];
  sources?: RouteLocation[];
  targets?: RouteLocation[];
  costing?: string;
  mode?: RouteMode;
  date_time?: Record<string, unknown>;
}

export interface RouteOptions extends ValhallaRequest {
  locations: RouteLocation[];
  mode?: RouteMode;
}

export interface MatrixOptions extends ValhallaRequest {
  sources: RouteLocation[];
  targets: RouteLocation[];
  mode?: RouteMode;
}

export interface IsochroneOptions extends ValhallaRequest {
  locations: RouteLocation[];
  mode?: RouteMode;
  contours?: Array<{ time?: number; distance?: number; color?: string }>;
}

export interface MapMatchOptions extends ValhallaRequest {
  shape: Array<RouteLocation & { time?: number; accuracy?: number; elevation?: number }>;
  mode?: RouteMode;
}

export type ValhallaResponse = Record<string, unknown>;
export type FeatureRouteOptions = Omit<ValhallaRequest, "locations"> & { mode?: RouteMode };

/** Default routing service used by the first-party Node tooling. */
export const DEFAULT_ROUTE_URL = "https://route.embed.earth";

export interface RouteClientOptions {
  headers?: Record<string, string>;
  hosted?: boolean;
}

function locationFrom(row: SearchRow): RouteLocation | undefined {
  if (typeof row.lat === "number" && typeof row.lng === "number") return { lat: row.lat, lon: row.lng };
  const geometry = row.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lon, lat] = geometry.coordinates;
    if (typeof lat === "number" && typeof lon === "number") return { lat, lon };
  }
  return undefined;
}

function cellAtResolution(row: SearchRow, resolution: number): string | undefined {
  const candidates = [row.h3, row[`h3_r${resolution}`], row.h3_r15];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const candidateResolution = getResolution(candidate);
      if (candidateResolution < resolution) continue;
      return candidateResolution === resolution ? candidate : cellToParent(candidate, resolution);
    } catch { /* Try the next published H3 representation. */ }
  }
  return undefined;
}

function distanceBetween(first: RouteLocation, second: RouteLocation): number {
  const radians = Math.PI / 180;
  const latDelta = (second.lat - first.lat) * radians;
  const firstLon = first.lon ?? first.lng!;
  const secondLon = second.lon ?? second.lng!;
  const lonDelta = (secondLon - firstLon) * radians;
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(first.lat * radians) * Math.cos(second.lat * radians) * Math.sin(lonDelta / 2) ** 2;
  return Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function normalizeLocation(location: RouteLocation): RouteLocation {
  if (location.lon === undefined && location.lng === undefined) throw new TypeError("Route locations require lon or lng");
  return location.lon === undefined ? { ...location, lon: location.lng } : location;
}

function withCosting(body: ValhallaRequest): ValhallaRequest {
  const { mode, ...rest } = body;
  const costing = mode === "driving" ? "auto" : mode === "walking" ? "pedestrian" : mode === "cycling" ? "bicycle" : mode;
  const shape = Array.isArray(body["shape"]) ? (body["shape"] as RouteLocation[]).map(normalizeLocation) : body["shape"];
  return {
    ...rest,
    locations: body.locations?.map(normalizeLocation),
    sources: body.sources?.map(normalizeLocation),
    targets: body.targets?.map(normalizeLocation),
    ...(shape ? { shape } : {}),
    costing: body.costing ?? costing ?? "auto",
  };
}

/** Thin HTTP wrapper around route, matrix, isochrone, and trace APIs. */
export class RouteClient {
  constructor(
    private readonly baseUrl = "http://localhost:8002",
    private readonly search?: SearchExecutor,
    private readonly resolveArea: (area: string) => string = (area) => area,
    private readonly options: RouteClientOptions = {},
    private readonly resolveCoordinates?: (latitude: number, longitude: number, signal?: AbortSignal) => Promise<string | null>,
  ) {}

  feature(feature: string | number): FeatureRouteQuery {
    if (!this.search) throw new Error("Feature routing requires a search backend");
    return new FeatureRouteQuery(this, this.search, this.resolveArea, this.resolveCoordinates, feature);
  }

  private async post(path: string, body: ValhallaRequest, signal?: AbortSignal): Promise<ValhallaResponse> {
    if (this.options.hosted && !Object.keys(this.options.headers ?? {}).some((name) =>
      ["authorization", "x-api-key"].includes(name.toLowerCase()) && Boolean(this.options.headers?.[name]?.trim()))) {
      throw new Error("Hosted routing requires an apiKey. Pass apiKey or configure routeUrl for a direct routing service.");
    }
    const hostedPath = this.options.hosted ? "" : path;
    const requestBody = this.options.hosted
      ? { operation: operationForPath(path), ...body }
      : body;
    const response = await fetch(`${this.baseUrl.replace(/\/$/u, "")}${hostedPath}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.options.headers },
      body: JSON.stringify(requestBody),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Route ${path} failed: HTTP ${response.status}${detail ? ` ${detail}` : ""}`);
    }
    return (await response.json()) as ValhallaResponse;
  }

  route(options: RouteOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.post("/route", withCosting(options), signal);
  }

  directions(options: RouteOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.route(options, signal);
  }

  matrix(options: MatrixOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.post("/sources_to_targets", withCosting(options), signal);
  }

  isochrone(options: IsochroneOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.post("/isochrone", withCosting(options), signal);
  }

  isochrones(options: IsochroneOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.isochrone(options, signal);
  }

  mapMatch(options: MapMatchOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.post("/trace_route", withCosting(options), signal);
  }

  mapMatching(options: MapMatchOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.mapMatch(options, signal);
  }

  traceRoute(options: MapMatchOptions, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.mapMatch(options, signal);
  }

  locate(options: ValhallaRequest, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.post("/locate", options, signal);
  }

  height(options: ValhallaRequest, signal?: AbortSignal): Promise<ValhallaResponse> {
    return this.post("/height", options, signal);
  }

  request(endpoint: string, body: ValhallaRequest, signal?: AbortSignal): Promise<ValhallaResponse> {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return this.post(path, body, signal);
  }
}

function operationForPath(path: string): string {
  switch (path) {
    case "/route": return "route";
    case "/sources_to_targets": return "matrix";
    case "/isochrone": return "isochrone";
    case "/trace_route": return "mapMatch";
    case "/locate": return "locate";
    case "/height": return "height";
    default: return path.replace(/^\//u, "");
  }
}

/** Resolves a feature to its nearest indexed point before routing. */
export class FeatureRouteQuery {
  private origin?: RouteLocation;
  private areaIdValue?: string;
  private resultLimit = 1;
  private routeMode?: RouteMode;

  constructor(
    private readonly client: RouteClient,
    private readonly search: SearchExecutor,
    private readonly resolveArea: (area: string) => string,
    private readonly resolveCoordinates: ((latitude: number, longitude: number, signal?: AbortSignal) => Promise<string | null>) | undefined,
    private readonly featureValue: string | number,
  ) {}

  from(location: RouteLocation): this { this.origin = location; return this; }
  area(area: string): this { this.areaIdValue = this.resolveArea(area); return this; }
  areaId(areaId: string): this { this.areaIdValue = areaId.trim() || undefined; return this; }
  limit(value: number): this { if (!Number.isInteger(value) || value < 1) throw new TypeError("feature route limit must be a positive integer"); this.resultLimit = value; return this; }
  mode(value: RouteMode): this { this.routeMode = value; return this; }

  async route(options: FeatureRouteOptions = {}, signal?: AbortSignal): Promise<ValhallaResponse> {
    if (!this.origin) throw new Error("Feature routing requires a starting location");
    const origin = normalizeLocation(this.origin);
    const originLon = origin.lon!;
    const regionId = this.areaIdValue ?? await this.resolveCoordinates?.(origin.lat, originLon, signal) ?? undefined;
    const originCell = latLngToCell(origin.lat, originLon, 7);
    const h3Cells = gridDisk(originCell, 1);
    let result = await this.search.query({ feature: this.featureValue, regionId, h3Cells, mode: "auto", limit: 100_000, signal });
    let matches = result.rows.map((row) => ({ row, location: locationFrom(row) })).filter((item): item is { row: SearchRow; location: RouteLocation } => item.location !== undefined);
    let h3Nearby = matches.filter(({ row }) => h3Cells.includes(cellAtResolution(row, 7) ?? ""));
    if (!h3Nearby.length) {
      result = await this.search.query({ feature: this.featureValue, regionId, mode: "auto", limit: 100_000, signal });
      matches = result.rows.map((row) => ({ row, location: locationFrom(row) })).filter((item): item is { row: SearchRow; location: RouteLocation } => item.location !== undefined);
      h3Nearby = matches.filter(({ row }) => cellAtResolution(row, 7) === originCell);
    }
    const destination = (h3Nearby.length ? h3Nearby : matches).map(({ location }) => location).sort((first, second) => distanceBetween(origin, first) - distanceBetween(origin, second))[0];
    if (!destination) throw new Error(`No routable locations found for feature ${this.featureValue}`);
    return this.client.route({ ...options, locations: [origin, destination], mode: options.mode ?? this.routeMode }, signal);
  }

  nearest(options?: FeatureRouteOptions, signal?: AbortSignal): Promise<ValhallaResponse> { return this.route(options, signal); }
}
