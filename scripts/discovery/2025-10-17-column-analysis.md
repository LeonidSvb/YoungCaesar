# Анализ колонок vapi_calls_raw

## Существующие 24 колонки - нужны ли?

| Колонка | Нужна? | Почему? | Решение |
|---------|--------|---------|---------|
| **id** | ✅ ДА | Primary key, JOIN с qci_analyses | ОСТАВИТЬ |
| **assistant_id** | ✅ ДА | Фильтр "показать звонки ассистента X", JOIN с vapi_assistants | ОСТАВИТЬ |
| **customer_id** | ❓ МОЖЕТ | Для группировки по клиентам? | ОБСУДИТЬ |
| **org_id** | ❌ НЕТ | Всегда одна организация, не фильтруем | → raw_json |
| **type** | ❌ НЕТ | Всегда "outboundPhoneCall", не фильтруем | → raw_json |
| **status** | ✅ ДА | Фильтр "ended/active", aggregation COUNT по статусам | ОСТАВИТЬ |
| **ended_reason** | ✅ ДА | Фильтр "customer-busy vs meeting-booked", success rate | ОСТАВИТЬ |
| **started_at** | ✅ ДА | ORDER BY для timeline, фильтр по датам, aggregation по дням | ОСТАВИТЬ |
| **ended_at** | ❓ МОЖЕТ | Можем вычислить duration из started_at + duration_seconds | ОБСУДИТЬ |
| **created_at** | ✅ ДА | Основной ORDER BY, индекс для incremental sync | ОСТАВИТЬ |
| **transcript** | ✅ ДА | Full-text search (GIN index), показ на dashboard | ОСТАВИТЬ |
| **summary** | ❌ НЕТ | Редко используется, можем взять из raw_json | → raw_json |
| **cost** | ✅ ДА | SUM, AVG, фильтр "дорогие звонки > $0.10" | ОСТАВИТЬ |
| **customer_phone_number** | ✅ ДА | Фильтр по клиенту, группировка по номерам | ОСТАВИТЬ |
| **raw_json** | ✅ ДА | Всё остальное! | ОСТАВИТЬ |
| **synced_at** | ✅ ДА | Incremental sync логика (WHERE synced_at > last_sync) | ОСТАВИТЬ |
| **phone_number_id** | ❌ НЕТ | Технический ID, не фильтруем | → raw_json |
| **recording_url** | ❓ МОЖЕТ | Нужно ли фильтровать "звонки с записью"? | ОБСУДИТЬ |
| **stereo_recording_url** | ❌ НЕТ | Дубль recording_url, не нужен | → raw_json |
| **phone_call_provider** | ❌ НЕТ | Всегда "twilio", не фильтруем | → raw_json |
| **phone_call_transport** | ❌ НЕТ | Всегда "pstn", не фильтруем | → raw_json |
| **duration_seconds** | ✅ ДА | AVG duration, фильтр "короткие < 30s", aggregation | ОСТАВИТЬ |
| **vapi_summary** | ❌ НЕТ | Дубль summary, не нужен | → raw_json |
| **vapi_success_evaluation** | ❓ МОЖЕТ | Фильтр "успешные звонки"? | ОБСУДИТЬ |

---

## 🎯 Рекомендуемая схема (12 колонок вместо 24):

### ✅ ОСТАВИТЬ (обязательно):
1. **id** - primary key
2. **assistant_id** - фильтр, JOIN
3. **created_at** - сортировка, incremental sync
4. **started_at** - timeline, фильтр по датам
5. **status** - фильтр
6. **ended_reason** - success rate
7. **cost** - aggregations (SUM, AVG)
8. **duration_seconds** - aggregations (AVG)
9. **customer_phone_number** - фильтр по клиенту
10. **transcript** - full-text search
11. **raw_json** - всё остальное!
12. **synced_at** - incremental sync

### ❓ ОБСУДИТЬ:
- **customer_id** - нужна ли группировка по клиентам?
- **ended_at** - или считать из started_at + duration?
- **recording_url** - фильтр "звонки с записью"?
- **vapi_success_evaluation** - фильтр успешности?

### ❌ УДАЛИТЬ (→ raw_json):
- org_id, type, summary
- phone_number_id, phone_call_provider, phone_call_transport
- stereo_recording_url, vapi_summary

---

## 💡 Вопросы для решения:

1. **Dashboard фильтры** - какие нужны?
   - По ассистенту? (assistant_id) ✅
   - По дате? (started_at) ✅
   - По стоимости? (cost) ✅
   - По клиенту? (customer_phone_number) ✅
   - По успешности? (ended_reason или vapi_success_evaluation?)
   - По длительности? (duration_seconds) ✅

2. **Aggregations для analytics:**
   - SUM(cost) - общая стоимость ✅
   - AVG(cost) - средняя стоимость ✅
   - AVG(duration_seconds) - средняя длительность ✅
   - COUNT(*) GROUP BY assistant_id - звонков на ассистента ✅
   - COUNT(*) WHERE ended_reason = 'meeting-booked' - success rate ✅

3. **Joins:**
   - calls → assistants (по assistant_id) ✅
   - calls → qci_analyses (по call_id) ✅

---

## 🚀 Следующие шаги:

1. Решить какие колонки оставить (из 12-16)
2. Создать миграцию удаления лишних колонок
3. Взять 1 звонок и правильно смаппить
4. Создать full + incremental sync скрипты
