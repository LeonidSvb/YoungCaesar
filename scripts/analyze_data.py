#!/usr/bin/env python3
"""
Analyze VAPI call data to explain filtering criteria
"""
import json
import os
from datetime import datetime

def analyze_vapi_data():
    # Load raw data
    data_file = "../data/raw/vapi_raw_calls_2025-09-03.json"
    
    with open(data_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # Extract all calls
    all_calls = []
    for date_entry in raw_data:
        if 'calls' in date_entry and date_entry['calls']:
            all_calls.extend(date_entry['calls'])

    print('=== ПОЛНАЯ СТАТИСТИКА ДАННЫХ ===')
    print(f'Всего звонков в базе: {len(all_calls)}')

    # Analyze transcripts
    with_transcript = []
    without_transcript = []
    for call in all_calls:
        transcript = call.get('transcript', '').strip()
        if transcript:
            with_transcript.append(call)
        else:
            without_transcript.append(call)

    print(f'С транскриптами: {len(with_transcript)}')
    print(f'Без транскриптов: {len(without_transcript)}')

    # Analyze transcript lengths and costs
    transcript_stats = []
    total_duration = 0
    
    for call in with_transcript:
        transcript = call.get('transcript', '').strip()
        cost = call.get('cost', 0) or 0
        
        # Calculate duration if available
        duration = 0
        if call.get('startedAt') and call.get('endedAt'):
            try:
                started = datetime.fromisoformat(call['startedAt'].replace('Z', '+00:00'))
                ended = datetime.fromisoformat(call['endedAt'].replace('Z', '+00:00'))
                duration = (ended - started).total_seconds()
                total_duration += duration
            except:
                pass
        
        transcript_stats.append({
            'id': call.get('id', 'unknown')[:8],
            'length': len(transcript),
            'cost': cost,
            'duration': duration,
            'transcript_preview': transcript[:100] + '...' if len(transcript) > 100 else transcript
        })

    # Sort by transcript length
    transcript_stats.sort(key=lambda x: x['length'], reverse=True)

    print('\n=== АНАЛИЗ ТРАНСКРИПТОВ ===')
    lengths = [s['length'] for s in transcript_stats]
    costs = [s['cost'] for s in transcript_stats]
    durations = [s['duration'] for s in transcript_stats if s['duration'] > 0]
    
    print(f'Средняя длина: {sum(lengths)/len(lengths):.1f} символов')
    print(f'Максимальная длина: {max(lengths)} символов')
    print(f'Минимальная длина: {min(lengths)} символов')
    print(f'Средняя стоимость: ${sum(costs)/len(costs):.4f}')
    print(f'Общая длительность: {sum(durations)/3600:.1f} часов')

    # Check our filtering criteria
    filtered_781 = [s for s in transcript_stats if s['length'] >= 20 and s['cost'] >= 0.01]
    filtered_strict = [s for s in transcript_stats if s['length'] >= 50 and s['cost'] >= 0.02]

    print(f'\n=== ОБЪЯСНЕНИЕ 781 ЗВОНКА ===')
    print(f'Фильтр который мы использовали:')
    print(f'  - Длина транскрипта ≥ 20 символов')
    print(f'  - Стоимость звонка ≥ $0.01')
    print(f'Результат: {len(filtered_781)} звонков загружено в Qdrant')
    
    print(f'\nЕсли бы использовали строгий фильтр:')
    print(f'  - Длина транскрипта ≥ 50 символов')  
    print(f'  - Стоимость звонка ≥ $0.02')
    print(f'Результат: {len(filtered_strict)} звонков')

    print(f'\n=== СТАТИСТИКА ЗАГРУЖЕННЫХ 781 ЗВОНКОВ ===')
    uploaded_lengths = [s['length'] for s in filtered_781]
    uploaded_costs = [s['cost'] for s in filtered_781]
    uploaded_durations = [s['duration'] for s in filtered_781 if s['duration'] > 0]
    
    print(f'Общая длина всех транскриптов: {sum(uploaded_lengths):,} символов')
    print(f'Общая стоимость: ${sum(uploaded_costs):.2f}')
    print(f'Общая длительность разговоров: {sum(uploaded_durations)/60:.1f} минут')
    print(f'Средняя длительность звонка: {sum(uploaded_durations)/len(uploaded_durations) if uploaded_durations else 0:.1f} секунд')

    print(f'\n=== ПРИМЕРЫ ЗАГРУЖЕННЫХ ЗВОНКОВ ===')
    for i, call in enumerate(filtered_781[:5]):
        print(f'{i+1}. ID: {call["id"]}... | {call["length"]} символов | ${call["cost"]:.4f} | {call["duration"]:.0f}с')
        print(f'   Текст: "{call["transcript_preview"]}"')
        print()

    print(f'\n=== ПРИМЕРЫ ОТФИЛЬТРОВАННЫХ ЗВОНКОВ ===')
    rejected = [s for s in transcript_stats if s['length'] < 20 or s['cost'] < 0.01]
    for i, call in enumerate(rejected[:3]):
        reason = 'Короткий транскрипт' if call['length'] < 20 else 'Низкая стоимость'
        print(f'{i+1}. ID: {call["id"]}... | {call["length"]} символов | ${call["cost"]:.4f} | Причина: {reason}')
        if call["transcript_preview"]:
            print(f'   Текст: "{call["transcript_preview"]}"')
        print()

if __name__ == "__main__":
    analyze_vapi_data()