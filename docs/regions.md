# Regions

The public catalog is extracted from source rows where `favorite = true`.
Public search, route-to-feature, and compute inputs use `area` for a name or
`area_id` for an exact ID. Resolution raises an ambiguity error when exact
names collide. Region IDs are raw numeric source IDs such as `4915`; POI rows
preserve direct country, state, and city area links. The checked-in catalog ships
as `catalog/regions.json.gz` for the SDK/CLI/MCP loader and
`catalog/regions.sqlite` for indexed consumers.
