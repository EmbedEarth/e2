# Build and verification

EmbedEarth is a pnpm workspace.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Package-level commands can be run with `pnpm --filter <package> <script>`, for example:

```bash
pnpm --filter @embedearth/sdk test
pnpm --filter @embedearth/cli build
```

Runtime checks that require hosted APIs or local snapshots should be run with the appropriate environment variables and should never print their values.
