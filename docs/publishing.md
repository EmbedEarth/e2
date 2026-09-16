# Package releases

The SDK, CLI, and MCP packages are designed to publish independently from private service infrastructure. Release automation should build from source, run the workspace checks, inspect package contents, and use a short-lived registry credential supplied by the release environment.

The current package dependency order is:

```text
@embedearth/core
@embedearth/registry
@embedearth/regions
@embedearth/datasets
@embedearth/storage-sqlite
@embedearth/sdk
@embedearth/cli
@embedearth/mcp
```

Do not commit registry tokens, service credentials, deployment configuration, generated datasets, or server runtime files to this repository.
