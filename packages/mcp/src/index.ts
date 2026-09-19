#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DEFAULT_ROUTE_URL, E2, LocalDatabase, stratumGeoJSON } from "@embedearth/sdk/node";

const e2 = new E2({
  apiKey: process.env.E2_API_KEY,
  routeUrl: process.env.ROUTE_URL ?? DEFAULT_ROUTE_URL,
});
const server = new McpServer({ name: "e2", version: "0.2.0" });
const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const feature = z.union([z.string(), z.number()]);

server.registerTool("e2_search", {
  title: "Search Earth features",
  description: "Search one or more features and named areas. Returns a GeoJSON FeatureCollection. Optional year narrows year-split snapshots; year-split features (anything not osm/visual) default to the newest year (2026, then 2025, ...). Internal c_id/s_id/r_id/p_id and h3 columns are removed from results.",
  inputSchema: {
    feature: z.union([feature, z.array(feature).min(1)]), area: z.union([z.string(), z.array(z.string()).min(1)]).optional(), area_id: z.union([z.string(), z.array(z.string()).min(1)]).optional(), country_code: z.string().min(1).optional(), state_code: z.string().min(1).optional(), year: z.union([z.string(), z.number()]).optional().describe("Optional snapshot year, for example 2026"), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(),
    mode: z.enum(["cloud", "offline", "auto"]).default("auto"), limit: z.number().int().min(1).max(100000).default(1000),
  },
}, async (args) => ok(await e2.search(args)));

server.registerTool("e2_stratum", {
  title: "Manage EmbedEarth Stratum data",
  description: "Manage the verified local cache, pull published Stratum data, query it locally or from the server, and upload local GeoJSON, CSV, or Parquet. Optional year narrows year-split snapshots; year-split features default to the newest year (2026, then 2025, ...).",
  inputSchema: {
    operation: z.enum(["cacheList", "cacheSet", "cacheDelete", "cacheClear", "download", "query", "upload", "featureList", "featureSearch", "featureInfo", "areaList", "areaSearch", "areaInfo", "dataList", "dataInfo"]),
    size: z.union([z.string(), z.number()]).optional(), key: z.string().optional(),
    feature: feature.optional(), area_id: z.string().optional(), output: z.string().optional(),
    year: z.union([z.string(), z.number()]).optional().describe("Optional snapshot year, for example 2026"),
    mode: z.enum(["cloud", "offline", "auto"]).default("auto"), limit: z.number().int().min(1).max(100000).default(1000),
    path: z.string().optional(), database: z.string().optional(), connectTo: feature.optional(), featureId: z.number().int().positive().optional(), namespace: z.string().optional(), query: z.string().optional(), id: z.string().optional(),
  },
}, async (args) => {
  if (args.operation === "cacheList") return ok(await e2.stratum.cache.list());
  if (args.operation === "cacheSet") { if (args.size === undefined) throw new Error("size is required for cacheSet"); return ok(await e2.stratum.cache.setLimit(args.size)); }
  if (args.operation === "cacheDelete") { if (!args.key) throw new Error("key is required for cacheDelete"); return ok({ deleted: await e2.stratum.cache.remove(args.key) }); }
  if (args.operation === "cacheClear") return ok({ deleted: await e2.stratum.cache.clear() });
  if (args.operation === "download") {
    if (args.feature === undefined) throw new Error("feature is required for download");
    return ok({ path: await e2.stratum.download({ feature: args.feature, regionId: args.area_id ?? null, ...(args.year !== undefined ? { year: args.year } : {}), output: args.output }) });
  }
  if (args.operation === "query") {
    if (args.feature === undefined) throw new Error("feature is required for query");
    return ok(stratumGeoJSON(await e2.stratum.query({ feature: args.feature, regionId: args.area_id ?? null, ...(args.year !== undefined ? { year: args.year } : {}), mode: args.mode, limit: args.limit })));
  }
  if (args.operation === "featureList") return ok(e2.stratum.features.list());
  if (args.operation === "featureSearch") { if (!args.query) throw new Error("query is required for featureSearch"); return ok(e2.stratum.features.search(args.query)); }
  if (args.operation === "featureInfo") { if (args.feature === undefined) throw new Error("feature is required for featureInfo"); return ok(e2.stratum.features.get(args.feature) ?? { error: "Feature not found" }); }
  if (args.operation === "areaList") return ok(e2.stratum.areas.list());
  if (args.operation === "areaSearch") { if (!args.query) throw new Error("query is required for areaSearch"); return ok(e2.stratum.areas.search(args.query)); }
  if (args.operation === "areaInfo") { if (!args.id) throw new Error("id is required for areaInfo"); return ok(e2.stratum.areas.get(args.id) ?? { error: "Area not found" }); }
  if (args.operation === "dataList") return ok(e2.stratum.datasets.list());
  if (args.operation === "dataInfo") { if (args.feature === undefined) throw new Error("feature is required for dataInfo"); return ok(e2.stratum.datasets.info(args.feature)); }
  if (!args.path || !args.database) throw new Error("path and database are required for upload");
  return ok(await e2.stratum.upload({ path: args.path, database: args.database, feature: args.feature, namespace: args.namespace, connectTo: args.connectTo, featureId: args.featureId, output: args.output, region: args.area_id }));
});

