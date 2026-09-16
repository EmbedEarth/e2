import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const source = (packageName: string) => fileURLToPath(new URL(`../${packageName}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@embedearth/core": source("core"),
      "@embedearth/datasets": source("datasets"),
      "@embedearth/regions": source("regions"),
      "@embedearth/registry": source("registry"),
      "@embedearth/storage-sqlite": source("storage-sqlite"),
    },
  },
});
