import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

const DEFAULT_DUCKDB_HOME = join(tmpdir(), "e2-duckdb");
let spatialInstance: Promise<DuckDBInstance> | undefined;

/** Create a DuckDB instance with a writable extension home directory. */
export async function createDuckDBInstance(path = ":memory:"): Promise<DuckDBInstance> {
  const configuredHome = process.env.DUCKDB_HOME_DIRECTORY?.trim();
  const homeDirectory = configuredHome || DEFAULT_DUCKDB_HOME;
  await mkdir(homeDirectory, { recursive: true });
  return DuckDBInstance.create(path, { home_directory: homeDirectory });
}

/**
 * Process-wide in-memory DuckDB with the spatial extension installed and loaded
 * once. Serverless warm invocations reuse it; a cold runtime initializes a new
 * instance without relying on a system home directory.
 */
export function getSpatialDuckDBInstance(): Promise<DuckDBInstance> {
  if (!spatialInstance) {
    const initializing = (async () => {
      const instance = await createDuckDBInstance();
      const connection = await instance.connect();
      try {
        await connection.run("INSTALL spatial");
        await connection.run("LOAD spatial");
        return instance;
      } catch (error) {
        instance.closeSync();
        throw error;
      } finally {
        connection.closeSync();
      }
    })();
    spatialInstance = initializing;
    void initializing.catch(() => {
      if (spatialInstance === initializing) spatialInstance = undefined;
    });
  }
  return spatialInstance;
}
