import { defineConfig } from "tsup";

// The CLI is a self-contained binary: the SDK, its internal @embedearth/*
// packages, and all pure-JS dependencies are bundled into a single file so a
// user can `npm install -g @embedearth/cli` and run `e2` immediately. Only the
// native addons (which ship prebuilt binaries) remain as install dependencies.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  clean: true,
  // Bundled CJS deps use require(); provide a real require in the ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  external: ["better-sqlite3", "@duckdb/node-api"],
  noExternal: [
    /^@embedearth\//,
    "commander",
    "h3-js",
    "hyparquet",
    "hyparquet-compressors",
  ],
});
