-- ============================================================
-- Временное отключение RLS для миграции данных
-- Выполните это в Supabase SQL Editor перед миграцией
-- ============================================================

-- Отключаем RLS для всех таблиц
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE assistants DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompts DISABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE qci_analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_optimizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants DISABLE ROW LEVEL SECURITY;

-- Создаем дефолтную организацию для миграции
INSERT INTO organizations (id, name, vapi_org_id, settings)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Default Organization',
    NULL,
    '{}'
) ON CONFLICT (id) DO NOTHING;

SELECT 'RLS отключен для миграции данных' as status;