import { E2_EPOCH_MS, TEMPORAL_DURATIONS, TEMPORAL_RESOLUTIONS, type TemporalResolution } from "./constants.js";
import { parse, stringify, type ParsedE2Cell } from "./cell.js";
import { parseTime } from "./validation.js";

const floorDiv = (a: bigint, b: bigint) => a >= 0n ? a / b : -((-a + b - 1n) / b);
const durationMs = (resolution: TemporalResolution) => BigInt(TEMPORAL_DURATIONS[resolution]) * 1000n;

export function timeToCell(time: Date | string | number, resolution: TemporalResolution): ParsedE2Cell["temporal"] {
  const delta = BigInt(parseTime(time).getTime()) - BigInt(E2_EPOCH_MS);
  return { resolution, bucket: floorDiv(delta, durationMs(resolution)) };
}

export function cellToTimeRange(value: string | ParsedE2Cell["temporal"]): { start: Date; end: Date } {
  const temporal = typeof value === "string" ? parse(value).temporal : value;
  const size = durationMs(temporal.resolution);
  const startMs = BigInt(E2_EPOCH_MS) + temporal.bucket * size;
  return { start: new Date(Number(startMs)), end: new Date(Number(startMs + size)) };
}

function replace(id: string, resolution: TemporalResolution, bucket: bigint): string {
  const value = parse(id); return stringify({ ...value, temporal: { resolution, bucket } });
}

export function temporalPrevious(id: string, count = 1): string { const value = parse(id); return replace(id, value.temporal.resolution, value.temporal.bucket - BigInt(count)); }
export function temporalNext(id: string, count = 1): string { const value = parse(id); return replace(id, value.temporal.resolution, value.temporal.bucket + BigInt(count)); }

export function temporalParent(id: string): string {
  const value = parse(id); const index = TEMPORAL_RESOLUTIONS.indexOf(value.temporal.resolution);
  if (index === TEMPORAL_RESOLUTIONS.length - 1) throw new RangeError("7d cells have no temporal parent");
  const parent = TEMPORAL_RESOLUTIONS[index + 1]!;
  const range = cellToTimeRange(value.temporal);
  return replace(id, parent, timeToCell(range.start, parent).bucket);
}

export function temporalChildren(id: string): string[] {
  const value = parse(id); const index = TEMPORAL_RESOLUTIONS.indexOf(value.temporal.resolution);
  if (index === 0) throw new RangeError("1s cells have no temporal children");
  const child = TEMPORAL_RESOLUTIONS[index - 1]!;
  const range = cellToTimeRange(value.temporal);
  const first = timeToCell(range.start, child).bucket;
  const count = TEMPORAL_DURATIONS[value.temporal.resolution] / TEMPORAL_DURATIONS[child];
  return Array.from({ length: count }, (_, offset) => replace(id, child, first + BigInt(offset)));
}
