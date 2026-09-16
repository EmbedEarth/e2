# Local Storage

`LocalDatabase` stores normalized observations in SQLite with indexes for
feature, H3, and region membership.

```ts
import { LocalDatabase, StorageClient } from "@embedearth/sdk/node";

const db = await LocalDatabase.open("./e2.db");
await new StorageClient().upload({
  path: "./places.geojson",
  database: db,
  connectTo: "restaurant",
  output: "./places.geoparquet",
});
console.log(db.query({ feature: "restaurant", limit: 100 }));
db.close();
```

Uploads accept GeoJSON, CSV, and Parquet. Each row exposes `feature_id` and
`feature`, and is assigned an E2 cell if the source does not provide one.
`feature`, `connectTo`, or an explicit `featureId` attaches uploaded rows to a
feature. The storage layer rejects rows that cannot be associated with a
feature.

`LocalDatabase.compute()` is an optional local executor for the fluent
`E2.compute.feature()` API and the CLI/MCP compute primitives. Without it, those
surfaces use the same cloud/offline/auto backend as search.
