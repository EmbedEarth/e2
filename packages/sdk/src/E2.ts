import { FeatureClient } from "./FeatureClient.js";
import { RegionClient } from "./RegionClient.js";
import { DatasetClient } from "./DatasetClient.js";
import { SearchClient, type SearchExecutor, type SearchOptions, type SearchFeatureCollection } from "./SearchClient.js";
import { RouteClient } from "./RouteClient.js";
import { ComputeClient, type ComputeExecutor } from "./ComputeClient.js";
import { HttpSearchExecutor } from "./HttpSearchExecutor.js";
import { RemoteComputeExecutor } from "./RemoteComputeExecutor.js";
import { MapClient } from "./MapClient.js";
import { RegionLookupClient, preferredRegionId } from "./RegionLookupClient.js";
import { gridDisk, latLngToCell } from "h3-js";
export interface E2Options {
  apiKey?: string;
  search?: SearchExecutor;
  searchUrl?: string;
  searchHeaders?: Record<string, string>;
  routeUrl?: string;
  /** @deprecated Use routeUrl. */
  routingUrl?: string;
  /** @deprecated Use routeUrl. */
  valhallaUrl?: string;
  compute?: ComputeExecutor;
  cacheDirectory?: string;
  stratumApiUrl?: string;
}
const CLOUD_PLAN_IMAGE_MESSAGE = "Please upgrade to the Cloud plan to access image URLs.";
export class E2 {
  readonly features = new FeatureClient(); readonly regions = new RegionClient(); readonly datasets: DatasetClient;
  readonly route: RouteClient;
  readonly compute: ComputeClient;
  readonly map: MapClient;
  private readonly searchClient: SearchClient;
  readonly #regionLookup: RegionLookupClient;
  constructor(options: E2Options = {}) {
    this.datasets = new DatasetClient(undefined, options.stratumApiUrl);
    const apiKey = options.apiKey?.trim();
    const apiHeaders: Record<string, string> = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
    this.#regionLookup = new RegionLookupClient({ headers: apiHeaders });
    const searchExecutor = options.search ?? new HttpSearchExecutor({
      url: options.searchUrl,
      headers: { ...apiHeaders, ...options.searchHeaders },
    });
    const directRouteUrl = options.routeUrl ?? options.valhallaUrl;
    const hostedRoute = directRouteUrl === undefined && options.routingUrl !== undefined;
    const resolveCoordinates = async (latitude: number, longitude: number, signal?: AbortSignal): Promise<string | null> => {
      const result = await this.#regionLookup.resolve({ lat: latitude, lng: longitude }, signal);
      return preferredRegionId(result);
    };
    this.route = new RouteClient(
      directRouteUrl ?? options.routingUrl ?? "https://route.embed.earth",
      searchExecutor,
      (area) => this.regions.resolve(area).id,
      { headers: hostedRoute ? apiHeaders : {}, hosted: hostedRoute },
      resolveCoordinates,
    );
    this.searchClient = new SearchClient(searchExecutor, (area) => this.regions.resolve(area).id, (feature) => {
      if (apiKey) return undefined;
      try {
        return this.features.resolve(feature).featureType === "visual" ? undefined : CLOUD_PLAN_IMAGE_MESSAGE;
      } catch {
        return CLOUD_PLAN_IMAGE_MESSAGE;
      }
    });
    this.compute = new ComputeClient(options.compute ?? new RemoteComputeExecutor(searchExecutor), (area) => {
      try { return this.regions.resolve(area).id; } catch { return area; }
    }, resolveCoordinates);
    this.map = new MapClient(this);
  }
  async search(options: SearchOptions): Promise<SearchFeatureCollection> {
    const hasLatitude = options.latitude !== undefined;
    const hasLongitude = options.longitude !== undefined;
    if (hasLatitude !== hasLongitude) throw new TypeError("latitude and longitude must be provided together");
    if (!hasLatitude) {
      if (options.area !== undefined || options.area_id !== undefined) {
        if (options.country_code !== undefined || options.state_code !== undefined) throw new TypeError("Use area/area_id or country_code/state_code, not both");
        return this.searchClient.search(options);
      }
      if (options.country_code !== undefined || options.state_code !== undefined) {
        const region = this.regions.resolveCodes(options.country_code, options.state_code);
        const { country_code: _country_code, state_code: _state_code, ...query } = options;
        return this.searchClient.search({ ...query, area_id: region.id });
      }
      return this.searchClient.search(options);
    }
    if (options.area !== undefined || options.area_id !== undefined) throw new TypeError("Use area/area_id or latitude/longitude, not both");
    if (options.country_code !== undefined || options.state_code !== undefined) throw new TypeError("Use country_code/state_code or latitude/longitude, not both");
    const regionId = preferredRegionId(await this.#regionLookup.resolve({ lat: options.latitude!, lng: options.longitude! }, options.signal));
    const { latitude: _latitude, longitude: _longitude, ...query } = options;
    const originCell = latLngToCell(options.latitude!, options.longitude!, 7);
    const h3Cells = gridDisk(originCell, 1);
    return this.searchClient.searchWithH3({ ...query, area_id: regionId ?? undefined }, h3Cells);
  }
}
