import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapOptions as MapLibreOptions, StyleSpecification } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import { layersWithPartialCustomTheme } from "protomaps-themes-base";
import type { E2 } from "./E2.js";
import { PLANET_PMTILES_URL, selectMapSnapshot } from "./MapSources.js";
import type { PublishedSnapshot } from "@embedearth/datasets";

export type MapFeatureOptions = {
  color?: string; area_id?: string | null; area?: string; limit?: number;
  mode?: "cloud" | "offline" | "auto"; sourceLayer?: string; signal?: AbortSignal;
  /** Optional snapshot year (for example `"2026"`); year-split features default to the newest year. */
  year?: string | number | null;
};
export type MapOptions = Omit<MapLibreOptions, "container" | "style"> & { container: MapLibreOptions["container"]; e2?: E2; style?: string | StyleSpecification; planetSource?: string };
export type MapRouteOptions = Parameters<E2["route"]["route"]>[0];
export type MapComputeOptions = Parameters<E2["compute"]["run"]>[0];
export type MapFeatureCollection = { type: "FeatureCollection"; features: Array<{ type: "Feature"; geometry: unknown; properties?: Record<string, unknown> }> };

const FEATURE_SOURCE_PREFIX = "e2-feature-";
const ROUTE_SOURCE = "e2-route";
const ROUTE_LAYER = "e2-route-line";
const COMPUTE_SOURCE = "e2-compute";
const COMPUTE_LAYER = "e2-compute-points";
function key(value: string | number): string { return String(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function published(snapshot: PublishedSnapshot): boolean { return snapshot.schemaVersion === 2 && Boolean(snapshot.pmtilesDownloadUrl) && (!snapshot.pmtilesStatus || snapshot.pmtilesStatus === "published"); }
function isCollection(value: unknown): value is MapFeatureCollection { return Boolean(value && typeof value === "object" && (value as MapFeatureCollection).type === "FeatureCollection" && Array.isArray((value as MapFeatureCollection).features)); }

function decodePolyline(encoded: string, precision = 6): Array<[number, number]> {
  const points: Array<[number, number]> = []; let index = 0; let lat = 0; let lng = 0; const factor = 10 ** precision;
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    lat += result & 1 ? ~(result >> 1) : result >> 1; result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    lng += result & 1 ? ~(result >> 1) : result >> 1; points.push([lng / factor, lat / factor]);
  }
  return points;
}
function routeGeometry(response: Record<string, unknown>): unknown {
  if (response.geometry && typeof response.geometry === "object") return response.geometry;
  const trip = response.trip as { legs?: Array<{ shape?: string }> } | undefined;
  const coordinates = trip?.legs?.flatMap((leg) => leg.shape ? decodePolyline(leg.shape) : []) ?? [];
  return coordinates.length > 1 ? { type: "LineString", coordinates } : undefined;
}

/** MapLibre wrapper connected to E2 datasets, search, routing, and compute. */
export class Map {
  readonly map: MapLibreMap;
  readonly e2?: E2;
  private readonly protocol: Protocol;
  private readonly sources = new globalThis.Map<string, { source: string; layers: string[] }>();
  private readonly ready: Promise<void>;

  constructor(options: MapOptions) {
    this.e2 = options.e2; this.protocol = new Protocol();
    const planetSource = options.planetSource ?? PLANET_PMTILES_URL;
    this.protocol.add(new PMTiles(planetSource));
    try { maplibregl.removeProtocol("pmtiles"); } catch { /* first registration */ }
    maplibregl.addProtocol("pmtiles", this.protocol.tile);
    const { e2: _e2, planetSource: _source, ...mapOptions } = options;
    this.map = new maplibregl.Map({ ...mapOptions, style: options.style ?? this.defaultStyle(planetSource) });
    this.ready = new Promise((resolve) => this.map.once("load", () => { void this.addPlanetLayers(planetSource); resolve(); }));
  }

  private getE2(): E2 {
    if (!this.e2) throw new Error("An E2 client is required for feature, route, and compute map operations");
    return this.e2;
  }

  private defaultStyle(source: string): StyleSpecification {
    return {
      version: 8,
      glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
      sources: { planet: { type: "vector", url: `pmtiles://${source}` } },
      layers: layersWithPartialCustomTheme("planet", "dark", {
        background: "#101817",
        earth: "#17201d",
        water: "#17383d",
        buildings: "#26332f",
        city_label: "#f3f6f2",
        city_label_halo: "#101817",
        subplace_label: "#cbd5cf",
        subplace_label_halo: "#101817",
        roads_label_major: "#d9e2dc",
        roads_label_major_halo: "#101817",
        roads_label_minor: "#b7c4bc",
        roads_label_minor_halo: "#101817",
      }, "en") as StyleSpecification["layers"],
    };
  }

  private async addPlanetLayers(source: string): Promise<void> {
    if (!this.map.getSource("planet")) return;
    const metadata = await new PMTiles(source).getMetadata() as { vector_layers?: Array<{ id: string }> };
    for (const layer of metadata.vector_layers ?? []) {
      const name = layer.id.toLocaleLowerCase(); const id = `planet-${key(layer.id)}`;
      if (this.map.getLayer(id)) continue;
      if (name.includes("water")) this.map.addLayer({ id, type: "fill", source: "planet", "source-layer": layer.id, paint: { "fill-color": "#17383d", "fill-opacity": 0.9 } });
      else if (name.includes("road") || name.includes("transport")) this.map.addLayer({ id, type: "line", source: "planet", "source-layer": layer.id, paint: { "line-color": "#61706a", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.3, 14, 2] } });
      else if (name.includes("building")) this.map.addLayer({ id, type: "fill", source: "planet", "source-layer": layer.id, paint: { "fill-color": "#26332f", "fill-opacity": 0.75 } });
    }
  }

  async addFeature(feature: string | number, options: MapFeatureOptions = {}): Promise<PublishedSnapshot | undefined> {
    await this.ready;
    const e2 = this.getE2();
    const snapshots = await e2.datasets.listSnapshots(options.signal);
    const areaId = options.area_id ?? (options.area ? e2.regions.resolve(options.area).id : null);
    const snapshot = selectMapSnapshot(snapshots, feature, areaId);
    this.removeFeature(feature);
    const id = `${FEATURE_SOURCE_PREFIX}${key(feature)}`;
    if (snapshot?.pmtilesDownloadUrl && published(snapshot)) {
      const archive = new PMTiles(snapshot.pmtilesDownloadUrl); this.protocol.add(archive);
      const metadata = await archive.getMetadata() as { vector_layers?: Array<{ id: string }> };
      const sourceLayers = options.sourceLayer ? [options.sourceLayer] : metadata.vector_layers?.map((layer) => layer.id) ?? [];
      if (!sourceLayers.length) throw new Error(`PMTiles snapshot ${snapshot.id} has no vector layers`);
      this.map.addSource(id, { type: "vector", url: `pmtiles://${snapshot.pmtilesDownloadUrl}` });
      const layerIds = sourceLayers.map((sourceLayer, index) => { const layerId = `${id}-${index}`; this.map.addLayer({ id: layerId, type: "circle", source: id, "source-layer": sourceLayer, paint: { "circle-radius": 4, "circle-color": options.color ?? "#3ecf8e", "circle-stroke-color": "#101817", "circle-stroke-width": 1 } }); return layerId; });
      this.sources.set(String(feature), { source: id, layers: layerIds }); return snapshot;
    }
    this.addGeoJSON(id, await e2.search({ feature, ...(options.area_id ? { area_id: options.area_id } : { area: options.area }), mode: options.mode, limit: options.limit, signal: options.signal, ...(options.year !== undefined && options.year !== null ? { year: options.year } : {}) }), options.color);
    return snapshot;
  }

  async addFeatures(features: Array<string | number>, options: MapFeatureOptions = {}): Promise<Array<PublishedSnapshot | undefined>> { return Promise.all(features.map((feature) => this.addFeature(feature, options))); }
  removeFeature(feature: string | number): void { const entry = this.sources.get(String(feature)); if (!entry) return; entry.layers.forEach((id) => { if (this.map.getLayer(id)) this.map.removeLayer(id); }); if (this.map.getSource(entry.source)) this.map.removeSource(entry.source); this.sources.delete(String(feature)); }
  addGeoJSON(id: string, data: MapFeatureCollection, color = "#3ecf8e"): void { const source = this.map.getSource(id) as GeoJSONSource | undefined; if (source) source.setData(data as never); else { this.map.addSource(id, { type: "geojson", data: data as never }); this.map.addLayer({ id: `${id}-points`, type: "circle", source: id, paint: { "circle-radius": 5, "circle-color": color, "circle-stroke-color": "#101817", "circle-stroke-width": 1 } }); } }

  async route(options: MapRouteOptions): Promise<Record<string, unknown>> { await this.ready; const response = await this.getE2().route.route(options); const geometry = routeGeometry(response); if (geometry) { this.addGeoJSON(ROUTE_SOURCE, { type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: {} }] }, "#f0b45d"); if (!this.map.getLayer(ROUTE_LAYER)) this.map.addLayer({ id: ROUTE_LAYER, type: "line", source: ROUTE_SOURCE, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#f0b45d", "line-width": 4 } }); } return response; }
  async compute(options: MapComputeOptions): Promise<unknown> { await this.ready; const result = await this.getE2().compute.run(options); if (isCollection(result)) { this.addGeoJSON(COMPUTE_SOURCE, result, "#b68cff"); if (!this.map.getLayer(COMPUTE_LAYER)) this.map.addLayer({ id: COMPUTE_LAYER, type: "circle", source: COMPUTE_SOURCE, paint: { "circle-radius": 6, "circle-color": "#b68cff" } }); } return result; }
  destroy(): void { this.map.remove(); try { maplibregl.removeProtocol("pmtiles"); } catch { /* already removed */ } }
}

/** Create a standalone browser map without constructing an E2 client first. */
export function createMap(options: MapOptions): Map { return new Map(options); }
