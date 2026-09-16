# @embedearth/mcp

EmbedEarth (E2) is an open, programmable geographic engine for the physical world. This MCP server gives AI agents structured tools for Search, Compute, Route, Map, and Stratum.

E2 is built as an open alternative to Google Maps Platform, bringing together capabilities commonly spread across Maps, Places, Routes, Geocoding, Autocomplete, and Street View — while adding spatial computation, open geographic data, and local execution.

## Why E2

Traditional mapping APIs are built primarily around maps, places, and directions. E2 makes the broader physical world programmable.

Give agents the tools to:

* **Search** places, infrastructure, observations, nature, civic data, and other real-world features.
* **Compute** distance, proximity, counts, density, coverage, gaps, and other spatial relationships.
* **Map** basemaps, features, routes, and application data.
* **Route** between coordinates or directly to real-world features.
* **Stratum** geographic datasets for local, offline, and cloud workflows.
* Access **street-level imagery** and visual observations tied to geographic locations.

For agents coming from Google Maps Platform integrations, E2 can replace many common tool workflows built around Maps, Places, Routes, Geocoding, and street-level imagery while giving agents direct access to broader geographic datasets and spatial computation.

## Install

```bash
npx -y @embedearth/mcp
```

## Modes

E2 can run locally or in the cloud. Local datasets are downloaded once per region and reused for future requests, so the same data does not need to be fetched again.

| Mode | Purpose |
| --- | --- |
| `auto` | Use local data when available, otherwise cloud. |
| `offline` | Download once, then reuse locally. |
| `cloud` | Cloud execution with unlimited use using an API key. |

## API key and limits

An API key is optional for basic cloud use and unlocks full cloud access. Create one at [embed.earth](https://embed.earth) and configure it as `E2_API_KEY` in the MCP host environment; a key is also required for street-level imagery. Without a key, cloud Search, Compute, and Route requests are limited to 60 requests per minute, and `e2_stratum` `query` should be treated as one request per second.

## Search

`e2_search` searches the physical world by feature, place, region, or coordinates — places, infrastructure, observations, natural features, civic data, and other geographic datasets through one tool. It returns matching physical-world records as a GeoJSON `FeatureCollection`.

`feature` identifies what you want to find; it is a canonical key or numeric ID. Use `area` for a named region, `area_id` for an exact region, coordinates for a point lookup, or `country_code` and `state_code` for broader geographic selection.

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

```json
{ "feature": "restaurant", "area": "New York", "mode": "auto", "limit": 25 }
```

```json
{ "feature": "restaurant", "area_id": "4915", "mode": "cloud", "limit": 25 }
```

```json
{ "feature": "restaurant", "latitude": 40.7128, "longitude": -74.006, "mode": "cloud", "limit": 25 }
```

```json
{ "feature": "restaurant", "country_code": "US", "state_code": "NY", "mode": "cloud", "limit": 25 }
```

## Compute

`e2_compute` runs spatial analysis directly against geographic features — find what is nearest, measure distance, count features, calculate density and coverage, detect gaps, or cluster nearby objects — turning geographic data into answers without a separate GIS stack.

`feature` defines what is being measured, while `area` or `area_id` defines the geographic scope. Relationship parameters such as `near` connect one feature set to another.

| Primitive | Purpose |
| --- | --- |
| `NEAREST` | Find the closest features. |
| `DISTANCE` | Measure distance between feature sets. |
| `WITHIN` | Select features inside a relation distance. |
| `COUNT` | Count related features. |
| `DENSITY` | Measure feature concentration. |
| `COVERAGE` | Measure reached area. |
| `GAPS` | Find unreached areas. |
| `CLUSTER` | Group nearby features. |

```json
{ "primitive": "COUNT", "feature": ["restaurant"], "area_id": "4915", "near": "park", "distanceMeters": 500, "mode": "cloud" }
```

```json
{ "primitive": "DENSITY", "feature": ["restaurant"], "area": "New York", "near": "park", "distanceMeters": 500, "mode": "auto" }
```

## Routing

Calculate movement through the physical world. Build routes, travel-time matrices, isochrones, map matches, elevation queries, and network-aware searches from coordinates or E2 features — so agents can route to things rather than only fixed coordinates. Use `e2_route_to_feature` for a coordinate-to-feature route and `e2_route` for direct routes, matrices, isochrones, map matching, locate, and height.

Set `ROUTE_URL` only when using your own compatible routing service.

| Tool or operation | Purpose |
| --- | --- |
| `e2_route_to_feature` | Route from a coordinate to a matching feature, such as the closest restaurant. |
| `e2_route` with `route` | Build a route between one or more coordinates. |
| `e2_route` with `matrix` | Return travel costs between multiple sources and targets. |
| `e2_route` with `isochrone` | Calculate the area reachable within one or more time limits. |
| `e2_route` with `mapMatch` | Match a recorded coordinate trace to the road network. |
| `e2_route` with `locate` | Resolve a coordinate to the routable network. |
| `e2_route` with `height` | Return elevation data for one or more locations. |

```json
{ "feature": "restaurant", "from": [40.7128, -74.006], "mode": "walking" }
```

```json
{ "operation": "matrix", "body": { "sources": [{ "lat": 40.7128, "lon": -74.006 }], "targets": [{ "lat": 40.7306, "lon": -73.9352 }], "mode": "driving" } }
```

## Maps

`e2_map_sources` renders E2 data as MapLibre-compatible map sources — the global Planet basemap and PMTiles feature layers. It returns map data metadata rather than rendering a map in the agent conversation, keeping styling and interaction in the client application.

## Stratum

`e2_stratum` is E2's portable data layer for geographic datasets. Discover, download, cache, query, and upload geographic data for local or cloud workflows without maintaining a traditional spatial database. It supports GeoJSON, CSV, Parquet, and SQLite and lets datasets be downloaded once and reused across applications and regions.

| Operation | Purpose |
| --- | --- |
| `cacheList`, `cacheSet`, `cacheDelete`, `cacheClear` | Manage verified local data. |
| `featureList`, `featureSearch`, `featureInfo` | Look up built-in features. |
| `areaList`, `areaSearch`, `areaInfo` | Look up built-in areas. |
| `dataList`, `dataInfo` | Inspect published data. |
| `download`, `query` | Pull and query Cloud or local data. |
| `upload` | Add namespaced local data. |

```json
{ "operation": "upload", "path": "./stores.geojson", "database": "./stores.db", "feature": "stores", "namespace": "my-app" }
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

[SDK package](https://www.npmjs.com/package/@embedearth/sdk) · [CLI package](https://www.npmjs.com/package/@embedearth/cli) · [Full MCP docs](https://embed.earth/docs/mcp)
