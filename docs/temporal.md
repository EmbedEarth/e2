# Temporal cells

Temporal buckets use UTC and the epoch `1970-01-05T00:00:00Z`. Supported fixed
resolutions are `1s`, `10s`, `1m`, `5m`, `15m`, `1h`, `6h`, `1d`, and `7d`.
Bucket calculation uses mathematical floor, including before the epoch. Query
windows `30d`, `90d`, `1y`, and `all` are not cell resolutions.
