#!/usr/bin/env node
import { Command } from "commander";
import { DEFAULT_ROUTE_URL, E2, LocalDatabase, stratumGeoJSON } from "@embedearth/sdk/node";
import type { ComputePrimitive, RouteLocation } from "@embedearth/sdk";
import { print } from "./utils/output.js";
import { fail } from "./utils/errors.js";

const e2 = new E2({
  apiKey: process.env.E2_API_KEY,
  routeUrl: process.env.ROUTE_URL ?? DEFAULT_ROUTE_URL,
});
const program = new Command().name("earth").description("EmbedEarth search, compute, routing, maps, and Stratum").version("0.1.12").option("--json", "JSON output");
const json = () => Boolean(program.opts().json);
const collect = (value: string, values: string[]) => [...values, value];
const locations = (value?: string): RouteLocation[] => {
  if (!value) throw new Error("Provide locations as lat,lng;lat,lng");
  return value.split(";").map((item) => {
    const [lat, lon] = item.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Locations must be lat,lng;lat,lng");
    return { lat, lon };
  });
};
const featureValue = (value: string): string | number => /^\d+$/u.test(value) ? Number(value) : value;

const search = program.command("search").description("Search one or more features and areas; returns GeoJSON");
search.argument("[features...]", "feature keys or ids").option("--feature <feature>", "feature key or id (repeatable)", collect, []).option("--area <area>", "named area (repeatable)", collect, []).option("--area-id <id>", "exact area ID (repeatable)", collect, []).option("--country-code <code>", "country code, for example US").option("--state-code <code>", "state or province code, for example NY").option("--latitude <degrees>", "latitude for a point-centered search").option("--longitude <degrees>", "longitude for a point-centered search").option("--mode <mode>", "cloud, offline, or auto", "auto").option("--limit <number>", "maximum features", "1000").action(async (features: string[], options) => {
  const selected = [...features, ...options.feature];
  if (!selected.length) throw new Error("Search requires one or more features");
  print(await e2.search({ feature: selected, area: options.area, area_id: options.areaId, country_code: options.countryCode, state_code: options.stateCode, latitude: options.latitude === undefined ? undefined : Number(options.latitude), longitude: options.longitude === undefined ? undefined : Number(options.longitude), mode: options.mode, limit: Number(options.limit) }), true);
});

const stratum = program.command("stratum").description("Pull published E2 strata, manage the local cache, query, and upload local data");
const stratumCache = stratum.command("cache").description("Manage the local Stratum cache");
stratumCache.command("set <size>").description("Set the cache limit; minimum 1GB").action(async (size) => print(await e2.stratum.cache.setLimit(size), true));
stratumCache.command("list").action(async () => print(await e2.stratum.cache.list(), true));
stratumCache.command("delete <key>").alias("remove").action(async (key) => print({ deleted: await e2.stratum.cache.remove(key) }, true));
stratumCache.command("clear").action(async () => print({ deleted: await e2.stratum.cache.clear() }, true));
stratum.command("download <feature>").requiredOption("--out <path>").option("--area <name>").option("--area-id <id>").action(async (feature, options) => {
  if (options.area && options.areaId) throw new Error("Use --area or --area-id, not both");
  const regionId = options.areaId ?? (options.area ? e2.regions.resolve(options.area).id : null);
  console.log(await e2.stratum.download({ feature: featureValue(feature), regionId, output: options.out }));
});
stratum.command("query <feature>").option("--area <name>").option("--area-id <id>").option("--mode <mode>", "cloud, offline, or auto", "auto").option("--limit <number>", "maximum features", "1000").action(async (feature, options) => {
  if (options.area && options.areaId) throw new Error("Use --area or --area-id, not both");
  const regionId = options.areaId ?? (options.area ? e2.regions.resolve(options.area).id : null);
  print(stratumGeoJSON(await e2.stratum.query({ feature: featureValue(feature), regionId, mode: options.mode, limit: Number(options.limit) })), true);
});
stratum.command("upload <path>").requiredOption("--db <path>").option("--feature <feature>", "built-in feature key or local feature name").option("--namespace <name>", "local-only feature namespace").option("--connect-to <feature>", "existing feature to attach feature_id to").option("--feature-id <number>").option("--out <path>").option("--area-id <id>").action(async (path, options) => print(await e2.stratum.upload({ path, database: options.db, feature: options.feature, namespace: options.namespace, connectTo: options.connectTo, featureId: options.featureId ? Number(options.featureId) : undefined, output: options.out, region: options.areaId }), true));
const stratumFeatures = stratum.command("features").description("Look up built-in geographic features");
stratumFeatures.command("list").action(() => print(e2.stratum.features.list(), json()));
stratumFeatures.command("search <query>").action((query) => print(e2.stratum.features.search(query), json()));
stratumFeatures.command("info <id>").action((id) => print(e2.stratum.features.get(featureValue(id)) ?? { error: "Feature not found" }, true));
const stratumAreas = stratum.command("areas").description("Look up built-in geographic areas");
stratumAreas.command("list").action(() => print(e2.stratum.areas.list(), json()));
stratumAreas.command("search <query>").action((query) => print(e2.stratum.areas.search(query), json()));
stratumAreas.command("info <id>").action((id) => print(e2.stratum.areas.get(id) ?? { error: "Area not found" }, true));
const stratumData = stratum.command("data").description("List published E2 data");
stratumData.command("list").action(() => print(e2.stratum.datasets.list(), json()));
stratumData.command("info <feature>").action((feature) => print(e2.stratum.datasets.info(featureValue(feature)), true));

