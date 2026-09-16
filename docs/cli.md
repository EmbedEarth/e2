# EmbedEarth CLI

EmbedEarth is an open, programmable geographic layer for physical-world data. The `earth` CLI exposes the same Search, Compute, Routing, Maps, and Stratum capabilities for terminals, scripts, and automation.

## Modes

| Mode | Purpose |
| --- | --- |
| `auto` | Use verified local Stratum data when available, then run the function in Cloud. |
| `offline` | Use only verified local data and make no network request. |
| `cloud` | Run the function in EmbedEarth Cloud; an API key is optional, but unauthenticated use is heavily limited. |

## API key and limits

An API key is optional. Cloud Search, Compute, and Route requests are limited to 60 requests per minute without a key, or 2,000 requests per minute with a key. `stratum query` without a key should be treated as one request per second. A key is also required for Street View image access. Set `E2_API_KEY` from [embed.earth](https://embed.earth).

```powershell
$env:E2_API_KEY = "your_api_key"
```

## Search

Search returns a GeoJSON `FeatureCollection` for one or more feature keys or IDs. Use `--area` for a named area, `--area-id` for an exact raw area ID, coordinates when supported by the command, and `--country-code` or `--state-code` for code-based area selection.

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

Compute measures spatial relationships and aggregates instead of returning raw records. `features` names what is measured, `--area` or `--area-id` scopes the calculation, and `--near` or `--within` supplies a related feature when the primitive needs one.

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

```bash
earth compute count restaurant --area-id 4915 --near park --distance 500 --mode cloud --json
earth compute density restaurant --area "New York" --near park --distance 500 --mode auto --json
earth compute count restaurant --mode cloud --json
```

## Routing

Routing builds directions and network-analysis responses from coordinates or indexed features. `to-feature` routes from a coordinate to the closest matching feature; the other commands cover direct routes, matrices, isochrones, map matching, and raw compatible requests.

Set `ROUTE_URL` only when you want a custom compatible routing service.

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

Maps prepares MapLibre-ready source descriptors for the Planet basemap and published feature layers. It does not render a terminal map.

```bash
earth map sources restaurant hospital --json
```

## Stratum

Stratum provides geographical lookup, published data discovery, verified local caching, downloads, local queries, and namespaced uploads. Use it when a workflow needs repeatable local data or needs to add its own GeoJSON, CSV, or Parquet features.

| Command family | Purpose |
| --- | --- |
| `stratum cache` | Set limits and list, delete, or clear verified local data. |
| `stratum features` | Look up built-in geographical features. |
| `stratum areas` | Look up built-in geographical areas. |
| `stratum data` | Inspect published data. |
| `stratum download` | Pull a Stratum to cache or a file. |
| `stratum query` | Query Cloud data or a verified local copy. |
| `stratum upload` | Add local GeoJSON, CSV, or Parquet data. |

```bash
earth stratum areas search "New York" --json
earth stratum download restaurant --area-id 4915 --out ./restaurants.parquet
earth stratum upload ./stores.geojson --db ./stores.db --feature stores --namespace my-app --json
```

## Geographical Features

Geographical features are the canonical physical-world types accepted by Search, Compute, Routing, Maps, and Stratum. They include places, infrastructure, observations, and imagery-linked datasets.

Browse the catalog at [Catalog Features](https://www.embed.earth/catalog/features).

## Geographical Areas

Geographical areas are countries, states, cities, and other regions used to scope data. Use names for convenience or exact IDs for stable automation.

Browse the catalog at [Catalog Areas](https://www.embed.earth/catalog/areas).

## Street View Images

EmbedEarth ingests billions of Street View images and discovers new features or relationships where imagery pairs with reported places. Street View is Cloud-only for now because of retrieval cost; use an API key and an active subscription for unlimited access.

## Other interfaces

[SDK](sdk.md) · [MCP](mcp.md)
