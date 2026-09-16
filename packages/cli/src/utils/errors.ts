export function fail(error: unknown): never { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
