export type ComputePrimitive =
  | "NEAREST"
  | "DISTANCE"
  | "WITHIN"
  | "COUNT"
  | "DENSITY"
  | "COVERAGE"
  | "GAPS"
  | "CLUSTER";
export type ComputeMode = "cloud" | "offline" | "auto";
export interface ComputeRunOptions {
  mode?: ComputeMode;
  /**
   * Optional snapshot year (for example `"2026"`). Year-split features
   * (anything that is not `osm` or `visual`) default to the newest available
   * year, cascading down from the current year.
   */
  year?: string | number | null;
  latitude?: number;
  longitude?: number;
  signal?: AbortSignal;
}
export interface CompareOptions {
  features?: [string | number, string | number];
  feature?: string | number;
  areas?: [string, string];
  area_ids?: [string, string];
  area?: string;
  area_id?: string;
  primitive?: ComputePrimitive;
  mode?: ComputeMode;
  year?: string | number | null;
  near?: ComputeRelation;
  within?: ComputeRelation;
  limit?: number;
}
export interface CompareSide { label: string | number; value: unknown; }
export interface CompareResult {
  primitive: ComputePrimitive;
  comparison: "features" | "areas";
  left: CompareSide;
  right: CompareSide;
  difference: number | null;
  ratio: number | null;
}

export interface ComputeRelation {
  feature: string | number;
  distanceMeters: number;
}

export interface ComputeRequest {
  primitive: ComputePrimitive;
  feature: string | number | Array<string | number>;
  area?: string;
  area_id?: string;
  near?: ComputeRelation;
  within?: ComputeRelation;
  limit?: number;
  radiusMeters?: number;
  mode?: ComputeMode;
  /**
   * Optional snapshot year (for example `"2026"`). Year-split features
   * (anything that is not `osm` or `visual`) default to the newest available
   * year, cascading down from the current year.
   */
  year?: string | number | null;
  signal?: AbortSignal;
  latitude?: number;
  longitude?: number;
}

export interface ComputeExecutor {
  compute(request: Omit<ComputeRequest, "area" | "area_id"> & { area_id?: string }): Promise<unknown> | unknown;
}

export class ComputeQuery {
  private areaValue?: string;
  private areaIdValue?: string;
  private relation?: ComputeRelation;
  private resultLimit?: number;
  private modeValue?: ComputeMode;
  private yearValue?: string | number | null;

  constructor(
    private readonly executor: ComputeExecutor | undefined,
    private readonly featureValue: string | number | Array<string | number>,
    private readonly resolveArea: (area: string) => string,
    private readonly resolveCoordinates?: (latitude: number, longitude: number, signal?: AbortSignal) => Promise<string | null>,
  ) {}

  area(area: string): this {
    if (!area.trim()) { this.areaValue = undefined; return this; }
    this.areaValue = area.trim();
    this.areaIdValue = undefined;
    return this;
  }

  areaId(areaId: string): this {
    if (!areaId.trim()) { this.areaIdValue = undefined; return this; }
    this.areaIdValue = areaId.trim();
    this.areaValue = undefined;
    return this;
  }

  near(feature: string | number, distanceMeters: number): this {
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new TypeError("near distance must be a non-negative number");
    this.relation = { feature, distanceMeters };
    return this;
  }

  within(): Promise<unknown>;
  within(feature: string | number, distanceMeters: number): this;
  within(feature?: string | number, distanceMeters?: number): this | Promise<unknown> {
    if (feature === undefined && distanceMeters === undefined) return this.run("WITHIN");
    if (feature === undefined || distanceMeters === undefined) throw new TypeError("within requires a feature and distance");
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new TypeError("within distance must be a non-negative number");
    this.relation = { feature, distanceMeters };
    return this;
  }

  limit(value: number): this {
    if (!Number.isInteger(value) || value < 1) throw new TypeError("compute limit must be a positive integer");
    this.resultLimit = value;
    return this;
  }

  mode(value: ComputeMode): this {
    this.modeValue = value;
    return this;
  }

  year(value: string | number | null): this {
    this.yearValue = value;
    return this;
  }

  async run(primitive: ComputePrimitive, options: ComputeRunOptions = {}): Promise<unknown> {
    if (!this.executor) throw new Error("Compute is not configured. Open a LocalDatabase and pass it to E2.");
    if ((options.latitude === undefined) !== (options.longitude === undefined)) throw new TypeError("latitude and longitude must be provided together");
    if ((this.areaValue !== undefined || this.areaIdValue !== undefined) && options.latitude !== undefined) throw new TypeError("Use area/area_id or latitude/longitude, not both");
    const coordinateRegion = options.latitude === undefined || !this.resolveCoordinates
      ? undefined
      : await this.resolveCoordinates(options.latitude, options.longitude!, options.signal);
    const request: Omit<ComputeRequest, "area" | "area_id"> & { area_id?: string } = {
      primitive,
      feature: this.featureValue,
      area_id: this.areaIdValue ?? (this.areaValue === undefined ? undefined : this.resolveArea(this.areaValue)) ?? coordinateRegion ?? undefined,
      limit: this.resultLimit,
      mode: options.mode ?? this.modeValue,
      ...(options.year !== undefined && options.year !== null ? { year: options.year } : (this.yearValue !== undefined && this.yearValue !== null ? { year: this.yearValue } : {})),
      signal: options.signal,
    };
    if (primitive === "WITHIN" || primitive === "COVERAGE" || primitive === "GAPS") request.within = this.relation;
    else request.near = this.relation;
    return Promise.resolve(this.executor.compute(request));
  }

