-- ============================================================
-- VAPI Analytics Database Schema
-- Миграция 002: Индексы и Row Level Security
-- ============================================================

-- ============================================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ============================================================

-- Organizations
CREATE INDEX idx_organizations_vapi_org_id ON organizations(vapi_org_id);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);

-- Assistants
CREATE INDEX idx_assistants_vapi_assistant_id ON assistants(vapi_assistant_id);
CREATE INDEX idx_assistants_organization_id ON assistants(organization_id);
CREATE INDEX idx_assistants_is_active ON assistants(is_active);

-- Prompts
CREATE INDEX idx_prompts_assistant_id ON prompts(assistant_id);
CREATE INDEX idx_prompts_version ON prompts(assistant_id, version DESC);
CREATE INDEX idx_prompts_created_at ON prompts(created_at DESC);

-- Phone Numbers
CREATE INDEX idx_phone_numbers_vapi_phone_id ON phone_numbers(vapi_phone_id);
CREATE INDEX idx_phone_numbers_organization_id ON phone_numbers(organization_id);
CREATE INDEX idx_phone_numbers_phone_number ON phone_numbers(phone_number);

-- Calls - основные индексы для аналитики ⭐
CREATE INDEX idx_calls_vapi_call_id ON calls(vapi_call_id);
CREATE INDEX idx_calls_assistant_id ON calls(assistant_id);
CREATE INDEX idx_calls_organization_id ON calls(organization_id);
CREATE INDEX idx_calls_phone_number_id ON calls(phone_number_id);

-- Индексы по времени (критично для дашбордов)
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_ended_at ON calls(ended_at DESC);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);

-- Индексы по статусу и типу
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_call_type ON calls(call_type);
CREATE INDEX idx_calls_ended_reason ON calls(ended_reason);

-- Индексы по метрикам
CREATE INDEX idx_calls_cost ON calls(cost DESC);
CREATE INDEX idx_calls_duration_seconds ON calls(duration_seconds DESC);

-- Составные индексы для сложных запросов
CREATE INDEX idx_calls_assistant_started_at ON calls(assistant_id, started_at DESC);
CREATE INDEX idx_calls_organization_started_at ON calls(organization_id, started_at DESC);
CREATE INDEX idx_calls_status_started_at ON calls(status, started_at DESC);

-- Частичные индексы для активных данных
CREATE INDEX idx_calls_active ON calls(started_at DESC) WHERE status = 'ended';
CREATE INDEX idx_calls_with_transcript ON calls(id) WHERE transcript IS NOT NULL;
CREATE INDEX idx_calls_expensive ON calls(cost DESC) WHERE cost > 0.1;

-- QCI Analyses - индексы для аналитики ⭐
CREATE INDEX idx_qci_analyses_call_id ON qci_analyses(call_id);
CREATE INDEX idx_qci_analyses_assistant_id ON qci_analyses(assistant_id);

-- Индексы по QCI метрикам (для ранжирования)
CREATE INDEX idx_qci_analyses_qci_total_score ON qci_analyses(qci_total_score DESC);
CREATE INDEX idx_qci_analyses_dynamics_score ON qci_analyses(dynamics_score DESC);
CREATE INDEX idx_qci_analyses_objections_score ON qci_analyses(objections_score DESC);
CREATE INDEX idx_qci_analyses_brand_score ON qci_analyses(brand_score DESC);
CREATE INDEX idx_qci_analyses_outcome_score ON qci_analyses(outcome_score DESC);

-- Индексы по статусу и времени
CREATE INDEX idx_qci_analyses_status ON qci_analyses(status);
CREATE INDEX idx_qci_analyses_analyzed_at ON qci_analyses(analyzed_at DESC);

-- Составные индексы для аналитики
CREATE INDEX idx_qci_analyses_assistant_score ON qci_analyses(assistant_id, qci_total_score DESC);
CREATE INDEX idx_qci_analyses_assistant_analyzed_at ON qci_analyses(assistant_id, analyzed_at DESC);

-- Prompt Optimizations
CREATE INDEX idx_prompt_optimizations_assistant_id ON prompt_optimizations(assistant_id);
CREATE INDEX idx_prompt_optimizations_original_prompt_id ON prompt_optimizations(original_prompt_id);
CREATE INDEX idx_prompt_optimizations_generated_at ON prompt_optimizations(generated_at DESC);
CREATE INDEX idx_prompt_optimizations_is_implemented ON prompt_optimizations(is_implemented);
CREATE INDEX idx_prompt_optimizations_target_qci ON prompt_optimizations(target_qci DESC);

-- Call Participants
CREATE INDEX idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX idx_call_participants_participant_type ON call_participants(participant_type);
CREATE INDEX idx_call_participants_join_time ON call_participants(join_time DESC);

-- ============================================================
-- ПОЛНОТЕКСТОВЫЙ ПОИСК
-- ============================================================

-- Добавляем tsvector колонки для поиска
ALTER TABLE calls ADD COLUMN search_vector tsvector;

-- Индекс для полнотекстового поиска по transcript и summary
CREATE INDEX idx_calls_search_vector ON calls USING GIN(search_vector);

-- Функция для обновления search_vector
CREATE OR REPLACE FUNCTION update_calls_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.transcript, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.customer_number, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления search_vector
CREATE TRIGGER update_calls_search_vector_trigger
    BEFORE INSERT OR UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_calls_search_vector();

