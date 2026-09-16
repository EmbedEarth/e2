# Architecture

EmbedEarth presents one developer surface over maps, places, routes, regions, datasets, and spatial compute.

```text
Application or AI agent
          |
     SDK / CLI / MCP
          |
       EmbedEarth
          |
Maps + Places + Routes + Real-world data
```

## Open-source boundary

The open repository contains public contracts, client libraries, examples, selected data tooling, and local-first storage. Hosted global search, continuously refreshed datasets, managed indexing, and large-scale visual search may remain managed services. The boundary will be documented per capability before public launch.

Implementation details such as H3, GeoParquet, SQLite, PMTiles, and provider adapters are useful to contributors but should not be required knowledge for normal SDK users.
