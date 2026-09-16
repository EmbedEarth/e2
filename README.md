# EmbedEarth

### Open, programmable geography for applications and AI agents.

EmbedEarth (E2) is an open, programmable geographic engine for the physical world. Search places and real-world features, run spatial computations, build routes, render maps, and work with geographic datasets through one SDK.

E2 is built as an open alternative to Google Maps Platform, bringing together capabilities commonly spread across Maps, Places, Routes, Geocoding, Autocomplete, and Street View — while adding spatial computation, open geographic data, and local execution.

[Get started](docs/quickstart.md) · [Documentation](docs/README.md) · [Examples](examples/README.md)

> EmbedEarth is an early developer foundation. The API surface, hosted services, and open-source boundary are still being shaped.

## Packages

| Package | Install | npm |
| --- | --- | --- |
| SDK | `npm install @embedearth/sdk` | [@embedearth/sdk](https://www.npmjs.com/package/@embedearth/sdk) |
| CLI | `npm install -g @embedearth/cli` | [@embedearth/cli](https://www.npmjs.com/package/@embedearth/cli) |
| MCP | `npx -y @embedearth/mcp` | [@embedearth/mcp](https://www.npmjs.com/package/@embedearth/mcp) |

## Modes

E2 can run locally or in the cloud. Local datasets are downloaded once per region and reused for future requests, so the same data does not need to be fetched again.

| Mode | Purpose |
| --- | --- |
| `auto` | Use local data when available, otherwise cloud. |
| `offline` | Download once, then reuse locally. |
| `cloud` | Cloud execution with unlimited use using an API key. |

## Why E2

Traditional mapping APIs are built primarily around maps, places, and directions. E2 makes the broader physical world programmable.

- **Search** places, infrastructure, observations, nature, civic data, and other real-world features.
- **Compute** distance, proximity, counts, density, coverage, gaps, and other spatial relationships.
- **Map** basemaps, features, routes, and application data.
- **Route** between coordinates or directly to real-world features.
- **Stratum** geographic datasets for local, offline, and cloud workflows.
- Access **street-level imagery** and visual observations tied to geographic locations.

For developers coming from Google Maps Platform, E2 can replace many common workflows built around Maps, Places, Routes, Geocoding, Autocomplete, and street-level imagery while giving applications direct access to broader geographic datasets and spatial computation.

## Try it

The repository includes a TypeScript SDK, CLI, MCP server, Stratum local-data workflows, and spatial compute primitives.

```bash
pnpm install
pnpm build
pnpm --filter @embedearth/cli exec earth search restaurant --area Brooklyn
```

From TypeScript:

```ts
import { E2 } from "@embedearth/sdk";

const earth = new E2({ apiKey: process.env.E2_API_KEY });
const results = await earth.search({
  feature: ["restaurant"],
  area: ["Brooklyn"],
  mode: "auto",
});
```

## Six core areas

### Search

Search the physical world by feature, place, region, or coordinates. Query places, infrastructure, observations, natural features, civic data, and other geographic datasets through one interface. Results are returned as GeoJSON and can be passed directly into Compute, Map, or Route.

```ts
await earth.search({ feature: ["restaurant"], area: ["New York"], mode: "auto" });
```

### Compute

Run spatial analysis directly against geographic features. Find what is nearest, measure distance, count features, calculate density and coverage, detect gaps, or cluster nearby objects — turning geographic data into answers without a separate GIS stack.

```ts
await earth.compute.feature("restaurant").area("New York").near("park", 500).count();
```

### Map

Render E2 data using MapLibre-compatible maps and PMTiles. Load the global basemap alongside feature layers, Search results, routes, and your own geographic data, while your application keeps control over styling and interaction.

```ts
const sources = await earth.map.sources(["restaurant"]);
```

### Route

Calculate movement through the physical world. Build routes, travel-time matrices, isochrones, map matches, elevation queries, and network-aware searches from coordinates or E2 features — so applications can route to things rather than only fixed coordinates.

```bash
earth route to-feature restaurant --from "40.7128,-74.006" --mode walking --json
```

### Stratum

E2's portable data layer for geographic datasets. Discover, download, cache, query, and upload geographic data for local, offline, and cloud workflows without maintaining a traditional spatial database. Supports GeoJSON, CSV, Parquet, and SQLite.

```bash
earth stratum download restaurant --area-id 4915 --out ./restaurants.parquet
```

### Street-level Imagery

EmbedEarth processes billions of street-level images to connect visual observations with geographic features and places. Imagery adds visual context to locations and can surface physical-world features that may not appear in conventional place databases. Street-level imagery is cloud-based and requires an API key and active plan.

## Cloud and API keys

E2 can run locally or in the cloud. Local datasets are downloaded once per region and reused for future requests, so the same data does not need to be fetched again. Cloud use is available without a key at limited rates; add an API key from [embed.earth](https://embed.earth) for full cloud access and street-level imagery.

## Replace Google Maps Platform

| Google Maps Platform | EmbedEarth |
| --- | --- |
| Maps | MapLibre-based maps and PMTiles sources |
| Places API | Feature and place search |
| Places Autocomplete | Coming Soon |
| Geocoding API | Coming Soon |
| Routes API | Hosted or self-managed routing |
| Street View API | Street-level imagery and visual observations |
| Insights API | Spatial compute: nearest, distance, count, density, coverage, gaps, and clusters |

## Go beyond maps

Use the same interfaces for data that traditional mapping APIs do not expose:

- Earth Search across records, infrastructure, incidents, permits, and observations
- Spatial compute: nearest, distance, within, count, density, coverage, gaps, and clusters
- Local-first querying over user-owned GeoJSON, CSV, Parquet, and SQLite data
- MCP tools for Claude, Codex, and other AI agents
- Dataset manifests and Stratum-aware map sources

## Regions

To see which regions E2 covers — countries, states, cities, and other geographic areas with stable IDs — browse the Area catalog at [embed.earth/catalog/areas](https://www.embed.earth/catalog/areas).

## Features

To see which features E2 covers — places, infrastructure, observations, natural features, civic data, and other real-world features — browse the Feature catalog at [embed.earth/catalog/features](https://www.embed.earth/catalog/features).

## Interfaces

| Interface | Package | Use it for |
| --- | --- | --- |
| SDK | `@embedearth/sdk` | JavaScript/TypeScript applications |
| CLI | `@embedearth/cli` | Shell workflows and automation |
| MCP | `@embedearth/mcp` | Agent access to geographic tools |
| Map client | `@embedearth/sdk/map` | MapLibre rendering and data layers |

```bash
earth route run --locations "40.748,-73.985;40.641,-73.778" --mode driving
earth compute count restaurant --area Manhattan
earth search pothole --area Manhattan --json
```

## Repository layout

```text
packages/sdk/             JavaScript/TypeScript SDK and map client
packages/cli/             earth command-line interface
packages/mcp/             MCP server for AI agents
packages/core/             Internal geometry, time, and validation primitives
packages/datasets/         Stratum and dataset manifests
packages/registry/         Feature catalog
packages/regions/          Region catalog and lookup
packages/storage-sqlite/   Local dataset indexing and queries
examples/                  Focused integration examples
docs/                      Product and API documentation
schemas/                   Public data contracts
datasets/                  Dataset registry and provenance notes
```

## Open-source boundary

The repository is intended to open-source the SDK, CLI, MCP server, schemas, examples, and selected data tooling. Hosted global search, continuously updated datasets, managed indexing, and large-scale visual search may remain EmbedEarth-managed services. See [the boundary notes](docs/architecture.md#open-source-boundary) as the product evolves.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contribution paths. Good first contributions include a dataset adapter, a CLI output format, a Python or DuckDB example, an MCP tool, or documentation improvements.

## Status

EmbedEarth v0.1 is the first public release. The roadmap is intentionally broad; API names and hosted endpoints may still change.

Licensed under Apache-2.0. See [LICENSE](LICENSE) and [SECURITY.md](SECURITY.md).
