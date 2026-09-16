import document from "../../../catalog/features.json" with { type: "json" };
import type { E2Feature } from "./feature-types.js";

export class FeatureRegistry {
  private readonly features: E2Feature[];
  constructor(features: E2Feature[] = document.features) { this.features = features.map((feature) => ({ ...feature, ...(feature.aliases ? { aliases: [...feature.aliases] } : {}) })); }
  list(): E2Feature[] { return this.features.map((feature) => ({ ...feature, ...(feature.aliases ? { aliases: [...feature.aliases] } : {}) })); }
  getById(id: number): E2Feature | undefined { return this.features.find((feature) => feature.id === id); }
  getByKey(key: string): E2Feature | undefined {
    const value = key.trim().toLowerCase();
    return this.features.find((feature) => feature.key === value || (feature.aliases ?? []).some((alias) => alias.toLowerCase() === value))
      ?? this.features.find((feature) => feature.key.endsWith("s") && feature.key.slice(0, -1) === value);
  }
  resolve(value: string | number): E2Feature { const feature = typeof value === "number" ? this.getById(value) : /^\d+$/.test(value.trim()) ? this.getById(Number(value)) : this.getByKey(value); if (!feature) throw new Error(`Unknown feature: ${value}`); return feature; }
  search(query: string): E2Feature[] { const value = query.trim().toLowerCase(); return this.list().filter((feature) => [feature.key, feature.name, ...(feature.aliases ?? []), feature.description ?? ""].some((field) => field.toLowerCase().includes(value))); }
}
export const features = new FeatureRegistry();
