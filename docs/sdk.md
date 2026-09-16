# EmbedEarth SDK

EmbedEarth is an open, programmable geographic layer for physical-world data. It lets applications search places and observations, run spatial analysis, build routes, render maps, and work with local data through one interface.

## Modes

| Mode | Purpose |
| --- | --- |
| `auto` | Local-first development: use verified Stratum cache when available, then run the function in Cloud. |
| `offline` | Reproducible or air-gapped work: use only verified data already in the local cache and make no network request. |
| `cloud` | Run the function in EmbedEarth Cloud against the published data. An API key is optional, but unauthenticated Cloud use is heavily limited. |

## API key and limits

An API key is optional. Cloud Search, Compute, and Route requests are limited to 60 requests per minute without a key, or 2,000 requests per minute with a key. `stratum.query` without a key should be treated as one request per second. A key is also required for Street View image access. Create one at [embed.earth](https://embed.earth) and pass it to `E2`.

```ts
const e2 = new E2({ apiKey: process.env.E2_API_KEY });
```

## Search

Search returns matching records as a GeoJSON `FeatureCollection`. Put a feature key or numeric feature ID in `feature`; use `area` for a named area, `area_id` for an exact raw area ID, or coordinates for a point-centered lookup. `country_code` and `state_code` can select a country or state/province when an area name is not convenient.

### Optional parameters

| Parameter | Type | Purpose |
| --- | --- | --- |
| `area` | `string \| string[]` | Search named areas. Mutually exclusive with `area_id`. |
| `area_id` | `string \| string[]` | Search exact area IDs. Mutually exclusive with `area`. |
| `country_code` | `string` | Select a country, for example `US`. |
| `state_code` | `string` | Select a state or province, for example `NY`. |
| `latitude`, `longitude` | `number` | Search around a coordinate. Provide both. |
| `mode` | `cloud \| offline \| auto` | Select the execution mode. Defaults to `auto`. |
| `limit` | `number` | Maximum number of returned features. Defaults to `1000`. |
| `cacheDirectory` | `string` | Override the local Stratum cache directory. |
| `signal` | `AbortSignal` | Cancel the request. |

```ts
await e2.search({ feature: "restaurant", area: "New York", mode: "auto", limit: 25 });
await e2.search({ feature: ["restaurant", "hospital"], area_id: "4915", mode: "cloud" });
await e2.search({ feature: "restaurant", latitude: 40.7128, longitude: -74.006, mode: "cloud" });
await e2.search({ feature: "restaurant", country_code: "US", state_code: "NY", mode: "cloud" });
```

## Compute

Compute measures relationships and aggregates over features; it returns analysis rather than a raw feature collection. `feature` is the feature or features being measured, while `area` or `area_id` defines the geographic scope and relation methods such as `near` provide a second feature when needed.

| Primitive | Purpose |
| --- | --- |
| `nearest` | Find the closest selected feature or features. |
| `distance` | Measure distance between feature sets. |
| `within` | Select features inside a relation distance. |
| `count` | Count features that meet a relation. |
| `density` | Measure feature concentration. |
| `coverage` | Measure the area reached by a relation. |
| `gaps` | Find areas not reached by coverage. |
| `cluster` | Group nearby features into spatial clusters. |

```ts
await e2.compute.feature("restaurant").areaId("4915").near("park", 500).count();
await e2.compute.feature("restaurant").area("New York").near("park", 500).density();
await e2.compute.run({ primitive: "COUNT", feature: "restaurant", latitude: 40.7128, longitude: -74.006 });
```

## Routing

Routing builds directions and network-analysis responses from coordinates or indexed features. Route from any coordinate to a feature such as `restaurant`, or call the lower-level route, matrix, isochrone, map-match, locate, and height functions.

Set `routeUrl` only when you want a custom compatible routing service.

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

await e2.route.feature("restaurant")
  .from({ lat: 40.7128, lon: -74.006 })
  .nearest({ mode: "walking" });

await e2.route.matrix({
  sources: [{ lat: 40.7128, lon: -74.006 }],
  targets: [{ lat: 40.7306, lon: -73.9352 }],
  mode: "driving",
});

await e2.route.isochrone({
  locations: [{ lat: 40.7128, lon: -74.006 }],
  contours: [{ time: 10 }, { time: 20 }],
});
```

## Maps

Maps prepares MapLibre-ready sources rather than rendering a map by itself. Use the returned Planet and feature PMTiles descriptors with the MapLibre client, or import `createMap` from `@embedearth/sdk/map` for browser rendering.

```ts
const sources = await e2.map.sources(["restaurant"]);
```

## Stratum

Stratum is the data layer behind local-first work: it provides built-in feature and area lookup, published data discovery, verified caching, downloads, local queries, and user-owned uploads. Use the Node entry point for filesystem-backed operations; local feature names are namespaced so they do not collide with built-in features.

| Function | Purpose |
| --- | --- |
| `e2.stratum.cache.*` | Set limits and list, remove, or clear verified local data. |
| `e2.stratum.features.*` | Look up built-in geographical features. |
| `e2.stratum.areas.*` | Look up built-in geographical areas. |
| `e2.stratum.datasets.*` | Inspect published data and snapshot availability. |
| `e2.stratum.download` | Pull a published Stratum to the cache or a local file. |
| `e2.stratum.query` | Query Cloud data or a verified local copy. |
| `e2.stratum.upload` | Add local GeoJSON, CSV, or Parquet data. |

```ts
import { E2, stratum } from "@embedearth/sdk/node";

const local = new E2({ cacheDirectory: "./.e2" });
await local.stratum.download({ feature: "restaurant", regionId: "4915" });
await local.stratum.upload({ path: "./stores.geojson", database: "./stores.db", feature: "stores", namespace: "my-app" });
const standalone = stratum({ cacheDirectory: "./.e2" });
```

## Geographical Features

Geographical features are the searchable physical-world types and datasets, such as restaurants, hospitals, roads, observations, and imagery-linked records. Use their canonical key or numeric ID in Search, Compute, Routing, Maps, and Stratum.

Browse the catalog at [Catalog Features](https://www.embed.earth/catalog/features).

## Geographical Areas

Geographical areas are the countries, states, cities, and other regions used to scope data. Use an area name for convenience or an exact `area_id` when you need a stable raw identifier.

Browse the catalog at [Catalog Areas](https://www.embed.earth/catalog/areas).

## Street View Images

EmbedEarth ingests billions of Street View images and discovers new features or relationships where imagery pairs with reported places. Because image retrieval is expensive, Street View is Cloud-only for now; an API key and an active subscription are required for unlimited access.

## Other interfaces

[CLI](cli.md) · [MCP](mcp.md)
