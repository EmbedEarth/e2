# Datasets

EmbedEarth exposes dataset-backed search and Stratum-aware clients without requiring applications to operate the ingestion or publication systems.

The public repository contains schemas, catalogs, and client contracts. Hosted dataset coverage, freshness, licensing, attribution, and availability should be documented per dataset before an application depends on it.

Use the SDK or CLI to discover available datasets:

```bash
earth stratum data list
earth stratum cache list
```

Large data files and the jobs that build or publish them are intentionally kept outside this developer repository.
