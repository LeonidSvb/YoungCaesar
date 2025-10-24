-- Статистика звонков по дням за последние 30 дней

SELECT
    DATE(COALESCE(started_at, created_at)) as date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END) as with_transcript,
    COUNT(qa.id) as with_qci
FROM vapi_calls_raw vcr
LEFT JOIN qci_analyses qa ON vcr.id = qa.call_id
WHERE COALESCE(started_at, created_at) >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(COALESCE(started_at, created_at))
ORDER BY date DESC;

-- Сводка за разные периоды
SELECT
    '7 дней' as period,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END) as with_transcript,
    COUNT(qa.id) as with_qci,
    ROUND(COUNT(qa.id)::numeric / NULLIF(COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END), 0) * 100, 1) as qci_coverage
FROM vapi_calls_raw vcr
LEFT JOIN qci_analyses qa ON vcr.id = qa.call_id
WHERE COALESCE(started_at, created_at) >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT
    '14 дней' as period,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END) as with_transcript,
    COUNT(qa.id) as with_qci,
    ROUND(COUNT(qa.id)::numeric / NULLIF(COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END), 0) * 100, 1) as qci_coverage
FROM vapi_calls_raw vcr
LEFT JOIN qci_analyses qa ON vcr.id = qa.call_id
WHERE COALESCE(started_at, created_at) >= CURRENT_DATE - INTERVAL '14 days'

UNION ALL

SELECT
    '30 дней' as period,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END) as with_transcript,
    COUNT(qa.id) as with_qci,
    ROUND(COUNT(qa.id)::numeric / NULLIF(COUNT(CASE WHEN transcript IS NOT NULL AND LENGTH(transcript) > 100 THEN 1 END), 0) * 100, 1) as qci_coverage
FROM vapi_calls_raw vcr
LEFT JOIN qci_analyses qa ON vcr.id = qa.call_id
WHERE COALESCE(started_at, created_at) >= CURRENT_DATE - INTERVAL '30 days'

ORDER BY period;
