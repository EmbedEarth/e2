import { defineConfig } from "tsup";

// The SDK bundles every internal @embedearth/* workspace package directly into
// its output, so consumers install a single package with no @embedearth
// sub-dependencies. Native addons cannot be bundled and stay external.
export default defineConfig({
  entry: ["src/index.ts", "src/node.ts", "src/map-entry.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["better-sqlite3", "@duckdb/node-api", "maplibre-gl", "pmtiles"],
  noExternal: [/^@embedearth\//],
});
