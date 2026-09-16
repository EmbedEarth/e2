export const schema = `
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY, feature_id INTEGER NOT NULL, feature TEXT NOT NULL, name TEXT,
  e2_id TEXT NOT NULL, base_e2_id TEXT NOT NULL, h3 TEXT NOT NULL,
  temporal_resolution TEXT NOT NULL, temporal_bucket TEXT NOT NULL,
  observed_at TEXT, lat REAL NOT NULL, lng REAL NOT NULL, geometry_json TEXT,
  source TEXT NOT NULL, source_id TEXT NOT NULL, country_region_id TEXT,
  state_region_id TEXT, city_region_id TEXT, region_type TEXT, properties_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_obs_feature ON observations(feature_id);
CREATE INDEX IF NOT EXISTS idx_obs_h3 ON observations(h3);
CREATE INDEX IF NOT EXISTS idx_obs_city ON observations(city_region_id);
CREATE INDEX IF NOT EXISTS idx_obs_state ON observations(state_region_id);
CREATE INDEX IF NOT EXISTS idx_obs_country ON observations(country_region_id);
CREATE INDEX IF NOT EXISTS idx_obs_feature_city ON observations(feature_id, city_region_id);
CREATE INDEX IF NOT EXISTS idx_obs_feature_state ON observations(feature_id, state_region_id);
CREATE INDEX IF NOT EXISTS idx_obs_feature_country ON observations(feature_id, country_region_id);`;
