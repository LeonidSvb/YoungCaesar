# Logs Directory

Система логирования для VAPI Analytics production скриптов.

## Структура

```
logs/
├── 2025-10-18.log          # Все логи за день (INFO, WARN, ERROR)
├── 2025-10-17.log          # Предыдущие дни
├── errors/                 # Отдельная папка только для ошибок
│   └── 2025-10-18.log      # Только ERROR логи
└── README.md               # Эта документация
```

## Формат логов

JSON format, одна строка = один лог:

```json
{
  "timestamp": "2025-10-18T08:53:37.026Z",
  "module": "vapi-collector",
  "level": "INFO",
  "message": "Синхронизация завершена",
  "stats": {
    "totalCalls": 8559,
    "newCalls": 12
  }
}
```

## Уровни логирования

- **INFO** - Информационные сообщения (прогресс, статистика)
- **WARN** - Предупреждения (не критично, но требует внимания)
- **ERROR** - Ошибки (критичные проблемы, сохраняются в logs/errors/)
- **DEBUG** - Отладочные сообщения (только при DEBUG=true)

## Модули использующие логирование

### Production Scripts
- `vapi-collector` - Сбор звонков из VAPI API
- `supabase-sync` - Синхронизация с Supabase
- `qci-analyzer` - QCI анализ звонков
- `prompt-optimizer` - Оптимизация промптов

### Запуск с логированием

```bash
# Обычный режим (только ERROR в консоли)
node production_scripts/vapi_collection/src/sync_to_supabase.js

# Режим отладки (все логи в консоли)
DEBUG=true node production_scripts/vapi_collection/src/sync_to_supabase.js
```

## Пример использования в коде

```javascript
const { Logger } = require('./production_scripts/shared/logger.js');
const logger = new Logger('my-module');

logger.info('Процесс запущен');
logger.info('Обработано записей', { count: 100 });
logger.warn('Низкая скорость', { rate: 0.5 });
logger.error('Ошибка соединения', new Error('Connection timeout'));
```

## Ротация логов

Логи сохраняются автоматически по датам. Старые логи можно архивировать вручную:
- Файлы старше 30 дней можно удалять
- Или переместить в `logs/archive/`

## Мониторинг

Для просмотра логов в реальном времени:

```bash
# Windows
Get-Content logs\2025-10-18.log -Wait

# Linux/Mac
tail -f logs/2025-10-18.log

# Только ошибки
tail -f logs/errors/2025-10-18.log
```

## Анализ логов

Поиск конкретных событий:

```bash
# Найти все ошибки
grep '"level":"ERROR"' logs/2025-10-18.log

# Статистика по уровням
grep -o '"level":"[^"]*"' logs/2025-10-18.log | sort | uniq -c

# Логи конкретного модуля
grep '"module":"qci-analyzer"' logs/2025-10-18.log
```

## Сравнение с Shadi - new

**VAPI (этот проект):**
- Логи от production скриптов (Node.js CLI)
- JSON формат для парсинга
- Ручной запуск скриптов создает логи

**Shadi - new:**
- Логи от Next.js API routes (веб-приложение)
- Автоматическое логирование при HTTP запросах
- Логи создаются постоянно пока работает сервер

**Решение:** Запускайте production скрипты чтобы генерировать логи!
