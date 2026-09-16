import type { E2Feature } from "./feature-types.js";
export function loadFeatures(value: unknown): E2Feature[] { if (!value || typeof value !== "object" || !("features" in value) || !Array.isArray(value.features)) throw new TypeError("Invalid feature catalog"); return value.features as E2Feature[]; }
