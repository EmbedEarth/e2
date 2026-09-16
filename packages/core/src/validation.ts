import { isValidCell } from "h3-js";
import { TEMPORAL_DURATIONS, type TemporalResolution } from "./constants.js";
import { InvalidCellError } from "./errors.js";

export function isTemporalResolution(value: string): value is TemporalResolution {
  return Object.hasOwn(TEMPORAL_DURATIONS, value);
}

export function assertFeatureId(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidCellError("Feature ID must be a positive safe integer");
  }
}

export function assertH3(value: string): void {
  if (!isValidCell(value)) throw new InvalidCellError(`Invalid H3 cell: ${value}`);
}

export function parseTime(value: Date | string | number): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new E2TimeError("Invalid timestamp");
  return date;
}

export class E2TimeError extends RangeError {}
