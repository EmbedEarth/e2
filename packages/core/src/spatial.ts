import { cellToChildren, cellToParent, gridDisk, getResolution, cellToLatLng, cellToBoundary } from "h3-js";
import { parse, stringify } from "./cell.js";

const replaceSpatial = (id: string, spatial: string): string => stringify({ ...parse(id), spatial });
export function spatialParent(id: string, resolution = getResolution(parse(id).spatial) - 1): string {
  const value = parse(id); if (resolution < 0 || resolution >= getResolution(value.spatial)) throw new RangeError("Parent resolution must be lower");
  return replaceSpatial(id, cellToParent(value.spatial, resolution));
}
export function spatialChildren(id: string, resolution = getResolution(parse(id).spatial) + 1): string[] {
  const value = parse(id); if (resolution <= getResolution(value.spatial) || resolution > 15) throw new RangeError("Child resolution must be higher");
  return cellToChildren(value.spatial, resolution).map((cell) => replaceSpatial(id, cell));
}
export function spatialNeighbors(id: string, k = 1): string[] {
  if (!Number.isInteger(k) || k < 0) throw new RangeError("k must be a non-negative integer");
  const value = parse(id); return gridDisk(value.spatial, k).filter((cell) => cell !== value.spatial).map((cell) => replaceSpatial(id, cell));
}
export function spatialCenter(id: string): { lat: number; lng: number } { const [lat, lng] = cellToLatLng(parse(id).spatial); return { lat, lng }; }
export function spatialBoundary(id: string): Array<{ lat: number; lng: number }> { return cellToBoundary(parse(id).spatial).map(([lat, lng]) => ({ lat, lng })); }
