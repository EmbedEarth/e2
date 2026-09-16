import { SQLiteStore, type ComputeRequest, type E2DatasetRow, type E2Query } from "@embedearth/storage-sqlite";
export class LocalDatabase {
  private constructor(private readonly store: SQLiteStore) {}
  static async open(path: string): Promise<LocalDatabase> { return new LocalDatabase(SQLiteStore.open(path)); }
  importRows(rows: Iterable<E2DatasetRow>): number { return this.store.importRows(rows); }
  importFile(path: string, region?: string): Promise<number> { return this.store.importParquet(path, region); }
  query(query?: E2Query): Record<string, unknown>[] { return this.store.query(query); }
  compute(request: ComputeRequest): unknown { return this.store.compute(request); }
  stats(): Array<{ feature: string; rows: number }> { return this.store.stats(); }
  close(): void { this.store.close(); }
}