-- ============================================================
-- МАТЕРИАЛИЗОВАННЫЕ ПРЕДСТАВЛЕНИЯ ДЛЯ АНАЛИТИКИ
-- ============================================================

-- Ежедневная статистика по ассистентам
CREATE MATERIALIZED VIEW daily_assistant_stats AS
SELECT
    a.id as assistant_id,
    a.name as assistant_name,
    DATE_TRUNC('day', c.started_at) as date,
    COUNT(c.id) as total_calls,
    AVG(c.cost) as avg_cost,
    SUM(c.cost) as total_cost,
    AVG(c.duration_seconds) as avg_duration,
    AVG(q.qci_total_score) as avg_qci,
    COUNT(CASE WHEN q.status = 'pass' THEN 1 END) as pass_count,
    COUNT(CASE WHEN q.status = 'fail' THEN 1 END) as fail_count
FROM assistants a
LEFT JOIN calls c ON a.id = c.assistant_id
LEFT JOIN qci_analyses q ON c.id = q.call_id
WHERE c.started_at IS NOT NULL
  AND c.status = 'ended'
GROUP BY a.id, a.name, DATE_TRUNC('day', c.started_at);

-- Индексы для материализованного представления
CREATE UNIQUE INDEX idx_daily_assistant_stats_unique
ON daily_assistant_stats(assistant_id, date);

CREATE INDEX idx_daily_assistant_stats_date ON daily_assistant_stats(date DESC);
CREATE INDEX idx_daily_assistant_stats_avg_qci ON daily_assistant_stats(avg_qci DESC);

-- Функция для обновления материализованных представлений
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_assistant_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) 🔒
-- ============================================================

-- Включаем RLS для всех основных таблиц
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE qci_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- Функция для получения текущей организации пользователя
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_org_id', true)::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Политики для organizations
CREATE POLICY "Users can view own organization" ON organizations
    FOR SELECT USING (id = current_user_org_id());

CREATE POLICY "Users can update own organization" ON organizations
    FOR UPDATE USING (id = current_user_org_id());

-- Политики для assistants
CREATE POLICY "Users can view own assistants" ON assistants
    FOR SELECT USING (organization_id = current_user_org_id());

CREATE POLICY "Users can manage own assistants" ON assistants
    FOR ALL USING (organization_id = current_user_org_id());

-- Политики для calls (основная таблица)
CREATE POLICY "Users can view own calls" ON calls
    FOR SELECT USING (organization_id = current_user_org_id());

CREATE POLICY "Users can insert own calls" ON calls
    FOR INSERT WITH CHECK (organization_id = current_user_org_id());

-- Политики для qci_analyses
CREATE POLICY "Users can view own qci analyses" ON qci_analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM calls c
            WHERE c.id = qci_analyses.call_id
            AND c.organization_id = current_user_org_id()
        )
    );

-- Политики для prompts
CREATE POLICY "Users can view own prompts" ON prompts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assistants a
            WHERE a.id = prompts.assistant_id
            AND a.organization_id = current_user_org_id()
        )
    );

-- Политики для phone_numbers
CREATE POLICY "Users can view own phone numbers" ON phone_numbers
    FOR SELECT USING (organization_id = current_user_org_id());

-- Политики для prompt_optimizations
CREATE POLICY "Users can view own prompt optimizations" ON prompt_optimizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assistants a
            WHERE a.id = prompt_optimizations.assistant_id
            AND a.organization_id = current_user_org_id()
        )
    );

-- Политики для call_participants
CREATE POLICY "Users can view own call participants" ON call_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM calls c
            WHERE c.id = call_participants.call_id
            AND c.organization_id = current_user_org_id()
        )
    );

-- ============================================================
-- ФУНКЦИИ ДЛЯ АНАЛИТИКИ
-- ============================================================

-- Функция для получения статистики ассистента
CREATE OR REPLACE FUNCTION get_assistant_stats(
    assistant_uuid UUID,
    date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    total_calls BIGINT,
    avg_qci NUMERIC,
    avg_cost NUMERIC,
    avg_duration NUMERIC,
    pass_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(c.id) as total_calls,
        ROUND(AVG(q.qci_total_score), 2) as avg_qci,
        ROUND(AVG(c.cost), 4) as avg_cost,
        ROUND(AVG(c.duration_seconds), 0) as avg_duration,
        ROUND(
            (COUNT(CASE WHEN q.status = 'pass' THEN 1 END) * 100.0) /
            NULLIF(COUNT(q.id), 0), 2
        ) as pass_rate
    FROM calls c
    LEFT JOIN qci_analyses q ON c.id = q.call_id
    WHERE c.assistant_id = assistant_uuid
      AND c.started_at BETWEEN date_from AND date_to
      AND c.status = 'ended';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- КОММЕНТАРИИ
-- ============================================================
COMMENT ON MATERIALIZED VIEW daily_assistant_stats IS 'Ежедневная статистика по производительности ассистентов';
COMMENT ON FUNCTION get_assistant_stats IS 'Получение агрегированной статистики по ассистенту за период';
COMMENT ON FUNCTION current_user_org_id IS 'Получение ID организации текущего пользователя для RLS';