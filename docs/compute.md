# Spatial compute

Compute runs over Cloud data, cached Stratum data, or a local database.

```ts
const count = await earth.compute.feature("restaurant")
  .area("Manhattan")
  .near("park", 500)
  .count();
```

Available primitives include `NEAREST`, `DISTANCE`, `WITHIN`, `COUNT`, `DENSITY`, `COVERAGE`, `GAPS`, and `CLUSTER`.
