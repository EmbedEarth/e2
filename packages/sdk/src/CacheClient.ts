import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

export const MIN_CACHE_BYTES = 1_000_000_000;
export const DEFAULT_CACHE_DIRECTORY = join(homedir(), ".e2", "cache");

export interface CacheEntry {
  key: string;
  path: string;
  sizeBytes: number;
  lastUsedAt: string;
  snapshotId?: string;
  feature?: string;
  regionId?: string | null;
}

export interface CacheInfo {
  directory: string;
  limitBytes: number;
  usedBytes: number;
  entries: CacheEntry[];
}

interface CacheState {
  limitBytes: number;
  entries: Record<string, CacheEntry>;
}

export function parseCacheSize(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Cache size must be finite");
    return Math.floor(value);
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|kib|mib|gib|tib)?\s*$/iu.exec(value);
  if (!match) throw new TypeError(`Invalid cache size: ${value}`);
  const unit = (match[2] ?? "b").toLowerCase();
  const powers: Record<string, number> = { b: 0, kb: 1, mb: 2, gb: 3, tb: 4, kib: 1, mib: 2, gib: 3, tib: 4 };
  const base = unit.endsWith("ib") ? 1024 : 1000;
  return Math.floor(Number(match[1]) * base ** powers[unit]!);
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

/** Persistent size-bounded LRU cache for downloaded snapshots. */
export class CacheClient {
  private readonly statePath: string;

  constructor(readonly directory = DEFAULT_CACHE_DIRECTORY) {
    this.statePath = join(directory, "index.json");
  }

  private async load(): Promise<CacheState> {
    if (!(await exists(this.statePath))) return { limitBytes: MIN_CACHE_BYTES, entries: {} };
    try {
      const state = JSON.parse(await readFile(this.statePath, "utf8")) as Partial<CacheState>;
      return {
        limitBytes: Math.max(MIN_CACHE_BYTES, Number(state.limitBytes) || MIN_CACHE_BYTES),
        entries: state.entries ?? {},
      };
    } catch {
      return { limitBytes: MIN_CACHE_BYTES, entries: {} };
    }
  }

  private async save(state: CacheState): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.statePath, JSON.stringify(state, null, 2));
  }

  async setLimit(value: string | number): Promise<CacheInfo> {
    const limitBytes = parseCacheSize(value);
    if (limitBytes < MIN_CACHE_BYTES) throw new RangeError("The minimum E2 cache size is 1GB");
    const state = await this.load();
    state.limitBytes = limitBytes;
    await this.evict(state, 0);
    await this.save(state);
    return this.infoFrom(state);
  }

  async getLimit(): Promise<number> { return (await this.load()).limitBytes; }

  async list(): Promise<CacheInfo> {
    const state = await this.load();
    for (const entry of Object.values(state.entries)) {
      try {
        const details = await stat(entry.path);
        entry.sizeBytes = details.size;
      } catch {
        delete state.entries[entry.key];
      }
    }
    await this.save(state);
    return this.infoFrom(state);
  }

  async remove(key: string): Promise<boolean> {
    const state = await this.load();
    const entry = state.entries[key] ?? Object.values(state.entries).find((item) => item.snapshotId === key || basename(item.path) === key);
    if (!entry) return false;
    await rm(entry.path, { force: true });
    delete state.entries[entry.key];
    await this.save(state);
    return true;
  }

  async clear(): Promise<number> {
    const state = await this.load();
    const entries = Object.values(state.entries);
    await Promise.all(entries.map((entry) => rm(entry.path, { force: true })));
    state.entries = {};
    await this.save(state);
    return entries.length;
  }

  async touch(path: string, metadata: Omit<CacheEntry, "path" | "sizeBytes" | "lastUsedAt"> = { key: basename(path) }): Promise<void> {
    const state = await this.load();
    const details = await stat(path);
    const key = metadata.key;
    state.entries[key] = { ...metadata, path: resolve(path), sizeBytes: details.size, lastUsedAt: new Date().toISOString() };
    await this.evict(state, 0, new Set([key]));
    await this.save(state);
  }

  async ensureCapacity(requiredBytes: number, protectedKeys: string[] = []): Promise<void> {
    const state = await this.load();
    if (requiredBytes > state.limitBytes) throw new RangeError("Snapshot is larger than the configured cache limit");
    await this.evict(state, requiredBytes, new Set(protectedKeys));
    await this.save(state);
  }

  private async evict(state: CacheState, additionalBytes: number, protectedKeys = new Set<string>()): Promise<void> {
    const entries = Object.values(state.entries);
    let used = entries.reduce((total, entry) => total + entry.sizeBytes, 0);
    const oldest = entries
      .filter((entry) => !protectedKeys.has(entry.key))
      .sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt));
    while (used + additionalBytes > state.limitBytes && oldest.length) {
      const entry = oldest.shift()!;
      await rm(entry.path, { force: true });
      used -= entry.sizeBytes;
      delete state.entries[entry.key];
    }
  }

  private infoFrom(state: CacheState): CacheInfo {
    const entries = Object.values(state.entries).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
    return { directory: this.directory, limitBytes: state.limitBytes, usedBytes: entries.reduce((total, entry) => total + entry.sizeBytes, 0), entries };
  }
}