  nearest(options?: ComputeRunOptions): Promise<unknown> { return this.run("NEAREST", options); }
  distance(options?: ComputeRunOptions): Promise<unknown> { return this.run("DISTANCE", options); }
  count(options?: ComputeRunOptions): Promise<unknown> { return this.run("COUNT", options); }
  density(options?: ComputeRunOptions): Promise<unknown> { return this.run("DENSITY", options); }
  coverage(options?: ComputeRunOptions): Promise<unknown> { return this.run("COVERAGE", options); }
  gaps(options?: ComputeRunOptions): Promise<unknown> { return this.run("GAPS", options); }
  cluster(options?: ComputeRunOptions): Promise<unknown> { return this.run("CLUSTER", options); }
}

/** Fluent interface for spatial analysis over indexed local features. */
export class ComputeClient {
  constructor(
    private readonly executor?: ComputeExecutor,
    private readonly resolveArea: (area: string) => string = (area) => area,
    private readonly resolveCoordinates?: (latitude: number, longitude: number, signal?: AbortSignal) => Promise<string | null>,
  ) {}

  feature(feature: string | number | Array<string | number>): ComputeQuery {
    return new ComputeQuery(this.executor, feature, this.resolveArea, this.resolveCoordinates);
  }

  async run(request: ComputeRequest): Promise<unknown> {
    if (!this.executor) throw new Error("Compute is not configured. Open a LocalDatabase and pass it to E2.");
    if ((request.latitude === undefined) !== (request.longitude === undefined)) throw new TypeError("latitude and longitude must be provided together");
    if (request.area !== undefined && request.area_id !== undefined) throw new TypeError("Use area or area_id, not both");
    if ((request.area !== undefined || request.area_id !== undefined) && request.latitude !== undefined) throw new TypeError("Use area/area_id or latitude/longitude, not both");
    const coordinateRegion = request.latitude === undefined || !this.resolveCoordinates
      ? undefined
      : await this.resolveCoordinates(request.latitude, request.longitude!, request.signal);
    const { latitude: _latitude, longitude: _longitude, area, area_id, ...resolvedRequest } = request;
    const resolvedAreaId = area_id ?? (area === undefined ? undefined : this.resolveArea(area)) ?? coordinateRegion ?? undefined;
    return Promise.resolve(this.executor.compute({ ...resolvedRequest, area_id: resolvedAreaId }));
  }

  async compare(left: string | number | CompareOptions, right?: string | number, options: ComputeRunOptions & { primitive?: ComputePrimitive; area?: string; area_id?: string } = {}): Promise<CompareResult> {
    let request: CompareOptions;
    if (typeof left === "object") request = left;
    else {
      if (right === undefined) throw new TypeError("compare requires two features or areas");
      request = { features: [left, right], ...options };
    }
    const primitive = request.primitive ?? "COUNT";
    const features = request.features;
    const areas = request.areas;
    const areaIds = request.area_ids;
    if (areas && areaIds) throw new TypeError("Compare areas or area_ids, not both");
    if (features && (areas || areaIds)) throw new TypeError("Compare features or areas, not both");
    if (!features && !areas && !areaIds) throw new TypeError("Compare requires two features or two areas");
    if (features && features.length !== 2) throw new TypeError("Compare requires exactly two features");
    if (areas && areas.length !== 2) throw new TypeError("Compare requires exactly two areas");
    if (areaIds && areaIds.length !== 2) throw new TypeError("Compare requires exactly two area_ids");
    if ((areas || areaIds) && request.feature === undefined) throw new TypeError("Comparing areas requires one feature");
    const comparison = features ? "features" : "areas";
    const labels = features ?? areas ?? areaIds!;
    const exactAreaIds = areaIds;
    const values = await Promise.all(labels.map((label) => this.run({
      primitive,
      feature: features ? label : request.feature!,
      area: features ? request.area : exactAreaIds ? undefined : String(label),
      area_id: features ? request.area_id : exactAreaIds ? String(label) : undefined,
      near: request.near,
      within: request.within,
      limit: request.limit,
      mode: request.mode,
      ...(request.year !== undefined && request.year !== null ? { year: request.year } : {}),
    })));
    const leftValue = values[0];
    const rightValue = values[1];
    const numeric = typeof leftValue === "number" && typeof rightValue === "number";
    const difference = numeric ? leftValue - rightValue : null;
    const ratio = numeric && rightValue !== 0 ? leftValue / rightValue : null;
    return { primitive, comparison, left: { label: labels[0]!, value: leftValue }, right: { label: labels[1]!, value: rightValue }, difference, ratio };
  }
}
