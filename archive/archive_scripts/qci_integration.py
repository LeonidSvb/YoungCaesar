#!/usr/bin/env python3
"""
QCI Integration - интеграция с системой Quality of Call Index клиента
Двухэтапный процесс через OpenAI для анализа качества звонков
"""

import json
import os
import time
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime
import openai
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class QCIAnalyzer:
    def __init__(self):
        """Инициализация QCI анализатора"""
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY не найден в переменных окружения")
        
        openai.api_key = self.openai_api_key
        logger.info(">>> QCI анализатор инициализирован")

    def step1_sanitize_transcript(self, transcript: str) -> Dict[str, Any]:
        """
        Этап 1: Очистка и структуризация транскрипта
        Преобразует сырой транскрипт в структурированный JSON
        """
        
        prompt = f"""
Ты - эксперт по анализу телефонных разговоров. Твоя задача - преобразовать сырой транскрипт звонка в структурированный JSON.

ТРАНСКРИПТ:
{transcript}

Преобразуй этот транскрипт в следующую JSON структуру:
{{
    "participants": {{
        "agent": "имя или роль агента",
        "customer": "имя клиента или 'Customer'"
    }},
    "conversation_flow": [
        {{
            "speaker": "agent|customer",
            "message": "точный текст сообщения",
            "timestamp": "порядковый номер в разговоре"
        }}
    ],
    "call_metadata": {{
        "total_exchanges": "общее количество реплик",
        "agent_talk_ratio": "примерная доля речи агента (0.0-1.0)",
        "call_outcome": "meeting_scheduled|callback_requested|rejection|no_answer|other",
        "objections_raised": ["список возражений клиента"],
        "call_length_estimate": "короткий|средний|длинный"
    }},
    "key_moments": {{
        "opening_line": "первая фраза агента",
        "value_proposition": "основное предложение ценности",
        "closing_attempt": "попытка закрытия сделки",
        "objection_handling": ["как агент работал с возражениями"]
    }}
}}

Отвечай ТОЛЬКО JSON, без дополнительных комментариев.
"""

        try:
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Ты эксперт по структуризации телефонных разговоров. Отвечай только валидным JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Попытка парсинга JSON
            try:
                sanitized_data = json.loads(result_text)
                logger.info(">>> Этап 1: Транскрипт структурирован успешно")
                return sanitized_data
            except json.JSONDecodeError:
                logger.error(">>> Этап 1: Ошибка парсинга JSON, возвращаем сырые данные")
                return {
                    "raw_response": result_text,
                    "error": "JSON parsing failed"
                }
                
        except Exception as e:
            logger.error(f">>> Этап 1: Ошибка OpenAI API: {e}")
            return {"error": str(e)}

    def step2_qci_analysis(self, sanitized_data: Dict[str, Any], original_transcript: str) -> Dict[str, Any]:
        """
        Этап 2: QCI анализ (Quality of Call Index)
        Рассчитывает оценку качества звонка по системе клиента
        """
        
        # QCI система оценки (из описания клиента)
        qci_prompt = f"""
Ты - эксперт QCI (Quality of Call Index) анализатор. Проанализируй этот звонок и дай оценку 0-100 по следующим критериям:

СТРУКТУРИРОВАННЫЕ ДАННЫЕ:
{json.dumps(sanitized_data, ensure_ascii=False, indent=2)}

ОРИГИНАЛЬНЫЙ ТРАНСКРИПТ:
{original_transcript}

QCI КРИТЕРИИ ОЦЕНКИ (0-100):

A. ДИНАМИКА (30 баллов):
- Соотношение речи агента 35-55% → 0-8 баллов
- Time-To-Value ≤ 20 сек → 0-8 баллов  
- Первый призыв к действию ≤ 120 сек → 0-8 баллов
- Мертвые паузы > 3 сек → -2 балла за случай (макс -6)

B. ВОЗРАЖЕНИЯ И СООТВЕТСТВИЕ (20 баллов):
- Распознал "стоп/неудобно/не звоните" → 0-6 баллов
- Время реакции на отказ ≤ 10 сек → 0-8 баллов  
- Предложил альтернативу перед завершением → 0-6 баллов

C. БРЕНД И ЯЗЫК (20 баллов):
- Первое упоминание бренда ≤ 10 сек → 0-8 баллов
- Единообразие названия бренда → 0-8 баллов
- Соответствие языка ≤ 15 сек → 0-4 балла

D. РЕЗУЛЬТАТ И ГИГИЕНА (30 баллов):
- Результат: встреча 15 / заинтересован 10 / перезвонить 6 / информация 4 / ничего 0
- Подтверждение/завершение → 0-5 баллов
- Гигиена инструментов → 0-10 баллов

Ответь в следующем JSON формате:
{{
    "qci_score": число от 0 до 100,
    "breakdown": {{
        "dynamics": {{
            "score": число,
            "agent_talk_ratio_score": число,
            "time_to_value_score": число, 
            "first_cta_score": число,
            "dead_air_penalty": число
        }},
        "objections_compliance": {{
            "score": число,
            "recognition_score": число,
            "compliance_time_score": число,
            "alternative_offered_score": число
        }},
        "brand_language": {{
            "score": число,
            "brand_mention_score": число,
            "brand_consistency_score": число,
            "language_match_score": число
        }},
        "outcome_hygiene": {{
            "score": число,
            "outcome_score": число,
            "wrap_up_score": число,
            "tool_hygiene_score": число
        }}
    }},
    "coaching_tips": [
        "конкретный совет по улучшению 1",
        "конкретный совет по улучшению 2", 
        "конкретный совет по улучшению 3"
    ],
    "evidence": {{
        "successful_moments": [
            {{"quote": "цитата", "reason": "почему это хорошо"}}
        ],
        "improvement_areas": [
            {{"quote": "цитата", "issue": "что нужно улучшить"}}
        ]
    }},
    "call_classification": "excellent|good|average|poor|failed"
}}

Анализируй внимательно и давай честные оценки.
"""

        try:
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Ты строгий QCI эксперт. Оценивай качество звонков профессионально и объективно."},
                    {"role": "user", "content": qci_prompt}
                ],
                temperature=0.1,
                max_tokens=3000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            try:
                qci_analysis = json.loads(result_text)
                logger.info(f">>> Этап 2: QCI анализ завершен, оценка: {qci_analysis.get('qci_score', 'N/A')}")
                return qci_analysis
            except json.JSONDecodeError:
                logger.error(">>> Этап 2: Ошибка парсинга QCI JSON")
                return {
                    "raw_response": result_text,
                    "error": "QCI JSON parsing failed"
                }
                
        except Exception as e:
            logger.error(f">>> Этап 2: Ошибка QCI анализа: {e}")
            return {"error": str(e)}

    def analyze_call(self, call_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Полный анализ звонка: транскрипт → структуризация → QCI оценка
        """
        call_id = call_data.get('id', 'unknown')
        transcript = call_data.get('transcript', '').strip()
        
        if not transcript or len(transcript) < 10:
            logger.warning(f">>> Звонок {call_id}: транскрипт отсутствует или слишком короткий")
            return {
                "call_id": call_id,
                "error": "No transcript or transcript too short",
                "qci_score": 0
            }
        
        logger.info(f">>> Анализируем звонок: {call_id}")
        
        # Этап 1: Структуризация
        sanitized_data = self.step1_sanitize_transcript(transcript)
        if "error" in sanitized_data:
            logger.error(f">>> Звонок {call_id}: ошибка на этапе 1")
            return {
                "call_id": call_id,
                "step1_error": sanitized_data["error"],
                "qci_score": 0
            }
        
        # Пауза между запросами
        time.sleep(1)
        
        # Этап 2: QCI анализ  
        qci_analysis = self.step2_qci_analysis(sanitized_data, transcript)
        if "error" in qci_analysis:
            logger.error(f">>> Звонок {call_id}: ошибка на этапе 2")
            return {
                "call_id": call_id,
                "step1_data": sanitized_data,
                "step2_error": qci_analysis["error"],
                "qci_score": 0
            }
        
        # Объединяем результаты
        full_analysis = {
            "call_id": call_id,
            "assistant_id": call_data.get('assistantId'),
            "call_metadata": {
                "status": call_data.get('status'),
                "end_reason": call_data.get('endedReason'),
                "cost": call_data.get('cost', 0),
                "created_at": call_data.get('createdAt'),
                "duration_estimate": self._estimate_duration(call_data)
            },
            "step1_structured": sanitized_data,
            "step2_qci": qci_analysis,
            "qci_score": qci_analysis.get('qci_score', 0),
            "coaching_tips": qci_analysis.get('coaching_tips', []),
            "call_classification": qci_analysis.get('call_classification', 'unknown'),
            "analysis_timestamp": datetime.now().isoformat()
        }
        
        logger.info(f">>> Звонок {call_id}: анализ завершен, QCI = {full_analysis['qci_score']}")
        return full_analysis

    def _estimate_duration(self, call_data: Dict[str, Any]) -> int:
        """Оценка длительности звонка в секундах"""
        try:
            if call_data.get('startedAt') and call_data.get('endedAt'):
                from datetime import datetime
                start = datetime.fromisoformat(call_data['startedAt'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(call_data['endedAt'].replace('Z', '+00:00'))
                return int((end - start).total_seconds())
        except:
            pass
        return 0

    def batch_analyze_agent_calls(self, agent_id: str, max_calls: int = 50) -> Dict[str, Any]:
        """
        Анализ звонков конкретного агента
        """
        logger.info(f">>> Начинаем batch анализ агента: {agent_id}")
        
        # Загружаем данные агента
        agent_file = f"data/processed/by_agent/agent_{agent_id[:8]}_calls.json"
        if not os.path.exists(agent_file):
            logger.error(f">>> Файл агента не найден: {agent_file}")
            return {"error": f"Agent file not found: {agent_file}"}
        
        with open(agent_file, 'r', encoding='utf-8') as f:
            agent_calls = json.load(f)
        
        # Фильтруем звонки с транскриптами
        calls_with_transcripts = [
            call for call in agent_calls 
            if call.get('transcript', '').strip() and len(call.get('transcript', '')) > 10
        ]
        
        if not calls_with_transcripts:
            logger.warning(f">>> Агент {agent_id}: нет звонков с транскриптами")
            return {"error": "No calls with transcripts"}
        
        # Ограничиваем количество для анализа
        calls_to_analyze = calls_with_transcripts[:max_calls]
        logger.info(f">>> Агент {agent_id}: будет проанализировано {len(calls_to_analyze)} звонков")
        
        # Анализируем каждый звонок
        results = []
        successful_analyses = 0
        
        for i, call in enumerate(calls_to_analyze):
            logger.info(f">>> Прогресс: {i+1}/{len(calls_to_analyze)}")
            
            try:
                analysis = self.analyze_call(call)
                results.append(analysis)
                
                if analysis.get('qci_score', 0) > 0:
                    successful_analyses += 1
                    
                # Пауза между звонками чтобы не превысить rate limit
                time.sleep(2)
                
            except Exception as e:
                logger.error(f">>> Ошибка анализа звонка {call.get('id', 'unknown')}: {e}")
                results.append({
                    "call_id": call.get('id', 'unknown'),
                    "error": str(e),
                    "qci_score": 0
                })
        
        # Статистика результатов
        qci_scores = [r.get('qci_score', 0) for r in results if r.get('qci_score', 0) > 0]
        
        summary = {
            "agent_id": agent_id,
            "total_analyzed": len(results),
            "successful_analyses": successful_analyses,
            "failed_analyses": len(results) - successful_analyses,
            "average_qci": sum(qci_scores) / len(qci_scores) if qci_scores else 0,
            "qci_range": {"min": min(qci_scores), "max": max(qci_scores)} if qci_scores else {"min": 0, "max": 0},
            "analysis_timestamp": datetime.now().isoformat()
        }
        
        # Сохраняем результаты
        os.makedirs("data/processed/qci_results", exist_ok=True)
        
        results_data = {
            "summary": summary,
            "detailed_results": results
        }
        
        results_file = f"data/processed/qci_results/agent_{agent_id[:8]}_qci_analysis.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f">>> Результаты сохранены: {results_file}")
        logger.info(f">>> Средний QCI агента {agent_id}: {summary['average_qci']:.1f}")
        
        return results_data


def main():
    """Основная функция для тестирования QCI системы"""
    print(">>> QCI Integration - анализ качества звонков")
    print("=" * 60)
    
    try:
        analyzer = QCIAnalyzer()
        
        # Загружаем агентов
        with open("data/processed/agents_analysis.json", 'r', encoding='utf-8') as f:
            agents_data = json.load(f)
        
        agent_ids = list(agents_data['agents_detailed'].keys())
        
        print(f">>> Найдено агентов: {len(agent_ids)}")
        
        # Анализируем каждого агента (по 10 звонков для теста)
        for i, agent_id in enumerate(agent_ids, 1):
            print(f"\\n>>> [{i}/{len(agent_ids)}] Анализируем агента: {agent_id[:12]}...")
            
            try:
                results = analyzer.batch_analyze_agent_calls(agent_id, max_calls=10)
                
                if "error" not in results:
                    summary = results["summary"]
                    print(f"    - Проанализировано: {summary['successful_analyses']} звонков")
                    print(f"    - Средний QCI: {summary['average_qci']:.1f}")
                    print(f"    - Диапазон QCI: {summary['qci_range']['min']}-{summary['qci_range']['max']}")
                else:
                    print(f"    - Ошибка: {results['error']}")
                    
            except Exception as e:
                print(f"    - ОШИБКА: {e}")
        
        print("\\n>>> QCI анализ завершен!")
        print(">>> Результаты сохранены в data/processed/qci_results/")
        
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    main()