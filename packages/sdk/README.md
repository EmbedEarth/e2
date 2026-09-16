# @embedearth/sdk

EmbedEarth (E2) is an open, programmable geographic engine for the physical world. Search places and real-world features, run spatial computations, build routes, render maps, and work with geographic datasets through one SDK.

E2 is built as an open alternative to Google Maps Platform, bringing together capabilities commonly spread across Maps, Places, Routes, Geocoding, Autocomplete, and Street View — while adding spatial computation, open geographic data, and local execution.

## Why E2

Traditional mapping APIs are built primarily around maps, places, and directions. E2 makes the broader physical world programmable.

Use one SDK to:

* **Search** places, infrastructure, observations, nature, civic data, and other real-world features.
* **Compute** distance, proximity, counts, density, coverage, gaps, and other spatial relationships.
* **Map** basemaps, features, routes, and application data.
* **Route** between coordinates or directly to real-world features.
* **Stratum** geographic datasets for local, offline, and cloud workflows.
* Access **street-level imagery** and visual observations tied to geographic locations.

For developers coming from Google Maps Platform, E2 can replace many common workflows built around Maps, Places, Routes, Geocoding, Autocomplete, and street-level imagery while giving applications direct access to broader geographic datasets and spatial computation.

## Install

```bash
npm install @embedearth/sdk
```

Use `@embedearth/sdk/node` for filesystem-backed workflows and local datasets.

## Modes

E2 can run locally or in the cloud. Local datasets are downloaded once per region and reused for future requests, so the same data does not need to be fetched again.

| Mode | Purpose |
| --- | --- |
| `auto` | Use local data when available, otherwise cloud. |
| `offline` | Download once, then reuse locally. |
| `cloud` | Cloud execution with unlimited use using an API key. |

## API key and limits

