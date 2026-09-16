import { writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalDatabase } from "./LocalDatabase.js";
import { DatasetClient } from "./DatasetClient.js";
export { E2 } from "./NodeE2.js";
export type { NodeE2Options } from "./NodeE2.js";
export { StratumClient, stratum, stratumGeoJSON } from "./StratumClient.js";
export type { StratumOptions, StratumMode, StratumQuery, StratumResult } from "./StratumClient.js";
export { MIN_CACHE_BYTES, DEFAULT_CACHE_DIRECTORY, parseCacheSize } from "./CacheClient.js";
export type { CacheEntry, CacheInfo } from "./CacheClient.js";
export { DEFAULT_ROUTE_URL, RouteClient } from "./RouteClient.js";
export { StorageClient, convertToGeoParquet } from "./StorageClient.js";
export type { StorageUploadOptions, StorageUploadResult } from "./StorageClient.js";
export { LocalDatabase };
export async function downloadToFile(feature: string | number, output: string, regionId?: string | null): Promise<void> { const bytes = await new DatasetClient().download({ feature, regionId }); await writeFile(output, bytes); }
export async function importPublishedDataset(database: LocalDatabase, feature: string | number, region?: string): Promise<number> { const directory = await mkdtemp(join(tmpdir(), "e2-import-")); const path = join(directory, "data.parquet"); try { await downloadToFile(feature, path, region); return await database.importFile(path); } finally { await rm(directory, { recursive: true, force: true }); } }

export * from "./index.js";
