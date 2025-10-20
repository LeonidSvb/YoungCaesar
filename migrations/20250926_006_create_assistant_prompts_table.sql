-- ============================================
-- ASSISTANT PROMPTS TABLE
-- Stores VAPI assistant prompts for analysis
-- ============================================

CREATE TABLE IF NOT EXISTS assistant_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Assistant identification
    assistant_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,

    -- Prompt content
    prompt TEXT NOT NULL DEFAULT '',

    -- Configuration
    model TEXT DEFAULT 'unknown',
    voice_provider TEXT DEFAULT 'unknown',

    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT assistant_prompts_assistant_id_key UNIQUE (assistant_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assistant_prompts_assistant_id ON assistant_prompts(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_prompts_updated_at ON assistant_prompts(updated_at);
CREATE INDEX IF NOT EXISTS idx_assistant_prompts_name ON assistant_prompts(name);

-- RLS Policies
ALTER TABLE assistant_prompts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now
CREATE POLICY "Allow all on assistant_prompts" ON assistant_prompts FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE assistant_prompts IS 'VAPI assistant prompts storage for optimization analysis';
COMMENT ON COLUMN assistant_prompts.assistant_id IS 'VAPI assistant unique identifier';
COMMENT ON COLUMN assistant_prompts.prompt IS 'Full system prompt text';
COMMENT ON COLUMN assistant_prompts.model IS 'AI model used (gpt-4, etc.)';
COMMENT ON COLUMN assistant_prompts.voice_provider IS 'Voice provider (elevenlabs, etc.)';