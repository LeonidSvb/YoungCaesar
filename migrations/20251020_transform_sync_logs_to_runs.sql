-- ============================================
-- MIGRATION: Transform sync_logs to runs
-- Date: 2025-10-20
-- Description: Rename and adapt sync_logs table to universal runs table
--              for all cron job types (sync, analysis, optimization)
-- ============================================

-- Step 1: Rename table
ALTER TABLE sync_logs RENAME TO runs;

-- Step 2: Add UUID primary key (keep old integer id as legacy_id)
ALTER TABLE runs RENAME COLUMN id TO legacy_id;
ALTER TABLE runs ADD COLUMN id uuid DEFAULT gen_random_uuid();

-- Step 3: Rename columns to standard names
ALTER TABLE runs RENAME COLUMN object_type TO script_name;
ALTER TABLE runs RENAME COLUMN sync_started_at TO started_at;
ALTER TABLE runs RENAME COLUMN sync_completed_at TO finished_at;

-- Step 4: Convert duration_seconds to duration_ms
ALTER TABLE runs ADD COLUMN duration_ms integer;
UPDATE runs SET duration_ms = duration_seconds * 1000;
ALTER TABLE runs DROP COLUMN duration_seconds;

-- Step 5: Add new columns for QCI analysis metrics
ALTER TABLE runs ADD COLUMN calls_analyzed integer;
ALTER TABLE runs ADD COLUMN api_cost numeric(10,4);

-- Step 6: Add metadata JSONB for flexible data
ALTER TABLE runs ADD COLUMN metadata jsonb DEFAULT '{}';

-- Step 7: Update constraints
ALTER TABLE runs ALTER COLUMN script_name SET NOT NULL;
ALTER TABLE runs ALTER COLUMN status SET NOT NULL;
ALTER TABLE runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('running', 'success', 'error'));

-- Step 8: Create indexes
CREATE INDEX runs_script_name_idx ON runs(script_name);
CREATE INDEX runs_started_at_idx ON runs(started_at DESC);
CREATE INDEX runs_status_idx ON runs(status);
CREATE INDEX runs_batch_id_idx ON runs(batch_id);

-- Step 9: Set default value for triggered_by if NULL
UPDATE runs SET triggered_by = 'manual' WHERE triggered_by IS NULL;

-- Step 10: Add comments for documentation
COMMENT ON TABLE runs IS 'Universal execution tracking for all cron jobs (sync, analysis, optimization)';
COMMENT ON COLUMN runs.id IS 'UUID primary key for new records';
COMMENT ON COLUMN runs.legacy_id IS 'Old integer ID from sync_logs (for backward compatibility)';
COMMENT ON COLUMN runs.script_name IS 'Script type: vapi-sync, qci-analysis, prompt-optimizer';
COMMENT ON COLUMN runs.status IS 'Execution status: running, success, error';
COMMENT ON COLUMN runs.batch_id IS 'UUID for grouping related operations';
COMMENT ON COLUMN runs.records_fetched IS 'Data sync metric: records fetched from API';
COMMENT ON COLUMN runs.records_inserted IS 'Data sync metric: records inserted to DB';
COMMENT ON COLUMN runs.records_updated IS 'Data sync metric: records updated in DB';
COMMENT ON COLUMN runs.records_failed IS 'Data sync metric: records that failed';
COMMENT ON COLUMN runs.calls_analyzed IS 'QCI analysis metric: number of calls analyzed';
COMMENT ON COLUMN runs.api_cost IS 'QCI/AI metric: OpenAI API cost in USD';
COMMENT ON COLUMN runs.metadata IS 'Flexible JSONB field for additional metrics';

-- Verification query (run after migration)
-- SELECT id, script_name, status, started_at, duration_ms,
--        records_fetched, calls_analyzed, api_cost
-- FROM runs
-- ORDER BY started_at DESC
-- LIMIT 5;
