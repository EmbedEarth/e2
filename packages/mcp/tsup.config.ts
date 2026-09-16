import { defineConfig } from "tsup";

// The MCP server is a self-contained binary: the SDK and its internal
// @embedearth/* packages are bundled in. The MCP framework, zod, and native
// addons stay external so they resolve to their published/prebuilt versions.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  clean: true,
  // Bundled CJS deps use require(); provide a real require in the ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  external: ["better-sqlite3", "@duckdb/node-api", "@modelcontextprotocol/sdk", "zod"],
  noExternal: [/^@embedearth\//, "h3-js", "hyparquet", "hyparquet-compressors"],
});
