import { describe, expect, it } from "vitest";
import { baseCell, cellToTimeRange, decode, encode, getFeatureId, hasFeature, isValid, temporalNext, temporalParent, timeToCell, withFeature } from "../src/index.js";

describe("E2 core", () => {
  const input = { lat: 40.7128, lng: -74.006, time: "2026-08-12T19:30:00Z", spatialResolution: 10, temporalResolution: "1h" as const };
  it("round trips base and feature cells", () => { const base = encode(input); expect(isValid(base)).toBe(true); const featured = withFeature(base, 37); expect(hasFeature(featured)).toBe(true); expect(getFeatureId(featured)).toBe(37); expect(baseCell(featured)).toBe(base); expect(decode(featured).featureId).toBe(37); });
  it("uses mathematical floor before epoch", () => { expect(timeToCell("1970-01-04T23:59:59Z", "1m").bucket).toBe(-1n); });
  it("returns half-open time ranges", () => { const temporal = timeToCell("1970-01-05T00:00:01Z", "1m"); expect(cellToTimeRange(temporal).start.toISOString()).toBe("1970-01-05T00:00:00.000Z"); });
  it("preserves feature suffix in traversal", () => { const id = encode({ ...input, featureId: 37 }); expect(getFeatureId(temporalNext(id))).toBe(37); expect(decode(temporalParent(id)).temporal.resolution).toBe("6h"); });
});