server.registerTool("e2_route", {
  title: "Route",
  description: "Run route, matrix, isochrone, map matching, locate, height, or another endpoint.",
  inputSchema: { operation: z.enum(["route", "matrix", "isochrone", "mapMatch", "locate", "height"]), body: z.record(z.unknown()) },
}, async ({ operation, body }) => {
  const route = e2.route;
  if (operation === "route") return ok(await route.route(body as never));
  if (operation === "matrix") return ok(await route.matrix(body as never));
  if (operation === "isochrone") return ok(await route.isochrone(body as never));
  if (operation === "mapMatch") return ok(await route.mapMatch(body as never));
  if (operation === "locate") return ok(await route.locate(body));
  return ok(await route.height(body));
});

server.registerTool("e2_route_to_feature", {
  title: "Route to a feature",
  description: "Find the nearest indexed feature and route to it.",
  inputSchema: { feature, from: z.tuple([z.number(), z.number()]), area: z.string().optional(), area_id: z.string().optional(), mode: z.enum(["driving", "walking", "cycling", "multimodal", "truck", "motorcycle", "motor_scooter", "bus", "taxi", "hov", "transit"]).default("driving"), body: z.record(z.unknown()).optional() },
}, async (args) => {
  const query = e2.route.feature(args.feature).from({ lat: args.from[0], lon: args.from[1] });
  if (args.area && args.area_id) throw new TypeError("Use area or area_id, not both");
  if (args.area_id) query.areaId(args.area_id);
  else if (args.area) query.area(args.area);
  return ok(await query.nearest({ ...(args.body ?? {}), mode: args.mode }));
});

server.registerTool("e2_compute", {
  title: "Compute over features",
  description: "Run NEAREST, DISTANCE, WITHIN, COUNT, DENSITY, COVERAGE, GAPS, or CLUSTER against cloud, cached, or local features. Optional year narrows year-split snapshots; year-split features default to the newest year (2026, then 2025, ...).",
  inputSchema: {
    database: z.string().optional(), mode: z.enum(["cloud", "offline", "auto"]).default("auto"), primitive: z.enum(["NEAREST", "DISTANCE", "WITHIN", "COUNT", "DENSITY", "COVERAGE", "GAPS", "CLUSTER"]),
    feature: z.array(feature).min(1), area: z.string().optional(), area_id: z.string().optional(), year: z.union([z.string(), z.number()]).optional().describe("Optional snapshot year, for example 2026"), near: feature.optional(), within: feature.optional(), distanceMeters: z.number().min(0).default(500), limit: z.number().int().min(1).max(100000).default(1000),
  },
}, async (args) => {
  const database = args.database ? await LocalDatabase.open(args.database) : undefined;
  try {
    const local = new E2(database ? { compute: database } : {});
    const query = local.compute.feature(args.feature);
    if (args.area_id) query.areaId(args.area_id);
    else if (args.area) query.area(args.area);
    if (args.near !== undefined) query.near(args.near, args.distanceMeters);
    if (args.within !== undefined) query.within(args.within, args.distanceMeters);
    query.limit(args.limit);
    query.mode(args.mode);
    if (args.year !== undefined) query.year(args.year);
    return ok(await query.run(args.primitive));
  } finally { database?.close(); }
});

server.registerTool("e2_compare", {
  title: "Compare features or areas",
  description: "Compare two features in one area or one feature across two areas using the compute backend. Optional year narrows year-split snapshots.",
  inputSchema: {
    database: z.string().optional(), mode: z.enum(["cloud", "offline", "auto"]).default("auto"), primitive: z.enum(["NEAREST", "DISTANCE", "WITHIN", "COUNT", "DENSITY", "COVERAGE", "GAPS", "CLUSTER"]).default("COUNT"),
    features: z.tuple([feature, feature]).optional(), feature: feature.optional(), areas: z.tuple([z.string(), z.string()]).optional(), area_ids: z.tuple([z.string(), z.string()]).optional(), area: z.string().optional(), area_id: z.string().optional(), year: z.union([z.string(), z.number()]).optional().describe("Optional snapshot year, for example 2026"),
  },
}, async (args) => {
  const database = args.database ? await LocalDatabase.open(args.database) : undefined;
  try {
    const local = new E2(database ? { compute: database } : {});
    return ok(await local.compute.compare({ features: args.features, feature: args.feature, areas: args.areas, area_ids: args.area_ids, area: args.area, area_id: args.area_id, primitive: args.primitive, mode: args.mode, ...(args.year !== undefined ? { year: args.year } : {}) }));
  } finally { database?.close(); }
});

server.registerTool("e2_map_sources", {
  title: "Resolve Map sources",
  description: "Return the Planet PMTiles basemap and the newest published E2 feature PMTiles sources available to the Map wrapper.",
  inputSchema: { features: z.array(feature).default([]) },
}, async ({ features }) => ok(await e2.map.sources(features)));

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error("e2 MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting e2 MCP server:", error);
  process.exit(1);
});
