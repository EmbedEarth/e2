import type { E2 } from "./E2.js";
import { Map as E2Map, type MapOptions } from "./MapLibre.js";
import { listMapSources, type MapSource } from "./MapSources.js";

/** Map primitive: resolve display sources or create a MapLibre-backed map. */
export class MapClient {
  constructor(private readonly e2: E2) {}
  sources(features: Array<string | number> = [], signal?: AbortSignal): Promise<MapSource[]> { return listMapSources(features, signal); }
  create(options: Omit<MapOptions, "e2">): E2Map { return new E2Map({ ...options, e2: this.e2 }); }
}
