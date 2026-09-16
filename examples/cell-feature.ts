import { E2 } from "@embedearth/sdk";
console.log(new E2().encode({ lat: 40.7128, lng: -74.006, time: "2026-08-12T19:30:00Z", spatialResolution: 10, temporalResolution: "1h", feature: "restaurant" }));
