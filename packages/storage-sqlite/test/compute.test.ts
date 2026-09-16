import { describe, expect, it } from "vitest";
import { encode } from "../../core/src/index.js";
import { SQLiteStore } from "../src/index.js";

function row(id: string, featureId: number, feature: string, lat: number, lng: number) {
  const e2Id = encode({ lat, lng, time: "2026-08-18T00:00:00Z", spatialResolution: 9, temporalResolution: "1d", featureId });
  return { id, feature_id: featureId, feature, lat, lng, h3: e2Id.split(":")[2]!, e2_id: e2Id, source: "test", source_id: id, geometry: { type: "Point", coordinates: [lng, lat] } } as const;
}

describe("local compute", () => {
  it("counts features within a relation radius", () => {
    const store = SQLiteStore.open(":memory:");
    try {
      store.importRows([row("restaurant-1", 101, "restaurant", 40.7, -74), row("park-1", 201, "park", 40.701, -74)]);
      expect(store.compute({ primitive: "COUNT", feature: "restaurant", within: { feature: "park", distanceMeters: 500 } })).toBe(1);
      expect(store.compute({ primitive: "GAPS", feature: "restaurant", within: { feature: "park", distanceMeters: 50 } })).toHaveLength(1);
    } finally { store.close(); }
  });
});