An API key is optional for basic cloud use and unlocks full cloud access. Create a key at [embed.earth](https://embed.earth) and pass it as `apiKey`; a key is also required for street-level imagery. Without a key, cloud Search, Compute, and Route requests are limited to 60 requests per minute, and `stratum.query` should be treated as one request per second.

```ts
const e2 = new E2({ apiKey: process.env.E2_API_KEY });
```

## Search

Search the physical world by feature, place, region, or coordinates. Query places, infrastructure, observations, natural features, civic data, and other geographic datasets through one interface. Results are returned as GeoJSON and can be passed directly into Compute, Map, or Route.

`feature` identifies what you want to find. Use `area` for a named region, `area_id` for an exact region, coordinates for a point lookup, or `country_code` and `state_code` for broader geographic selection.

### Optional parameters

| Parameter | Type | Purpose |
| --- | --- | --- |
| `area` | `string \| string[]` | Search one or more named areas. Mutually exclusive with `area_id`. |
| `area_id` | `string \| string[]` | Search one or more exact area IDs. Mutually exclusive with `area`. |
| `country_code` | `string` | Select a country, for example `US`. |
| `state_code` | `string` | Select a state or province, for example `NY`. |
| `latitude`, `longitude` | `number` | Search around a coordinate. Provide both. |
| `mode` | `"cloud" \| "offline" \| "auto"` | Select the execution mode. Defaults to `auto`. |
| `limit` | `number` | Maximum number of returned features. Defaults to `1000`. |
| `cacheDirectory` | `string` | Override the local Stratum cache directory. |
| `signal` | `AbortSignal` | Cancel the request. |

```ts
await e2.search({ feature: "restaurant", area: "New York", mode: "auto" });
await e2.search({ feature: "restaurant", area_id: "4915", mode: "cloud" });
await e2.search({ feature: "restaurant", latitude: 40.7128, longitude: -74.006, mode: "cloud" });
await e2.search({ feature: "restaurant", country_code: "US", state_code: "NY", mode: "cloud" });
```

## Compute

Run spatial analysis directly against geographic features. Find what is nearest, measure distance, count features, calculate density and coverage, detect gaps, or cluster nearby objects. Compute turns geographic data into answers without requiring a separate GIS stack.

`feature` defines what is being measured, while `area` or `area_id` defines the geographic scope. Relationship methods such as `near` connect one feature set to another.

| Primitive | Purpose |
| --- | --- |
| `nearest` | Find the closest features. |
| `distance` | Measure distance between feature sets. |
| `within` | Select features inside a relation distance. |
| `count` | Count related features. |
| `density` | Measure feature concentration. |
| `coverage` | Measure reached area. |
| `gaps` | Find unreached areas. |
| `cluster` | Group nearby features. |

```ts
await e2.compute.feature("restaurant").areaId("4915").near("park", 500).count();
await e2.compute.feature("restaurant").area("New York").near("park", 500).density();
await e2.compute.run({ primitive: "COUNT", feature: "restaurant", latitude: 40.7128, longitude: -74.006 });
```

## Map

Render E2 data using MapLibre-compatible maps and PMTiles. Load the global basemap alongside feature layers, Search results, routes, and your own geographic data. E2 provides map-ready sources while your application keeps control over styling and interaction.

Use `@embedearth/sdk/map` for browser rendering.

```ts
const sources = await e2.map.sources(["restaurant"]);
```

## Route

Calculate movement through the physical world. Build routes, travel-time matrices, isochrones, map matches, elevation queries, and network-aware searches from coordinates or E2 features. Route can work directly with geographic features, so applications can route to things rather than only fixed coordinates.

Set `routeUrl` only when using your own compatible routing service.

| Function | Purpose |
| --- | --- |
| `e2.route.feature(...).from(...).nearest(...)` | Route from a coordinate to a matching feature, such as the closest restaurant. |
| `e2.route.route(...)` | Build a route between one or more coordinates. |
| `e2.route.matrix(...)` | Return travel costs between multiple sources and targets. |
| `e2.route.isochrone(...)` | Calculate the area reachable within one or more time limits. |
| `e2.route.mapMatch(...)` | Match a recorded coordinate trace to the road network. |
| `e2.route.locate(...)` | Resolve a coordinate to the routable network. |
| `e2.route.height(...)` | Return elevation data for one or more locations. |

```ts
const e2 = new E2({ routeUrl: "https://your-router.example" });
await e2.route.feature("restaurant").from({ lat: 40.7128, lon: -74.006 }).nearest({ mode: "walking" });
await e2.route.matrix({ sources: [{ lat: 40.7128, lon: -74.006 }], targets: [{ lat: 40.7306, lon: -73.9352 }] });
await e2.route.isochrone({ locations: [{ lat: 40.7128, lon: -74.006 }], contours: [{ time: 10 }, { time: 20 }] });
```

## Stratum

Stratum is E2's portable data layer for geographic datasets. Discover, download, cache, query, and upload geographic data for local or cloud workflows without maintaining a traditional spatial database. It supports GeoJSON, CSV, Parquet, and SQLite and lets datasets be downloaded once and reused across applications and regions.

Use the Node entry point for filesystem-backed Stratum workflows.

| Function | Purpose |
| --- | --- |
| `cache.*` | Manage verified local data. |
| `features.*` / `areas.*` | Look up built-in inputs. |
| `datasets.*` | Inspect published data. |
| `download` / `query` | Pull and query Cloud or local data. |
| `upload` | Add namespaced local data. |

```ts
import { E2, stratum } from "@embedearth/sdk/node";
const local = new E2({ cacheDirectory: "./.e2" });
await local.stratum.download({ feature: "restaurant", regionId: "4915" });
await local.stratum.upload({ path: "./stores.geojson", database: "./stores.db", feature: "stores", namespace: "my-app" });
const standalone = stratum({ cacheDirectory: "./.e2" });
```

## Geographic Catalog

E2 organizes the physical world into **features** and **areas**.

**Features** describe what exists — places, infrastructure, observations, natural features, imagery-linked records, and other physical-world objects.

**Areas** describe where — countries, states, cities, and other geographic regions with stable IDs.

Browse the Feature and Area catalogs to discover available inputs across Search, Compute, Route, and Stratum: [Catalog Features](https://www.embed.earth/catalog/features) · [Catalog Areas](https://www.embed.earth/catalog/areas).

## Street-level Imagery

EmbedEarth processes billions of street-level images to connect visual observations with geographic features and places. Imagery adds visual context to locations and can surface physical-world features that may not appear in conventional place databases.

Street-level imagery is currently cloud-based and requires an API key and active plan.

## Other interfaces

[CLI package](https://www.npmjs.com/package/@embedearth/cli) · [MCP package](https://www.npmjs.com/package/@embedearth/mcp) · [Full SDK docs](https://embed.earth/docs/sdk)