const route = program.command("route").description("Run routing and network analysis");
route.command("run").requiredOption("--locations <lat,lng;lat,lng>").option("--mode <mode>", "driving, walking, cycling, or multimodal", "driving").option("--body <json>").action(async (options) => print(await e2.route.route({ ...(options.body ? JSON.parse(options.body) : {}), locations: locations(options.locations), mode: options.mode }), true));
route.command("matrix").requiredOption("--sources <locations>").requiredOption("--targets <locations>").option("--mode <mode>", "driving", "driving").option("--body <json>").action(async (options) => print(await e2.route.matrix({ ...(options.body ? JSON.parse(options.body) : {}), sources: locations(options.sources), targets: locations(options.targets), mode: options.mode }), true));
route.command("isochrone").requiredOption("--locations <locations>").option("--mode <mode>", "driving", "driving").option("--contours <minutes>", "comma-separated minutes", "5,10,15").option("--body <json>").action(async (options) => print(await e2.route.isochrone({ ...(options.body ? JSON.parse(options.body) : {}), locations: locations(options.locations), mode: options.mode, contours: options.contours.split(",").map((time: string) => ({ time: Number(time) })) }), true));
route.command("map-match").requiredOption("--shape <locations>").option("--mode <mode>", "driving", "driving").option("--body <json>").action(async (options) => print(await e2.route.mapMatch({ ...(options.body ? JSON.parse(options.body) : {}), shape: locations(options.shape), mode: options.mode }), true));
route.command("to-feature <feature>").requiredOption("--from <lat,lng>").option("--area <area>").option("--area-id <id>").option("--mode <mode>", "driving", "driving").option("--body <json>").action(async (feature, options) => {
  const query = e2.route.feature(feature).from(locations(options.from)[0]!);
  if (options.area && options.areaId) throw new Error("Use --area or --area-id, not both");
  if (options.areaId) query.areaId(options.areaId);
  else if (options.area) query.area(options.area);
  print(await query.nearest({ ...(options.body ? JSON.parse(options.body) : {}), mode: options.mode }), true);
});
route.command("request <endpoint>").requiredOption("--body <json>").action(async (endpoint, options) => print(await e2.route.request(endpoint, JSON.parse(options.body)), true));

const compute = program.command("compute").description("Run cloud, cached, or local spatial compute primitives");
const primitives: ComputePrimitive[] = ["NEAREST", "DISTANCE", "WITHIN", "COUNT", "DENSITY", "COVERAGE", "GAPS", "CLUSTER"];
for (const primitive of primitives) {
  compute.command(`${primitive.toLowerCase()} <features...>`).option("--db <path>", "optional local SQLite database").option("--mode <mode>", "cloud, offline, or auto", "auto").option("--area <area>").option("--area-id <id>").option("--near <feature>").option("--within <feature>").option("--distance <meters>", "relation radius", "500").option("--limit <number>", "maximum result rows", "1000").action(async (features: string[], options) => {
    const database = options.db ? await LocalDatabase.open(options.db) : undefined;
    try {
      const client = new E2(database ? { compute: database } : {});
      const query = client.compute.feature(features.map(featureValue));
      if (options.areaId) query.areaId(options.areaId);
      else if (options.area) query.area(options.area);
      const relation = options.near ?? options.within;
      if (relation) (options.within ? query.within : query.near)(featureValue(relation), Number(options.distance));
      query.limit(Number(options.limit));
      query.mode(options.mode);
      print(await query.run(primitive), true);
    } finally { database?.close(); }
  });
}
compute.command("compare").option("--features <features>", "two comma-separated feature keys or IDs").option("--feature <feature>", "feature key or ID", collect, []).option("--areas <areas>", "two comma-separated area names").option("--area <area>", "area name", collect, []).option("--area-ids <ids>", "two comma-separated exact area IDs").option("--area-id <id>", "exact area ID for a feature comparison").option("--primitive <primitive>", "comparison primitive", "COUNT").option("--mode <mode>", "cloud, offline, or auto", "auto").option("--db <path>", "optional local SQLite database").action(async (options) => {
  const features = [...options.feature, ...(options.features ? options.features.split(",").filter(Boolean) : [])];
  const areas = [...options.area, ...(options.areas ? options.areas.split(",").filter(Boolean) : [])];
  const areaIds = options.areaIds ? options.areaIds.split(",").filter(Boolean) : undefined;
  const database = options.db ? await LocalDatabase.open(options.db) : undefined;
  try {
    const client = new E2(database ? { compute: database } : {});
    const request = features.length === 2
      ? { features: features as [string, string], area: areas[0], area_id: options.areaId, primitive: options.primitive, mode: options.mode }
      : areaIds?.length === 2
        ? { feature: features[0], area_ids: areaIds as [string, string], primitive: options.primitive, mode: options.mode }
        : { feature: features[0], areas: areas as [string, string], primitive: options.primitive, mode: options.mode };
    if (features.length !== 2 && areas.length !== 2 && areaIds?.length !== 2) throw new Error("Compare requires two features or one feature and two areas");
    print(await client.compute.compare(request), true);
  } finally { database?.close(); }
});

const map = program.command("map").description("Prepare MapLibre sources from Planet and published E2 PMTiles");
map.command("sources [features...]").option("--feature <feature>", "feature key or id (repeatable)", collect, []).action(async (features: string[], options) => {
  const selected = [...features, ...options.feature];
  print(await e2.map.sources(selected.map(featureValue)), true);
});
program.parseAsync().catch(fail);
