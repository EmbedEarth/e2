import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { searchRegions } from "./region-search.js";
import { AmbiguousRegionError, type E2Region } from "./region-types.js";

function loadRegions(): E2Region[] {
  const candidates = typeof __dirname === "string"
    ? [resolve(__dirname, "regions.json.gz"), resolve(__dirname, "../../../catalog/regions.json.gz"), resolve(process.cwd(), "catalog/regions.json.gz")]
    : [fileURLToPath(new URL("./regions.json.gz", import.meta.url)), fileURLToPath(new URL("../../../catalog/regions.json.gz", import.meta.url)), resolve(process.cwd(), "catalog/regions.json.gz")];
  const path = candidates.find((candidate) => {
    try { readFileSync(candidate); return true; } catch { return false; }
  });
  if (!path) throw new Error("Region catalog artifact not found");
  const document = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as { regions: E2Region[] };
  if (!Array.isArray(document.regions)) throw new TypeError("Invalid region catalog");
  return document.regions;
}

export class RegionCatalog {
  constructor(private readonly regions: E2Region[] = loadRegions()) {}
  list(): E2Region[] { return this.regions.map((region) => ({ ...region, aliases: [...(region.aliases ?? [])] })); }
  get(id: string): E2Region | undefined { return this.regions.find((region) => region.id === id || String(region.sourceId) === id); }
  search(query: string): E2Region[] { return searchRegions(this.regions, query); }
  resolve(value: string): E2Region { const direct = this.get(value); if (direct) return direct; const needle = value.trim().toLocaleLowerCase(); const exact = this.regions.filter((region) => [region.name, region.displayName, ...(region.aliases ?? [])].some((name) => name.toLocaleLowerCase() === needle)); if (exact.length > 1) throw new AmbiguousRegionError(exact); if (exact.length === 1) return exact[0]!; const matches = this.search(value); if (matches.length > 1) throw new AmbiguousRegionError(matches); if (matches.length === 0) throw new Error(`Unknown region: ${value}`); return matches[0]!; }
}
export const regions = new RegionCatalog();
