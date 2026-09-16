export const E2_VERSION = 1 as const;
export const E2_EPOCH = "1970-01-05T00:00:00.000Z";
export const E2_EPOCH_MS = Date.parse(E2_EPOCH);

export const TEMPORAL_DURATIONS = {
  "1s": 1,
  "10s": 10,
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "6h": 21_600,
  "1d": 86_400,
  "7d": 604_800,
} as const;

export type TemporalResolution = keyof typeof TEMPORAL_DURATIONS;
export const TEMPORAL_RESOLUTIONS = Object.keys(TEMPORAL_DURATIONS) as TemporalResolution[];
