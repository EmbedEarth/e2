import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SearchClient } from "../src/SearchClient.js";
import { parseCacheSize, MIN_CACHE_BYTES } from "../src/CacheClient.js";
import { StorageClient } from "../src/StorageClient.js";
import { ComputeClient } from "../src/ComputeClient.js";
import { RemoteComputeExecutor } from "../src/RemoteComputeExecutor.js";
import { mapSources, selectMapSnapshot } from "../src/MapSources.js";
import { E2 } from "../src/E2.js";
import { HttpSearchExecutor } from "../src/HttpSearchExecutor.js";
import { RouteClient } from "../src/RouteClient.js";
import { latLngToCell } from "h3-js";

describe("SDK surfaces", () => {
  it("keeps multiple features and areas in a bounded GeoJSON result", async () => {
    const calls: Array<{ feature: string | number; regionId?: string | null }> = [];
    const search = new SearchClient({
      async query(query) {
        calls.push({ feature: query.feature, regionId: query.regionId });
        return { rows: [{ id: `${query.feature}:${query.regionId}`, geometry: null, properties: { feature: query.feature } }] };
      },
    });
    const result = await search.search({ feature: ["restaurant", "hospital"], area: ["manhattan", "queens"], limit: 4 });
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(4);
    expect(calls).toHaveLength(4);
    expect(new Set(result.features.map((item) => item.properties.feature))).toEqual(new Set(["restaurant", "hospital"]));
  });

  it("returns source_id as the GeoJSON feature id when parquet has no id column", async () => {
    const search = new SearchClient({ async query() {
      return { rows: [{ source_id: "source-123", geometry: null, properties: { name: "Example" } }] };
    } });
    const result = await search.search({ feature: "restaurants", limit: 1 });
    expect(result.features[0]?.id).toBe("source-123");
    expect(result.features[0]?.properties.source_id).toBe("source-123");
  });

  it("resolves named state and country areas without an OSM source assumption", async () => {
    const calls: Array<{ feature: string | number; regionId?: string | null }> = [];
    const e2 = new E2({ search: { async query(query) {
      calls.push({ feature: query.feature, regionId: query.regionId });
      return { rows: [{ id: `${query.feature}:${query.regionId}`, geometry: null, properties: {} }] };
    } } });
    await e2.search({ feature: "restaurants", area: "New York", limit: 1 });
    await e2.search({ feature: "new-building-permit-permits", area: "United States", limit: 1 });
    expect(calls).toEqual([
      { feature: "restaurants", regionId: "4915" },
      { feature: "new-building-permit-permits", regionId: "236" },
    ]);
    expect(e2.datasets.info("cracked-sidewalk").source).toBe("visual");
    expect(e2.datasets.info("new-building-permit-permits").source).toBe("permits");
  });

  it("adapts authenticated visual search results to GeoJSON", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      feature: { id: 16865, feature_type: "visual" },
      results: [{ address: "Test location", geometry: { type: "Point", coordinates: [-74, 40.7] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await new SearchClient(new HttpSearchExecutor({ url: "https://api.example.test/search" })).search({ feature: "cracked-sidewalk", area_id: "143082", limit: 1 });
      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.geometry).toEqual({ type: "Point", coordinates: [-74, 40.7] });
      expect(result.features[0]?.properties.address).toBe("Test location");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves visual provider ids as GeoJSON ids", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      feature: { id: 16865, feature_type: "visual" },
      results: [{ id: "916017948968837", geometry: { type: "Point", coordinates: [-119, 36] }, visual_url: "https://example.test/image.jpg" }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await new SearchClient(new HttpSearchExecutor({ url: "https://api.example.test/search" })).search({ feature: "cracked-sidewalk", area_id: "4880", limit: 1 });
      expect(result.features[0]?.id).toBe("916017948968837");
      expect(result.features[0]?.properties.id).toBe("916017948968837");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("adds the Cloud plan image message to every unauthenticated non-visual row", async () => {
    const e2 = new E2({ search: { async query() {
      return {
        rows: [
          { id: "restaurant-1", geometry: { type: "Point", coordinates: [-118, 34] }, properties: { name: "One" } },
          { id: "restaurant-2", geometry: { type: "Point", coordinates: [-119, 35] }, properties: { name: "Two", image_url: "https://example.test/should-not-leak.jpg" } },
        ],
      };
    } } });

    const result = await e2.search({ feature: "restaurant", area_id: "4880", limit: 2 });
    expect(result.features).toHaveLength(2);
    expect(result.features.every((feature) => feature.properties.image_url === "Please upgrade to the Cloud plan to access image URLs.")).toBe(true);
  });

  it("passes an exact area_id without resolving it as a name", async () => {
    const search = new SearchClient({ async query(query) { return { rows: [{ id: query.regionId ?? "none", geometry: null, properties: {} }] }; } }, () => { throw new Error("area name resolver should not run"); });
    const result = await search.search({ feature: "restaurant", area_id: "4915", limit: 1 });
    expect(result.features[0]?.id).toBe("4915");
  });

  it("passes an exact compute area_id without resolving it as a name", async () => {
    const requests: Array<{ area_id?: string }> = [];
    const compute = new ComputeClient({ compute(request) { requests.push({ area_id: request.area_id }); return 7; } }, () => { throw new Error("area name resolver should not run"); });
    await compute.run({ primitive: "COUNT", feature: "restaurant", area_id: "4915" });
    expect(requests).toEqual([{ area_id: "4915" }]);
  });

  it("enforces the one gigabyte cache floor", () => {
    expect(parseCacheSize("1GB")).toBe(MIN_CACHE_BYTES);
    expect(() => parseCacheSize("not-a-size")).toThrow();
  });

  it("computes remote feature relations and compares features", async () => {
    const search = {
      async query(query: { feature: string | number }) {
        const rows = query.feature === "restaurant"
          ? [{ id: "restaurant-1", lat: 40.7, lng: -74, properties: {} }]
          : [{ id: "park-1", lat: 40.701, lng: -74, properties: {} }];
        return { rows };
      },
    };
    const compute = new ComputeClient(new RemoteComputeExecutor(search));
    expect(await compute.feature("restaurant").near("park", 500).mode("cloud").count()).toBe(1);
    const comparison = await compute.compare({ features: ["restaurant", "park"], primitive: "COUNT" });
    expect(comparison.comparison).toBe("features");
    expect(comparison.left.value).toBe(1);
  });

  it("routes a coordinate to the closest feature after area and H3 narrowing", async () => {
    const origin = { lat: 40.74, lon: -73.99 };
    const nearby = { lat: 40.741, lon: -73.991 };
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ locations: [origin, nearby] });
      return new Response(JSON.stringify({ trip: {} }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const route = new RouteClient("https://router.example", {
        async query(query) {
          expect(query.regionId).toBe("4915");
          expect(query.h3Cells).toEqual(expect.arrayContaining([latLngToCell(origin.lat, origin.lon, 7)]));
          return { rows: [
            { lat: nearby.lat, lng: nearby.lon, h3_r7: latLngToCell(nearby.lat, nearby.lon, 7) },
            { lat: 41.5, lng: -73.1, h3_r7: latLngToCell(41.5, -73.1, 7) },
          ] };
        },
      }, (area) => area, {}, async () => "4915");
      await route.feature("restaurant").from(origin).nearest();
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("prefers the newest published feature PMTiles and always includes Planet", () => {
    const snapshots = [
      { featureId: 7, feature: "restaurant", featureName: "Restaurants", regionId: null, snapshotDate: "2026-08-17", schemaVersion: 2, pmtilesDownloadUrl: "https://example.test/old.pmtiles", pmtilesStatus: "published" },
      { featureId: 7, feature: "restaurant", featureName: "Restaurants", regionId: null, snapshotDate: "2026-08-18", schemaVersion: 2, pmtilesDownloadUrl: "https://example.test/new.pmtiles", pmtilesStatus: "published" },
      { featureId: 7, feature: "restaurant", featureName: "Restaurants", regionId: null, snapshotDate: "2026-08-19", schemaVersion: 2, pmtilesDownloadUrl: "https://example.test/processing.pmtiles", pmtilesStatus: "processing" },
    ] as never;
    expect(selectMapSnapshot(snapshots, "restaurants")?.pmtilesDownloadUrl).toBe("https://example.test/new.pmtiles");
    expect(mapSources(snapshots, ["restaurant"])).toHaveLength(2);
    expect(mapSources(snapshots, ["restaurant"])[0]?.type).toBe("planet");
  });

  it("uses the public route service by default", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).not.toMatchObject({ authorization: expect.anything() });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        costing: "auto",
        locations: [{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }],
      });
      return new Response(JSON.stringify({ route: { distanceKm: 1 } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const e2 = new E2({ search: { async query() { return { rows: [] }; } } });
      await e2.route.route({ locations: [{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }] });
      expect(fetchMock).toHaveBeenCalledWith("https://route.embed.earth/route", expect.any(Object));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the hosted routing API with a bearer key", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: "Bearer test-key" });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        operation: "route",
        costing: "auto",
        locations: [{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }],
      });
      return new Response(JSON.stringify({ route: { distanceKm: 1 } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const e2 = new E2({ apiKey: "test-key", routingUrl: "https://api.example.test/routing", search: { async query() { return { rows: [] }; } } });
      await e2.route.route({ locations: [{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }], mode: "driving" });
      expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/routing", expect.any(Object));

    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("validates coordinate input before the internal area selection", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const e2 = new E2({ search: { async query() { return { rows: [] }; } } });
      await expect(e2.search({ feature: "restaurant", latitude: 91, longitude: 0 })).rejects.toThrow("Latitude must be between -90 and 90");
      await expect(e2.search({ feature: "restaurant", latitude: 0, longitude: 181 })).rejects.toThrow("Longitude must be between -180 and 180");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("resolves search coordinates to city, then state, then country before querying", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).includes("regions/resolve")) {
        return new Response(JSON.stringify({ lat: 40.7128, lng: -74.006, found: true, c_id: "10", c_name: null, country_code: null, s_id: "55", s_name: null, state_code: null, r_id: "998", r_name: null, p_id: null, p_name: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ rows: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const calls: Array<{ regionId?: string | null; h3Cells?: readonly string[] }> = [];
    try {
      const e2 = new E2({ search: { async query(query) { calls.push({ regionId: query.regionId, h3Cells: query.h3Cells }); return { rows: [] }; } } });
      await e2.search({ feature: "restaurant", latitude: 40.7128, longitude: -74.006 });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.regionId).toBe("998");
      expect(calls[0]?.h3Cells).toEqual(expect.arrayContaining([latLngToCell(40.7128, -74.006, 7)]));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("resolves country_code and state_code to the matching area", async () => {
    const calls: Array<{ regionId?: string | null }> = [];
    const e2 = new E2({ search: { async query(query) { calls.push({ regionId: query.regionId }); return { rows: [] }; } } });
    await e2.search({ feature: "restaurant", country_code: "US", state_code: "NY" });
    expect(calls).toEqual([{ regionId: "4915" }]);
  });

  it("resolves compute coordinates before invoking the executor", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ lat: 40.7128, lng: -74.006, found: true, c_id: "10", c_name: null, country_code: null, s_id: "55", s_name: null, state_code: null, r_id: "998", r_name: null, p_id: null, p_name: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const requests: Array<{ area_id?: string }> = [];
      const e2 = new E2({ compute: { compute(request) { requests.push({ area_id: request.area_id }); return { ok: true }; } } });
      await e2.compute.run({ primitive: "COUNT", feature: "restaurant", latitude: 40.7128, longitude: -74.006 });
      expect(requests).toEqual([{ area_id: "998" }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects coordinate queries combined with explicit regions", async () => {
    const e2 = new E2({ search: { async query() { return { rows: [] }; } } });
    await expect(e2.search({ feature: "restaurant", area: "Manhattan", latitude: 40.7, longitude: -74 })).rejects.toThrow("Use area/area_id or latitude/longitude");
    await expect(e2.compute.run({ primitive: "COUNT", feature: "restaurant", area_id: "143082", latitude: 40.7, longitude: -74 })).rejects.toThrow("Use area/area_id or latitude/longitude");
  });

  it("bypasses hosted authentication for a raw Valhalla URL", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      return new Response(JSON.stringify({ trip: {} }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const e2 = new E2({ valhallaUrl: "https://valhalla.example.test", search: { async query() { return { rows: [] }; } } });
      await e2.route.route({ locations: [{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }] });
      expect(fetchMock).toHaveBeenCalledWith("https://valhalla.example.test/route", expect.any(Object));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps every hosted operation and forwards AbortSignal", async () => {
    const operations: string[] = [];
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      operations.push(String(JSON.parse(String(init?.body)).operation));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const e2 = new E2({ apiKey: "test-key", routingUrl: "https://api.example.test/routing", search: { async query() { return { rows: [] }; } } });
      const locations = [{ lat: 40.7, lon: -74 }, { lat: 40.8, lon: -73.9 }];
      await e2.route.route({ locations });
      await e2.route.matrix({ sources: [locations[0]], targets: [locations[1]] });
      await e2.route.isochrone({ locations: [locations[0]], contours: [{ time: 10 }] });
      await e2.route.mapMatch({ shape: locations });
      await e2.route.locate({ locations: [locations[0]] });
      await e2.route.height({ shape: locations });
      expect(operations).toEqual(["route", "matrix", "isochrone", "mapMatch", "locate", "height"]);

      const controller = new AbortController();
      const signalFetch = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
        expect(init?.signal).toBe(controller.signal);
        throw new Error("cancelled");
      });
      vi.stubGlobal("fetch", signalFetch);
      await expect(e2.route.route({ locations }, controller.signal)).rejects.toThrow("cancelled");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("indexes GeoJSON and writes a feature-linked GeoParquet file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "e2-sdk-test-"));
    const input = join(directory, "places.geojson");
    const output = join(directory, "places.geoparquet");
    await writeFile(input, JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-74, 40.7] }, properties: { name: "Test place" } }] }));
    try {
      const result = await new StorageClient().upload({ path: input, database: ":memory:", connectTo: "restaurant", output });
      expect(result.rows).toBe(1);
      expect((await readFile(output)).byteLength).toBeGreaterThan(0);
    } finally {
      try { await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* Windows may release SQLite handles after the test exits. */ }
    }
  }, 30_000);

  it("creates a separate local feature namespace for uploads", async () => {
    const directory = await mkdtemp(join(tmpdir(), "e2-local-feature-"));
    const input = join(directory, "stores.geojson");
    try {
      await writeFile(input, JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-74, 40.7] }, properties: { name: "Store" } }] }));
      const result = await new StorageClient().upload({ path: input, database: ":memory:", feature: "stores", namespace: "my-app" });
      expect(result.feature).toBe("local:my-app:stores");
      expect(result.featureId).toBeGreaterThanOrEqual(1_500_000_000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
