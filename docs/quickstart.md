# Quickstart

## Install the workspace

```bash
pnpm install
pnpm build
```

## Use the CLI

```bash
pnpm --filter @embedearth/cli exec earth search restaurant --area Brooklyn
pnpm --filter @embedearth/cli exec earth compute count restaurant --area Manhattan
pnpm --filter @embedearth/cli exec earth route run --locations "40.748,-73.985;40.641,-73.778"
```

After publishing, the global install will be:

```bash
npm install -g @embedearth/cli
earth search restaurant --area Brooklyn
```

## Use the SDK

```ts
import { EmbedEarth } from "@embedearth/sdk";

const earth = new EmbedEarth({ apiKey: process.env.E2_API_KEY });
const places = await earth.search({ feature: ["restaurant"], area: ["Brooklyn"], mode: "auto" });
```

`mode` can be `cloud`, `offline`, or `auto`. See [search](search.md) and [local storage](local-storage.md) for the current contracts.
