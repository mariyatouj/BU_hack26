-- Optional Tiger Data (TimescaleDB) upgrades. Run once after the API has created its tables
-- (start the API with DATABASE_URL pointing at Tiger Data, then: psql "$DATABASE_URL" -f sql/tiger_setup.sql)

-- Inventory observations and the points ledger are append-only time series.
-- Hypertables need the time column in the primary key.
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_pkey;
ALTER TABLE inventory_items ADD PRIMARY KEY (id, updated_at);
SELECT create_hypertable('inventory_items', 'updated_at', migrate_data => true, if_not_exists => true);

ALTER TABLE point_events DROP CONSTRAINT IF EXISTS point_events_pkey;
ALTER TABLE point_events ADD PRIMARY KEY (id, created_at);
SELECT create_hypertable('point_events', 'created_at', migrate_data => true, if_not_exists => true);

-- Ingredient availability over time, per pantry (for "track ingredient availability" charts).
CREATE OR REPLACE VIEW ingredient_availability_daily AS
SELECT time_bucket('1 day', updated_at) AS day,
       pantry_id,
       name,
       max(CASE level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) AS best_level
FROM inventory_items
GROUP BY 1, 2, 3;

-- Weekly points per user (leaderboard history / weekly winners).
CREATE OR REPLACE VIEW weekly_points AS
SELECT time_bucket('7 days', created_at) AS week, user_id, sum(points) AS points
FROM point_events
GROUP BY 1, 2;
