import { DatasetClient } from "./DatasetClient.js";
import { CacheClient } from "./CacheClient.js";
import { FeatureClient } from "./FeatureClient.js";
import { RegionClient } from "./RegionClient.js";
import { SnapshotQueryClient, snapshotGeoJSON, type SnapshotMode, type SnapshotQuery, type SnapshotResult } from "./SnapshotQueryClient.js";
import { StorageClient, type StorageUploadOptions, type StorageUploadResult } from "./StorageClient.js";
import type { SearchExecutor } from "./SearchClient.js";
import type { PublishedSnapshot } from "@embedearth/datasets";

export interface StratumOptions {
  cacheDirectory?: string;
  stratumApiUrl?: string;
}

export type StratumMode = SnapshotMode;
export type StratumQuery = SnapshotQuery;
export type StratumResult = SnapshotResult;

export function stratumGeoJSON(result: StratumResult): { type: "FeatureCollection"; features: unknown[] } {
  return snapshotGeoJSON(result);
}

/**
 * Node-only access to published E2 strata: cached server data, local queries,
 * downloads, and user-owned uploads.
 */
export class StratumClient {
  readonly cache: CacheClient;
  /** Built-in geographic feature lookup. */
  readonly features = new FeatureClient();
  /** Built-in geographic area lookup. */
  readonly areas = new RegionClient();
  readonly datasets: DatasetClient;
  readonly storage = new StorageClient();
  readonly #queryClient: SnapshotQueryClient;

  constructor(options: StratumOptions = {}) {
    this.cache = new CacheClient(options.cacheDirectory);
    this.datasets = new DatasetClient(this.features, options.stratumApiUrl);
    this.#queryClient = new SnapshotQueryClient(this.datasets, this.cache);
  }

  /** Internal search adapter used by the Node E2 client. */
  get executor(): SearchExecutor {
    return this.#queryClient;
  }

  list(signal?: AbortSignal): Promise<PublishedSnapshot[]> {
    return this.datasets.listSnapshots(signal);
  }

  download(options: { feature: string | number; regionId?: string | null; year?: string | number | null; output?: string; cacheDirectory?: string; signal?: AbortSignal }): Promise<string> {
    return this.#queryClient.download(options);
  }

  query(options: SnapshotQuery): Promise<SnapshotResult> {
    return this.#queryClient.query(options);
  }

  upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
    return this.storage.upload(options);
  }
}

/** Create a Node-only Stratum client without first constructing E2. */
export function stratum(options: StratumOptions = {}): StratumClient {
  return new StratumClient(options);
}
