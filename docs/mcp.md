# EmbedEarth MCP server

EmbedEarth is an open, programmable geographic layer for physical-world data. The MCP server gives AI agents the same Search, Compute, Routing, Maps, and Stratum capabilities through structured tools.

## Modes

| Mode | Purpose |
| --- | --- |
| `auto` | Use verified local Stratum data when available, then run the function in Cloud. |
| `offline` | Use only verified local data and make no network request. |
| `cloud` | Run the function in EmbedEarth Cloud; an API key is optional, but unauthenticated use is heavily limited. |

## API key and limits

An API key is optional. Cloud Search, Compute, and Route requests are limited to 60 requests per minute without a key, or 2,000 requests per minute with a key. `e2_stratum` `query` without a key should be treated as one request per second. A key is also required for Street View image access. Configure `E2_API_KEY` from [embed.earth](https://embed.earth).

## Search

`e2_search` returns matching physical-world records as a GeoJSON `FeatureCollection`. Put feature keys or IDs in `feature`; use `area` for a name, `area_id` for an exact ID, coordinates for a point-centered lookup, or country/state codes for code-based area selection.

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
{ "feature": "restaurant", "latitude": 40.7128, "longitude": -74.006, "mode": "cloud", "limit": 25 }
```

```json
{ "feature": "restaurant", "country_code": "US", "state_code": "NY", "mode": "cloud", "limit": 25 }
```

## Compute

`e2_compute` runs spatial relationships and aggregates rather than returning raw matching records. `feature` is what is measured, `area` or `area_id` is the scope, and `near` or `within` names a related feature when required by the primitive.

| Primitive | Purpose |
| --- | --- |
| `NEAREST` | Find the closest selected feature or features. |
| `DISTANCE` | Measure distance between feature sets. |
| `WITHIN` | Select features inside a relation distance. |
| `COUNT` | Count features that meet a relation. |
| `DENSITY` | Measure feature concentration. |
| `COVERAGE` | Measure the area reached by a relation. |
| `GAPS` | Find areas not reached by coverage. |
| `CLUSTER` | Group nearby features into spatial clusters. |

```json
{ "primitive": "COUNT", "feature": ["restaurant"], "area_id": "4915", "near": "park", "distanceMeters": 500, "mode": "cloud" }
```

```json
{ "primitive": "DENSITY", "feature": ["restaurant"], "area": "New York", "near": "park", "distanceMeters": 500, "mode": "auto" }
```

```json
{ "primitive": "COUNT", "feature": ["restaurant"], "latitude": 40.7128, "longitude": -74.006, "mode": "cloud" }
```

## Routing

Routing builds directions and network-analysis responses from coordinates or indexed features. Use `e2_route_to_feature` for a coordinate-to-feature route, and `e2_route` for direct routes, matrices, isochrones, map matching, locate, and height operations.

Set `ROUTE_URL` only when you want a custom compatible routing service.

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

`e2_map_sources` prepares MapLibre-ready Planet and feature source descriptors. It returns source metadata for a map client rather than rendering a map inside the agent conversation.

## Stratum

`e2_stratum` combines geographical lookup, published data discovery, verified local caching, downloads, local queries, and namespaced uploads. It is the tool to use when an agent needs repeatable local data or must add user-owned GeoJSON, CSV, or Parquet features.

| Operation | Purpose |
| --- | --- |
| `cacheList`, `cacheSet`, `cacheDelete`, `cacheClear` | Manage verified local data and its size limit. |
| `featureList`, `featureSearch`, `featureInfo` | Look up built-in geographical features. |
| `areaList`, `areaSearch`, `areaInfo` | Look up built-in geographical areas. |
| `dataList`, `dataInfo` | Inspect published data. |
| `download` | Pull a Stratum to a local file or cache. |
| `query` | Query Cloud data or a verified local copy. |
| `upload` | Add local GeoJSON, CSV, or Parquet data. |

```json
{ "operation": "upload", "path": "./stores.geojson", "database": "./stores.db", "feature": "stores", "namespace": "my-app" }
```

## Geographical Features

Geographical features are the canonical physical-world types accepted by Search, Compute, Routing, Maps, and Stratum. They include places, infrastructure, observations, and imagery-linked datasets.

Browse the catalog at [Catalog Features](https://www.embed.earth/catalog/features).

## Geographical Areas

Geographical areas are countries, states, cities, and other regions used to scope data. Agents can use names for convenience or exact IDs for stable automation.

Browse the catalog at [Catalog Areas](https://www.embed.earth/catalog/areas).

## Street View Images

EmbedEarth ingests billions of Street View images and discovers new features or relationships where imagery pairs with reported places. Street View is Cloud-only for now because of retrieval cost; an API key and an active subscription are required for unlimited access.

## Other interfaces

[SDK](sdk.md) · [CLI](cli.md)
