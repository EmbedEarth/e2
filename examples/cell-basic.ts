import { encode, decode } from "@embedearth/core";
const id = encode({ lat: 40.7128, lng: -74.006, time: "2026-08-12T19:30:00Z", spatialResolution: 10, temporalResolution: "1h" });
console.log(id, decode(id));
