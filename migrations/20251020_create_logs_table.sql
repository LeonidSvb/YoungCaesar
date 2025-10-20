-- ============================================
-- MIGRATION: Create logs table
-- Date: 2025-10-20
-- Description: Create detailed step-by-step logs table for run executions
--              Follows ChatGPT specification with improvements
-- ============================================

-- Create logs table
CREATE TABLE logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to parent run
  run_id uuid NOT NULL,

  -- Log entry details
  timestamp timestamptz DEFAULT now() NOT NULL,
  level text NOT NULL CHECK (level IN ('INFO', 'ERROR', 'WARNING', 'DEBUG')),
  step text NOT NULL,                    -- e.g., 'START', 'FETCH', 'ANALYZE', 'SAVE', 'END'
  message text NOT NULL,

  -- Flexible metadata
  meta jsonb DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX logs_run_id_idx ON logs(run_id);
CREATE INDEX logs_timestamp_idx ON logs(timestamp DESC);
CREATE INDEX logs_level_idx ON logs(level);

-- Add foreign key constraint to runs table
-- Note: Using legacy_id for now since existing runs have integer IDs
-- Future runs will use UUID id column
ALTER TABLE logs ADD CONSTRAINT logs_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE logs IS 'Detailed step-by-step logs for each run execution';
COMMENT ON COLUMN logs.run_id IS 'Foreign key to runs.id (UUID)';
COMMENT ON COLUMN logs.level IS 'Log level: INFO, ERROR, WARNING, DEBUG';
COMMENT ON COLUMN logs.step IS 'Step name for categorization (START, FETCH, ANALYZE, etc.)';
COMMENT ON COLUMN logs.message IS 'Human-readable log message';
COMMENT ON COLUMN logs.meta IS 'Additional structured data (e.g., {"count": 150, "cost": 2.5})';

-- Sample query to view logs for a specific run:
-- SELECT timestamp, level, step, message, meta
-- FROM logs
-- WHERE run_id = 'your-run-uuid'
-- ORDER BY timestamp ASC;
