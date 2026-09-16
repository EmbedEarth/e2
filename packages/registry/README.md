# @embedearth/registry

The E2 feature registry: canonical feature types (restaurant, hospital, school, …) and their numeric ids, with lookup and search.

Part of **E2**, the open spacetime index for Earth. Most users should install
[`@embedearth/sdk`](https://www.npmjs.com/package/@embedearth/sdk) instead of
depending on this package directly.

## Install

```bash
npm install @embedearth/registry
```

## Usage

```ts
import { features } from "@embedearth/registry";
features.search("hospital");
```

## License

Apache-2.0
