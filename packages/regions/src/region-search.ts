import type { E2Region } from "./region-types.js";
export function searchRegions(regions: E2Region[], query: string): E2Region[] { const needle = query.trim().toLocaleLowerCase(); return regions.filter((region) => [region.name, region.displayName, region.regionType ?? "", region.countryCode ?? "", ...(region.aliases ?? [])].some((value) => value.toLocaleLowerCase().includes(needle))); }
