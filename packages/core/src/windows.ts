import { parseTime } from "./validation.js";
export type QueryWindow = "30d" | "90d" | "1y" | "all";
export function resolveWindow(window: QueryWindow, now: Date | string | number = new Date()): { start: Date | null; end: Date } {
  const end = parseTime(now); if (window === "all") return { start: null, end };
  const days = window === "30d" ? 30 : window === "90d" ? 90 : 365;
  return { start: new Date(end.getTime() - days * 86_400_000), end };
}
