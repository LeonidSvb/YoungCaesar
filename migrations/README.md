# Database Migrations

## Overview

This directory contains all database migrations for the VAPI Analytics project in chronological order using timestamp format (`YYYYMMDD_NNN_description.sql`).

## Migration Format

**Format:** `YYYYMMDD_NNN_description.sql`
- `YYYYMMDD` - Date when migration was created
- `NNN` - Sequential number (for migrations from same day)
- `description` - Brief description of changes

This follows industry standards (Rails, Supabase, Sequelize) and ensures:
- Chronological ordering
- No conflicts in team environments
- Easy tracking of when changes were made

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/ufickndxlqlwgjmcfgii
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the content of the migration file
5. Click **Run**

### Option 2: Via Supabase CLI

```bash
supabase db execute --file migrations/YYYYMMDD_NNN_description.sql
```

### Option 3: Via psql

```bash
psql "postgresql://postgres:[PASSWORD]@db.ufickndxlqlwgjmcfgii.supabase.co:5432/postgres" \
  -f migrations/YYYYMMDD_NNN_description.sql
```

## Migration History

### September 26, 2025 - Initial Schema
- ✅ **001_create_tables.sql** - Create core tables (vapi_calls_raw, qci_analyses, etc.)
- ✅ **002_create_indexes_and_rls.sql** - Add indexes and Row Level Security
- ✅ **003_disable_rls_for_migration.sql** - Temporarily disable RLS for data migration
- ✅ **004_enable_rls_after_migration.sql** - Re-enable RLS after migration
- ✅ **005_create_execution_logging_system.sql** - Create execution_logs tables
- ✅ **006_create_assistant_prompts_table.sql** - Add assistant prompts tracking

### October 17, 2025 - Dashboard & Analytics
- ✅ **007_create_dashboard_rpc_functions.sql** - Add RPC functions for dashboard
- ✅ **008_add_conversion_indexes_and_functions.sql** - Add conversion tracking
- ✅ **008_create_dashboard_views.sql** - Create dashboard views
- ✅ **009_fix_rpc_functions_column_names.sql** - Fix column naming in RPC functions

### October 18, 2025 - Tool Tracking
- ✅ **010_fix_assistant_breakdown.sql** - Fix assistant breakdown view
- ⏳ **082524_add_tool_tracking_columns.sql** - Add tool tracking columns
- ⏳ **082631_add_tool_tracking_indexes.sql** - Add tool tracking indexes

### October 20, 2025 - Cron Logging System
- ✅ **011_fix_quality_badge_logic.sql** - Fix quality badge calculation
- ✅ **012_fix_rpc_table_names.sql** - Fix RPC function table references
- ⏳ **transform_sync_logs_to_runs.sql** - Transform sync_logs → runs (universal logging)
- ⏳ **create_logs_table.sql** - Create detailed logs table for step-by-step tracking

**Legend:**
- ✅ Already applied
- ⏳ Pending (need to be applied manually)

## Current Schema

After all migrations are applied, the database will have:

**Core Tables:**
- `vapi_calls_raw` - Raw VAPI call data
- `qci_analyses` - Quality Call Index analyses
- `vapi_assistants` - VAPI assistant configurations
- `assistant_prompts` - Assistant prompt history

**Logging Tables:**
- `runs` - Execution tracking for all cron jobs (sync, analysis, optimization)
- `logs` - Detailed step-by-step logs for each run

**Dashboard Tables:**
- `call_conversions` - Call conversion tracking
- `qci_frameworks` - QCI framework definitions

## Verification Queries

After applying migrations, verify with:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check runs table
SELECT id, script_name, status, started_at
FROM runs
ORDER BY started_at DESC
LIMIT 5;

-- Check logs table
SELECT COUNT(*) as total_logs FROM logs;
```

## Rollback

To rollback the latest migrations (October 20):

```sql
-- Rollback logs table
DROP TABLE IF EXISTS logs CASCADE;

-- Rollback runs transformation (restore sync_logs)
-- (See individual migration file for detailed rollback steps)
```

## Archive

Old migrations in legacy format (001, 002, etc.) have been moved to:
`archive/old_migrations/data/migrations/`

These are kept for historical reference only.

## Support

For issues with migrations:
1. Check that you have proper permissions (use SERVICE_ROLE_KEY)
2. Verify database connection
3. Check migration order (must be applied sequentially)
4. Review Supabase logs for detailed error messages
