#!/usr/bin/env python3
"""
Анализ агентов VAPI - разделение по assistantId и анализ данных
"""

import json
import os
from collections import defaultdict, Counter
from typing import Dict, List, Any
import pandas as pd

def analyze_vapi_agents():
    """Анализирует всех агентов из данных VAPI"""
    print(">>> Анализ агентов VAPI...")
    print("=" * 50)
    
    # Загружаем данные
    data_file = "data/raw/vapi_raw_calls_2025-09-03.json"
    if not os.path.exists(data_file):
        print(f"ERROR: Файл {data_file} не найден")
        return
    
    with open(data_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    # Извлекаем все звонки
    all_calls = []
    for date_entry in raw_data:
        if 'calls' in date_entry and date_entry['calls']:
            all_calls.extend(date_entry['calls'])
    
    print(f">>> Всего звонков: {len(all_calls)}")
    
    # Группируем по агентам (assistantId)
    agents_data = defaultdict(list)
    agent_stats = defaultdict(lambda: {
        'total_calls': 0,
        'with_transcript': 0,
        'successful_calls': 0,
        'total_cost': 0,
        'avg_duration': 0,
        'statuses': Counter(),
        'end_reasons': Counter(),
        'transcripts': [],
        'system_prompt': None
    })
    
    for call in all_calls:
        assistant_id = call.get('assistantId', 'unknown')
        agents_data[assistant_id].append(call)
        
        # Статистика по агенту
        stats = agent_stats[assistant_id]
        stats['total_calls'] += 1
        
        # Транскрипт
        transcript = call.get('transcript', '').strip()
        if transcript and len(transcript) > 10:
            stats['with_transcript'] += 1
            stats['transcripts'].append(transcript)
        
        # Успешные звонки
        if call.get('status') in ['ended', 'completed']:
            stats['successful_calls'] += 1
        
        # Стоимость
        stats['total_cost'] += call.get('cost', 0)
        
        # Статус и причины
        stats['statuses'][call.get('status', 'unknown')] += 1
        stats['end_reasons'][call.get('endedReason', 'unknown')] += 1
        
        # Системный промпт (берем первый попавшийся)
        if not stats['system_prompt'] and call.get('messages'):
            for msg in call['messages']:
                if msg.get('role') == 'system':
                    stats['system_prompt'] = msg.get('message', '')[:500]  # Первые 500 символов
                    break
        
        # Длительность
        if call.get('startedAt') and call.get('endedAt'):
            from datetime import datetime
            start = datetime.fromisoformat(call['startedAt'].replace('Z', '+00:00'))
            end = datetime.fromisoformat(call['endedAt'].replace('Z', '+00:00'))
            duration = (end - start).total_seconds()
            stats['avg_duration'] += duration
    
    # Вычисляем средние значения
    for assistant_id, stats in agent_stats.items():
        if stats['total_calls'] > 0:
            stats['avg_duration'] = stats['avg_duration'] / stats['total_calls']
            stats['avg_cost'] = stats['total_cost'] / stats['total_calls']
            stats['success_rate'] = stats['successful_calls'] / stats['total_calls']
            stats['transcript_rate'] = stats['with_transcript'] / stats['total_calls']
    
    # Выводим статистику
    print(f"\n>>> Найдено агентов: {len(agent_stats)}")
    print("\n" + "=" * 80)
    
    for i, (assistant_id, stats) in enumerate(agent_stats.items(), 1):
        print(f"\n>>> АГЕНТ #{i}: {assistant_id}")
        print(f"   - Всего звонков: {stats['total_calls']}")
        print(f"   - С транскриптами: {stats['with_transcript']} ({stats['transcript_rate']:.1%})")
        print(f"   - Успешных: {stats['successful_calls']} ({stats['success_rate']:.1%})")
        print(f"   - Общая стоимость: ${stats['total_cost']:.2f}")
        print(f"   - Средняя длительность: {stats['avg_duration']:.0f} сек")
        
        print(f"   - Топ статусы: {dict(stats['statuses'].most_common(3))}")
        print(f"   - Топ причины окончания: {dict(stats['end_reasons'].most_common(3))}")
        
        if stats['system_prompt']:
            print(f"   - Промпт: {stats['system_prompt'][:100]}...")
        
        print("-" * 80)
    
    # Сохраняем детальный анализ
    analysis_report = {
        'summary': {
            'total_agents': len(agent_stats),
            'total_calls': len(all_calls),
            'agents_overview': {}
        },
        'agents_detailed': {}
    }
    
    for assistant_id, stats in agent_stats.items():
        # Краткий обзор
        analysis_report['summary']['agents_overview'][assistant_id] = {
            'total_calls': stats['total_calls'],
            'success_rate': stats['success_rate'],
            'transcript_rate': stats['transcript_rate'],
            'avg_cost': stats.get('avg_cost', 0)
        }
        
        # Детальные данные
        analysis_report['agents_detailed'][assistant_id] = {
            'stats': {k: v for k, v in stats.items() if k not in ['transcripts']},
            'sample_transcripts': stats['transcripts'][:5] if stats['transcripts'] else []
        }
    
    # Сохраняем отчет
    with open('data/processed/agents_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(analysis_report, f, ensure_ascii=False, indent=2)
    
    print(f"\n>>> Детальный анализ сохранен в: data/processed/agents_analysis.json")
    
    # Создаем CSV для каждого агента
    os.makedirs('data/processed/by_agent', exist_ok=True)
    
    for assistant_id, calls in agents_data.items():
        # Сохраняем звонки агента
        with open(f'data/processed/by_agent/agent_{assistant_id[:8]}_calls.json', 'w', encoding='utf-8') as f:
            json.dump(calls, f, ensure_ascii=False, indent=2)
        
        # Создаем CSV с транскриптами для обучения
        transcripts_data = []
        for call in calls:
            transcript = call.get('transcript', '').strip()
            if transcript and len(transcript) > 10:
                transcripts_data.append({
                    'call_id': call.get('id'),
                    'transcript': transcript,
                    'status': call.get('status'),
                    'end_reason': call.get('endedReason'),
                    'duration': call.get('duration', 0),
                    'cost': call.get('cost', 0),
                    'created_at': call.get('createdAt')
                })
        
        if transcripts_data:
            df = pd.DataFrame(transcripts_data)
            df.to_csv(f'data/processed/by_agent/agent_{assistant_id[:8]}_transcripts.csv', 
                     index=False, encoding='utf-8')
    
    print(f">>> Данные по агентам сохранены в: data/processed/by_agent/")
    
    return analysis_report

if __name__ == "__main__":
    try:
        os.makedirs('data/processed', exist_ok=True)
        analysis_report = analyze_vapi_agents()
        print("\n>>> Анализ завершен!")
    except Exception as e:
        print(f"ERROR: {e}")