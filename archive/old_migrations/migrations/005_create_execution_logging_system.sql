-- ============================================
-- EXECUTION LOGGING SYSTEM
-- Stores all script execution runs and detailed logs
-- ============================================

-- Main executions table
CREATE TABLE IF NOT EXISTS execution_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    script_type TEXT NOT NULL, -- 'vapi_collection', 'supabase_sync', 'qci_analysis', etc.
    execution_mode TEXT NOT NULL, -- 'api', 'terminal', 'cron'
    status TEXT NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'

    -- Configuration used
    config JSONB NOT NULL DEFAULT '{}',

    -- Results & Statistics
    results JSONB NOT NULL DEFAULT '{}',
    stats JSONB NOT NULL DEFAULT '{}',

    -- Execution metadata
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Error handling
    error_message TEXT,
    error_details JSONB,

    -- File outputs
    files_created TEXT[], -- Array of created file paths

    -- User context (for API calls)
    user_id TEXT,
    session_id TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detailed execution logs (for streaming logs)
CREATE TABLE IF NOT EXISTS execution_log_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    execution_id UUID REFERENCES execution_logs(id) ON DELETE CASCADE,

    log_level TEXT NOT NULL, -- 'info', 'warn', 'error', 'debug', 'success'
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',

    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_number INTEGER NOT NULL, -- For ordering

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_execution_logs_script_type ON execution_logs(script_type);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_started_at ON execution_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_execution_logs_session_id ON execution_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_execution_log_entries_execution_id ON execution_log_entries(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_entries_timestamp ON execution_log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_execution_log_entries_sequence ON execution_log_entries(execution_id, sequence_number);

-- RLS Policies (если нужны)
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_log_entries ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (можно ограничить позже)
CREATE POLICY "Allow all on execution_logs" ON execution_logs FOR ALL USING (true);
CREATE POLICY "Allow all on execution_log_entries" ON execution_log_entries FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE execution_logs IS 'Main table for tracking all script executions';
COMMENT ON TABLE execution_log_entries IS 'Detailed streaming logs for each execution';

COMMENT ON COLUMN execution_logs.script_type IS 'Type of script: vapi_collection, supabase_sync, qci_analysis, etc.';
COMMENT ON COLUMN execution_logs.execution_mode IS 'How script was executed: api, terminal, cron';
COMMENT ON COLUMN execution_logs.config IS 'Configuration parameters used for execution';
COMMENT ON COLUMN execution_logs.results IS 'Final results data (calls collected, synced, etc.)';
COMMENT ON COLUMN execution_logs.stats IS 'Performance statistics (duration, efficiency, etc.)';
COMMENT ON COLUMN execution_logs.files_created IS 'Array of file paths created during execution';

COMMENT ON COLUMN execution_log_entries.log_level IS 'Log level: info, warn, error, debug, success';
COMMENT ON COLUMN execution_log_entries.sequence_number IS 'Sequential number for proper log ordering';