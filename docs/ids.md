# IDs

E2 version 1 accepts exactly five segments for a base cell or six for a feature
cell. Feature IDs are positive safe integers. Region IDs use
raw numeric source IDs such as `4915`. Parsing rejects invalid H3 indexes,
unknown temporal resolutions, extra suffixes, and non-integer buckets.
