import { E2 as BaseE2, type E2Options } from "./E2.js";
import type { SearchExecutor } from "./SearchClient.js";
import { StratumClient } from "./StratumClient.js";

export interface NodeE2Options extends Omit<E2Options, "search"> {
  search?: SearchExecutor;
  cacheDirectory?: string;
}

/** Node runtime E2 client with local snapshot search selected automatically. */
export class E2 extends BaseE2 {
  readonly stratum: StratumClient;

  constructor(options: NodeE2Options = {}) {
    const { cacheDirectory, search, ...baseOptions } = options;
    const stratum = new StratumClient({ cacheDirectory, stratumApiUrl: baseOptions.stratumApiUrl });
    super({
      ...baseOptions,
      apiKey: baseOptions.apiKey ?? process.env.E2_API_KEY,
      routeUrl: baseOptions.routeUrl ?? process.env.ROUTE_URL,
      search: search ?? stratum.executor,
    });
    this.stratum = stratum;
  }
}
