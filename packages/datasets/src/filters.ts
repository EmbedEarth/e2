import type { DatasetManifest } from "./manifest.js";
export function selectDataset(datasets: DatasetManifest[], feature: string | number): DatasetManifest { const match = datasets.find((item) => typeof feature === "number" ? item.featureId === feature : item.feature === feature.toLowerCase().replace(/s$/, "")); if (!match) throw new Error(`Unknown dataset: ${feature}`); return match; }
export function matchesRegion(row: Record<string, unknown>, regionId: string): boolean { return row.city_region_id === regionId || row.state_region_id === regionId || row.country_region_id === regionId; }
