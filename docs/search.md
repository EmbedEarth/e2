# Search

Search returns GeoJSON `FeatureCollection` results for one or more feature types and areas.

```ts
const results = await earth.search({
  feature: ["restaurant", "hospital"],
  area: ["Manhattan", "Brooklyn"],
  mode: "auto",
  limit: 500,
});
```

Use `area` for names or `area_id` for exact identifiers. The two forms are mutually exclusive.

## Optional parameters

| Parameter | Type | Purpose |
| --- | --- | --- |
| `area` | `string \| string[]` | Search one or more named areas. |
| `area_id` | `string \| string[]` | Search one or more exact area IDs. |
| `country_code` | `string` | Select a country, for example `US`. |
| `state_code` | `string` | Select a state or province, for example `NY`. |
| `latitude`, `longitude` | `number` | Search around a coordinate. Provide both. |
| `mode` | `cloud \| offline \| auto` | Select the execution mode. Defaults to `auto`. |
| `limit` | `number` | Maximum number of returned features. Defaults to `1000`. |
| `signal` | `AbortSignal` | Cancel the request. |
