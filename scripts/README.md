# Scripts Directory - Administrative Tools

Эта папка содержит административные инструменты для управления проектом VAPI Analytics.

## Структура по философии CLAUDE.md

```
scripts/
├── admin/           - Административные утилиты
│   ├── check_analysis_status.js    - Проверка статуса анализа
│   ├── monitor_qci_progress.js     - Мониторинг прогресса QCI
│   ├── test_supabase_connection.js - Тест подключения к Supabase
│   ├── html_to_pdf.js             - PDF генератор
│   └── generate_dashboard_data.js  - Генератор данных для дашборда
```

## Production модули

Все основные функции перенесены в production модули:

- **VAPI Collection**: `production_scripts/vapi_collection/`
- **QCI Analysis**: `production_scripts/qci_analysis/`
- **Prompt Optimization**: `production_scripts/prompt_optimization/`
- **Shared Utilities**: `production_scripts/shared/`

## Архивированные компоненты

Дублирующие и устаревшие файлы перенесены в:
- `archive/scripts_duplicates/` - Основные дубли
- `archive/archived_modules/` - Модули с дублирующей функциональностью

## Использование

Все административные скрипты запускаются из корня проекта:
```bash
node scripts/admin/test_supabase_connection.js
```