# Contributing to EmbedEarth

Thanks for helping build a programmable interface to the physical world.

## Development setup

Requirements: Node.js 20+, pnpm 9+, and Python 3.11+ for dataset tooling.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Keep credentials in a local `.env` file. Never commit tokens, connection strings, generated databases, or large datasets.

## Where to contribute

- Add or improve an SDK method in `packages/sdk`.
- Add a CLI command or output mode in `packages/cli`.
- Add an agent-facing tool in `packages/mcp`.
- Add a focused example under `examples/`.
- Add a source, schema, or provenance note under `datasets/` and `schemas/`.

## Pull requests

Explain the user-facing contract, include tests for behavior changes, and keep implementation details out of public API examples. Small, focused pull requests are easiest to review.

## First contribution

Start with an issue labeled `good first issue`, improve one example, or clarify a quickstart step. If you are adding a provider or dataset, include coverage, refresh cadence, license, attribution, and a reproducible query.
