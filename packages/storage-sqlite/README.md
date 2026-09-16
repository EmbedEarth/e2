# @embedearth/storage-sqlite

Local-first storage for E2 datasets: import GeoJSON, CSV, or Parquet into SQLite,
create GeoParquet, and run local spatial/temporal queries and compute primitives.

Part of **E2**, the open spacetime index for Earth. Most users should install
[`@embedearth/sdk`](https://www.npmjs.com/package/@embedearth/sdk) instead of
depending on this package directly.

## Install

```bash
npm install @embedearth/storage-sqlite
```

## Usage

The higher-level upload workflow is available from
`@embedearth/sdk/node` through `StorageClient`. `SQLiteStore` remains the
low-level indexed row store.

## License

Apache-2.0
