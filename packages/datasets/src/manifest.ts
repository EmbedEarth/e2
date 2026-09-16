import document from "../../../catalog/datasets.json" with { type: "json" };
export interface DatasetManifest { featureId: number; feature: string; source: string; format: "parquet"; snapshotId: string | null; timeSemantics: "dataset_snapshot"; rowCount: number; bytes: number; sha256: string | null; download: { url: string } | null; status?: string; }
export interface DatasetCatalog { schemaVersion: number; generatedAt: string; datasets: DatasetManifest[]; }
export function parseManifest(value: unknown): DatasetCatalog { if (!value || typeof value !== "object" || !("datasets" in value) || !Array.isArray(value.datasets)) throw new TypeError("Invalid dataset manifest"); return value as DatasetCatalog; }
export const datasetCatalog = parseManifest(document);
