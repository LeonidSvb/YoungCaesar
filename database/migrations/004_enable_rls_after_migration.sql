-- ============================================================
-- Включение RLS обратно после миграции данных
-- Выполните это в Supabase SQL Editor после завершения миграции
-- ============================================================

-- Включаем RLS обратно для всех таблиц
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE qci_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- Обновляем материализованные представления
SELECT refresh_analytics_views();

-- Проверяем количество загруженных данных
SELECT
    'calls' as table_name, COUNT(*) as count FROM calls
UNION ALL
SELECT
    'qci_analyses' as table_name, COUNT(*) FROM qci_analyses
UNION ALL
SELECT
    'assistants' as table_name, COUNT(*) FROM assistants
UNION ALL
SELECT
    'organizations' as table_name, COUNT(*) FROM organizations;

SELECT 'RLS включен обратно, миграция завершена' as status;