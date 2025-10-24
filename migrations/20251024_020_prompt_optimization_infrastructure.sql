-- Migration: Prompt Optimization Infrastructure
-- Date: 2024-10-24
-- Purpose: Create tables and views for prompt optimization based on QCI analysis

-- ============================================================
-- 1. CREATE TABLE: prompt_analysis_results
-- ============================================================
-- Stores results of prompt optimization analysis

CREATE TABLE IF NOT EXISTS prompt_analysis_results (
  id BIGSERIAL PRIMARY KEY,

  -- Link to assistant
  assistant_id TEXT NOT NULL
    REFERENCES vapi_assistants(assistant_id) ON DELETE CASCADE,

  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PROMPTS (main result)
  current_prompt TEXT NOT NULL,
  proposed_prompt TEXT NOT NULL,

  -- METRICS (justification for changes)
  current_qci NUMERIC(5,2),
  expected_qci NUMERIC(5,2),
  improvement_delta NUMERIC(5,2),

  -- TOP reasons for changes
  top_reasons TEXT[],

  -- CONTEXT of analysis
  calls_analyzed INTEGER NOT NULL,
  sample_call_ids TEXT[] NOT NULL,
  framework_used TEXT NOT NULL DEFAULT 'qci',

  -- AI metrics
  analysis_cost NUMERIC(10,6),
  analysis_model TEXT
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_prompt_analysis_assistant
  ON prompt_analysis_results(assistant_id);

CREATE INDEX IF NOT EXISTS idx_prompt_analysis_date
  ON prompt_analysis_results(analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_analysis_framework
  ON prompt_analysis_results(framework_used);

-- Comments
COMMENT ON TABLE prompt_analysis_results IS
'Results of assistant prompt analysis and optimization';

COMMENT ON COLUMN prompt_analysis_results.current_prompt IS
'Original prompt that was analyzed';

COMMENT ON COLUMN prompt_analysis_results.proposed_prompt IS
'Optimized prompt (analysis result)';

COMMENT ON COLUMN prompt_analysis_results.top_reasons IS
'3-5 main reasons why prompt was changed';

COMMENT ON COLUMN prompt_analysis_results.sample_call_ids IS
'IDs of calls used for analysis (reproducibility)';

-- ============================================================
-- 2. RENAME TABLE: qci_frameworks -> analysis_frameworks
-- ============================================================
-- Make framework table universal for all analysis types

ALTER TABLE IF EXISTS qci_frameworks RENAME TO analysis_frameworks;

-- Add framework type column
ALTER TABLE analysis_frameworks
ADD COLUMN IF NOT EXISTS framework_type TEXT NOT NULL DEFAULT 'analysis'
CHECK (framework_type IN ('analysis', 'optimization'));

-- Update foreign key constraints
ALTER TABLE qci_analyses
DROP CONSTRAINT IF EXISTS qci_analyses_framework_id_fkey;

ALTER TABLE qci_analyses
ADD CONSTRAINT qci_analyses_framework_id_fkey
FOREIGN KEY (framework_id) REFERENCES analysis_frameworks(id);

-- Update comments
COMMENT ON TABLE analysis_frameworks IS
'Universal frameworks: call analysis (QCI, SPIN) and prompt optimization';

COMMENT ON COLUMN analysis_frameworks.framework_type IS
'analysis - for call analysis, optimization - for prompt optimization';

COMMENT ON COLUMN analysis_frameworks.name IS
'Framework name (QCI Standard, SPIN Selling, Prompt Optimizer, etc)';

-- ============================================================
-- 3. INSERT: Prompt Optimizer Framework
-- ============================================================

INSERT INTO analysis_frameworks (
  name,
  version,
  description,
  prompt_template,
  framework_type,
  model_config,
  is_active,
  created_by
)
SELECT
  'Prompt Optimizer - QCI',
  'v1.0',
  'AI-powered prompt optimization based on QCI performance analysis and Alex Hormozi Value Equation',
  '# PROMPT OPTIMIZATION ENGINE

You are an expert prompt optimizer for VAPI conversational AI. Optimize the assistant prompt to improve QCI scores.

## ASSISTANT PERFORMANCE:
- Name: {assistant_name}
- Current QCI: {current_qci}/100
- Target QCI: {target_qci}/100
- Calls Analyzed: {calls_analyzed}

**Current Scores:**
- Dynamics: {dynamics_score}/30
- Objections: {objections_score}/20
- Brand: {brand_score}/20
- Outcome: {outcome_score}/30

## SAMPLE CALLS:
{sample_calls}

## CURRENT PROMPT:
{current_prompt}

## TASK:
1. Analyze weaknesses in the current prompt
2. Generate 3-5 specific improvements following Alex Hormozi Value Equation
3. Create complete optimized prompt

## OUTPUT (JSON):
{
  "current_qci": {current_qci},
  "expected_qci": {target_qci},
  "improvement_delta": "+15 points",
  "top_reasons": [
    "Reason 1 why prompt was changed",
    "Reason 2 why prompt was changed",
    "Reason 3 why prompt was changed"
  ],
  "proposed_prompt": "Complete optimized prompt text here..."
}',
  'optimization',
  '{"model": "gpt-4o", "temperature": 0.2, "max_tokens": 4000}'::jsonb,
  true,
  'system'
WHERE NOT EXISTS (
  SELECT 1 FROM analysis_frameworks
  WHERE name = 'Prompt Optimizer - QCI'
);

-- ============================================================
-- 4. NO VIEWS NEEDED
-- ============================================================
-- All queries will be done directly in the script
-- Views should only be created for business entities, not for query convenience
