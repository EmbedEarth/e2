import { RegionCatalog, regions, type E2Region } from "@embedearth/regions";

const STATE_NAMES: Record<string, Record<string, string>> = {
  US: { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia" },
  CA: { AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon" },
};

function matchesCode(region: E2Region, value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return region.countryCode?.toUpperCase() === normalized || (region.aliases ?? []).some((alias) => alias.toUpperCase() === normalized);
}

export class RegionClient {
  constructor(private readonly catalog: RegionCatalog = regions) {}
  list(): E2Region[] { return this.catalog.list(); }
  search(query: string): E2Region[] { return this.catalog.search(query); }
  resolve(value: string): E2Region { return this.catalog.resolve(value); }
  get(id: string): E2Region | undefined { return this.catalog.get(id); }
  resolveCodes(countryCode?: string, stateCode?: string): E2Region {
    const country = countryCode?.trim().toUpperCase();
    const state = stateCode?.trim().toUpperCase();
    if (!country && !state) throw new TypeError("country_code or state_code is required");
    const countryRegion = country ? this.list().find((region) => region.type === "country" && matchesCode(region, country)) : undefined;
    if (country && !countryRegion) throw new Error(`Unknown country_code: ${countryCode}`);
    if (state) {
      const stateName = country ? STATE_NAMES[country]?.[state] : Object.values(STATE_NAMES).flatMap((states) => Object.entries(states).filter(([code]) => code === state).map(([, name]) => name))[0];
      const matches = this.list().filter((region) => region.type === "admin1" && (!countryRegion || region.parentId === countryRegion.id || region.countryCode?.toUpperCase() === country) && (stateName ? region.name.toLowerCase() === stateName.toLowerCase() : region.name.toLowerCase() === state.toLowerCase() || (region.aliases ?? []).some((alias) => alias.toUpperCase() === state)));
      if (matches.length === 1) return matches[0]!;
      if (!matches.length) throw new Error(`Unknown state_code: ${stateCode}`);
      throw new Error(`Ambiguous state_code: ${stateCode}`);
    }
    return countryRegion!;
  }
}
