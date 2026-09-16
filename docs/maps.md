# Maps

The SDK includes a MapLibre wrapper and helpers for Planet basemap and published feature PMTiles sources.

```ts
import { createMap } from "@embedearth/sdk/map";
import "maplibre-gl/dist/maplibre-gl.css";

const map = createMap({ container: "map", center: [-73.99, 40.74], zoom: 11 });
await map.addFeatures(["restaurant"]);
```

The renderer is an implementation detail of the EmbedEarth map client; applications should depend on the public source and layer contracts.
