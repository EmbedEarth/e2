# Geocoding

EmbedEarth resolves named regions into stable geographic identifiers used by search, Stratum, and compute. Exact identifiers are preferred when an application has already resolved a region.

```ts
const region = earth.regions.resolve("Brooklyn");
```

Address-level geocoding is a planned hosted capability; do not treat region resolution as a complete replacement for an address geocoder yet.
