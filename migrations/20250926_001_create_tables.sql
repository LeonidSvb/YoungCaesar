-- ============================================================
-- VAPI Analytics Database Schema
-- Миграция 001: Создание основных таблиц
-- ============================================================

-- Включаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- 1. ORGANIZATIONS - Организации/Клиенты
-- ============================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vapi_org_id UUID UNIQUE, -- из VAPI API
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT organizations_name_check CHECK (LENGTH(name) > 0)
);

-- Создаем триггер для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. PHONE_NUMBERS - Телефонные номера
-- ============================================================
CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vapi_phone_id UUID UNIQUE, -- из VAPI API
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    country_code VARCHAR(5),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT phone_numbers_phone_check CHECK (phone_number ~ '^[\+]?[1-9]\d{1,14}$')
);

-- ============================================================
-- 3. ASSISTANTS - AI Ассистенты
-- ============================================================
CREATE TABLE assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vapi_assistant_id UUID UNIQUE NOT NULL, -- из VAPI API
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    current_prompt_id UUID, -- будет заполнено после создания prompts
    configuration JSONB DEFAULT '{}', -- полная VAPI конфигурация
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT assistants_name_check CHECK (LENGTH(name) > 0)
);

CREATE TRIGGER update_assistants_updated_at
    BEFORE UPDATE ON assistants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. PROMPTS - Версии промптов
-- ============================================================
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID, -- кто создал промпт
    performance_notes TEXT,

    CONSTRAINT prompts_version_positive CHECK (version > 0),
    CONSTRAINT prompts_content_check CHECK (LENGTH(content) > 0),
    UNIQUE(assistant_id, version)
);

-- Только один промпт может быть текущим для каждого ассистента
CREATE UNIQUE INDEX idx_prompts_current_unique
ON prompts(assistant_id)
WHERE is_current = TRUE;

-- ============================================================
-- 5. CALLS - Основная таблица звонков ⭐
-- ============================================================
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vapi_call_id UUID UNIQUE NOT NULL, -- из VAPI API
    assistant_id UUID REFERENCES assistants(id),
    phone_number_id UUID REFERENCES phone_numbers(id),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Метаданные звонка
    call_type VARCHAR(50) NOT NULL, -- 'inbound', 'outbound'
    status VARCHAR(50) NOT NULL, -- 'ended', 'in-progress', etc.
    ended_reason VARCHAR(100),

    -- Временные метки
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS
        (EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER) STORED,

    -- Контент
    transcript TEXT,
    summary TEXT,
    recording_url TEXT,

    -- Участники
    customer_number VARCHAR(20),
    customer_info JSONB DEFAULT '{}',

    -- Метрики
    cost DECIMAL(10,6),

    -- Системные поля
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB, -- полные сырые данные из VAPI

    CONSTRAINT calls_call_type_check CHECK (call_type IN ('inbound', 'outbound', 'outboundPhoneCall', 'inboundPhoneCall')),
    CONSTRAINT calls_cost_positive CHECK (cost >= 0),
    CONSTRAINT calls_duration_check CHECK (
        (ended_at IS NULL AND started_at IS NOT NULL) OR
        (ended_at IS NOT NULL AND started_at IS NOT NULL AND ended_at >= started_at)
    )
);

CREATE TRIGGER update_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. QCI_ANALYSES - Анализ качества звонков 🎯
-- ============================================================
CREATE TABLE qci_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE UNIQUE, -- один анализ на звонок
    assistant_id UUID REFERENCES assistants(id),

    -- QCI метрики (0-100)
    qci_total_score INTEGER CHECK (qci_total_score >= 0 AND qci_total_score <= 100),
    dynamics_score INTEGER CHECK (dynamics_score >= 0 AND dynamics_score <= 30),
    objections_score INTEGER CHECK (objections_score >= 0 AND objections_score <= 20),
    brand_score INTEGER CHECK (brand_score >= 0 AND brand_score <= 20),
    outcome_score INTEGER CHECK (outcome_score >= 0 AND outcome_score <= 30),

    -- Статус анализа
    status VARCHAR(20) DEFAULT 'pass' CHECK (status IN ('pass', 'review', 'fail')),

    -- Детальный анализ
    evidence JSONB DEFAULT '{}', -- agent_talk_ratio, brand_mentions, outcomes
    coaching_tips TEXT[],
    key_moments TEXT[],

    -- Метаданные анализа
    ai_model VARCHAR(50), -- 'gpt-4o-mini', 'gpt-4o'
    analysis_cost DECIMAL(10,6) CHECK (analysis_cost >= 0),
    tokens_used INTEGER CHECK (tokens_used >= 0),
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),

    raw_analysis JSONB -- полный ответ от AI
);

-- ============================================================
-- 7. PROMPT_OPTIMIZATIONS - Оптимизация промптов 🚀
-- ============================================================
CREATE TABLE prompt_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
    original_prompt_id UUID REFERENCES prompts(id),

    -- Текущая производительность
    current_performance JSONB DEFAULT '{}', -- avg_qci, total_calls, success_rate, etc.

    -- Рекомендации
    target_qci INTEGER CHECK (target_qci >= 0 AND target_qci <= 100),
    improvement_potential VARCHAR(50), -- "+15 points"
    primary_focus_area TEXT,
    recommended_prompt TEXT,

    -- Рекомендации Hormozi
    hormozi_recommendations JSONB DEFAULT '[]',
    implementation_plan JSONB DEFAULT '{}',

    -- Метаданные
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    ai_model VARCHAR(50),
    analysis_cost DECIMAL(10,6) CHECK (analysis_cost >= 0),
    is_implemented BOOLEAN DEFAULT FALSE,
    implementation_date TIMESTAMPTZ,

    raw_recommendations JSONB -- полный анализ
);

-- ============================================================
-- 8. CALL_PARTICIPANTS - Участники звонков (опционально)
-- ============================================================
CREATE TABLE call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('agent', 'customer', 'transfer')),
    participant_name VARCHAR(255),
    phone_number VARCHAR(20),
    join_time TIMESTAMPTZ,
    leave_time TIMESTAMPTZ,
    talk_time_seconds INTEGER CHECK (talk_time_seconds >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT call_participants_time_check CHECK (
        (leave_time IS NULL AND join_time IS NOT NULL) OR
        (leave_time IS NOT NULL AND join_time IS NOT NULL AND leave_time >= join_time)
    )
);

-- ============================================================
-- ДОБАВЛЯЕМ FOREIGN KEY для current_prompt_id
-- ============================================================
ALTER TABLE assistants
ADD CONSTRAINT fk_assistants_current_prompt
FOREIGN KEY (current_prompt_id) REFERENCES prompts(id);

-- ============================================================
-- КОММЕНТАРИИ К ТАБЛИЦАМ
-- ============================================================
COMMENT ON TABLE organizations IS 'Организации и клиенты для мультитенантности';
COMMENT ON TABLE assistants IS 'AI ассистенты с их конфигурацией';
COMMENT ON TABLE prompts IS 'Версионирование промптов для ассистентов';
COMMENT ON TABLE phone_numbers IS 'Телефонные номера для звонков';
COMMENT ON TABLE calls IS 'Основная таблица со всеми звонками VAPI';
COMMENT ON TABLE qci_analyses IS 'Анализ качества звонков (QCI метрики)';
COMMENT ON TABLE prompt_optimizations IS 'Рекомендации по оптимизации промптов';
COMMENT ON TABLE call_participants IS 'Участники звонков для детализации';