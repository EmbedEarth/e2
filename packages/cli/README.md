# @embedearth/cli

EmbedEarth (E2) is an open, programmable geographic engine for the physical world. The `earth` CLI brings Search, Compute, Route, Map, and Stratum to terminals, scripts, and automation.

E2 is built as an open alternative to Google Maps Platform, bringing together capabilities commonly spread across Maps, Places, Routes, Geocoding, Autocomplete, and Street View — while adding spatial computation, open geographic data, and local execution.

## Why E2

Traditional mapping APIs are built primarily around maps, places, and directions. E2 makes the broader physical world programmable.

Use one CLI to:

* **Search** places, infrastructure, observations, nature, civic data, and other real-world features.
* **Compute** distance, proximity, counts, density, coverage, gaps, and other spatial relationships.
* **Map** basemaps, features, routes, and application data.
* **Route** between coordinates or directly to real-world features.
* **Stratum** geographic datasets for local, offline, and cloud workflows.
* Access **street-level imagery** and visual observations tied to geographic locations.

For developers coming from Google Maps Platform, E2 can replace many common command-line workflows built around Maps, Places, Routes, Geocoding, and street-level imagery while giving scripts and automation direct access to broader geographic datasets and spatial computation.

## Install

```bash
npm install -g @embedearth/cli
```

## Modes

E2 can run locally or in the cloud. Local datasets are downloaded once per region and reused for future requests, so the same data does not need to be fetched again.

| Mode | Purpose |
| --- | --- |
| `auto` | Use local data when available, otherwise cloud. |
| `offline` | Download once, then reuse locally. |
| `cloud` | Cloud execution with unlimited use using an API key. |

## API key and limits

An API key is optional for basic cloud use and unlocks full cloud access. Get one at [embed.earth](https://embed.earth), then set `E2_API_KEY`; a key is also required for street-level imagery. Without a key, cloud Search, Compute, and Route requests are limited to 60 requests per minute, and `stratum query` should be treated as one request per second.

```powershell
$env:E2_API_KEY = "your_api_key"
```

## Search

Search the physical world by feature, place, region, or coordinates. Query places, infrastructure, observations, natural features, civic data, and other geographic datasets through one interface. Results are returned as GeoJSON `FeatureCollection` and can be piped into scripts and automation.

The positional feature arguments identify what you want to find; they are canonical feature keys or IDs. Use `--area` for a named region, `--area-id` for an exact region, or `--country-code` and `--state-code` for broader geographic selection.

### Optional parameters

| Option | Purpose |
| --- | --- |
| `--area <area>` | Search one or more named areas. |
| `--area-id <id>` | Search one or more exact area IDs. |
| `--country-code <code>` | Select a country, for example `US`. |
| `--state-code <code>` | Select a state or province, for example `NY`. |
| `--latitude <degrees>`, `--longitude <degrees>` | Search around a coordinate. Provide both. |
| `--mode <mode>` | Use `cloud`, `offline`, or `auto`; defaults to `auto`. |
| `--limit <number>` | Maximum number of returned features; defaults to `1000`. |
| `--json` | Print machine-readable JSON. |

```bash
earth search restaurant --area "New York" --mode auto --limit 25 --json
earth search restaurant hospital --area-id 4915 --mode cloud --json
earth search restaurant --country-code US --state-code NY --mode cloud --json
earth search restaurant --latitude 40.7128 --longitude -74.006 --mode cloud --json
```

## Compute

Run spatial analysis directly against geographic features. Find what is nearest, measure distance, count features, calculate density and coverage, detect gaps, or cluster nearby objects — without a separate GIS stack.

The feature arguments define what is being measured, `--area` or `--area-id` defines the geographic scope, and `--near` or `--within` connects one feature set to another.

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

```bash
earth compute count restaurant --area-id 4915 --near park --distance 500 --mode cloud --json
earth compute density restaurant --area "New York" --near park --distance 500 --mode auto --json
```

## Routing

Calculate movement through the physical world. Build routes, travel-time matrices, isochrones, map matches, elevation queries, and network-aware searches from coordinates or E2 features — so scripts can route to things rather than only fixed coordinates. Use `to-feature` for a coordinate-to-feature route; `route`, `matrix`, `isochrone`, `map-match`, and `request` cover other routing operations.

Set `ROUTE_URL` only when using your own compatible routing service.

| Command | Purpose |
| --- | --- |
| `earth route to-feature` | Route from a coordinate to a matching feature, such as the closest restaurant. |
| `earth route run` | Build a route between one or more coordinates. |
| `earth route matrix` | Return travel costs between multiple sources and targets. |
| `earth route isochrone` | Calculate the area reachable within one or more time limits. |
| `earth route map-match` | Match a recorded coordinate trace to the road network. |
| `earth route request` | Send another compatible routing operation. |

```powershell
$env:ROUTE_URL = "https://your-router.example"
earth route to-feature restaurant --from "40.7128,-74.006" --mode walking --json
earth route matrix --sources "40.7128,-74.006" --targets "40.7306,-73.9352" --mode driving --json
earth route isochrone --locations "40.7128,-74.006" --contours "10,20" --json
```

## Maps

Render E2 data using MapLibre-compatible maps and PMTiles. The CLI prepares MapLibre-ready source descriptors for the Planet basemap and feature layers — it returns data for a map client; it does not render a terminal map.

```bash
earth map sources restaurant hospital --json
```

## Stratum

Stratum is E2's portable data layer for geographic datasets. Discover, download, cache, query, and upload geographic data for local or cloud workflows without maintaining a traditional spatial database. It supports GeoJSON, CSV, Parquet, and SQLite and lets datasets be downloaded once and reused across applications and regions.

| Command family | Purpose |
| --- | --- |
| `stratum cache` | Manage verified local data. |
| `stratum features` / `areas` | Look up built-in inputs. |
| `stratum data` | Inspect published data. |
| `stratum download` / `query` | Pull and query Cloud or local data. |
| `stratum upload` | Add namespaced local data. |

```bash
earth stratum areas search "New York" --json
earth stratum download restaurant --area-id 4915 --out ./restaurants.parquet
earth stratum upload ./stores.geojson --db ./stores.db --feature stores --namespace my-app --json
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

[SDK package](https://www.npmjs.com/package/@embedearth/sdk) · [MCP package](https://www.npmjs.com/package/@embedearth/mcp) · [Full CLI docs](https://embed.earth/docs/cli)
