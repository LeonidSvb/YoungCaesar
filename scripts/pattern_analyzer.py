#!/usr/bin/env python3
"""
Pattern Analyzer - анализ успешных и неуспешных паттернов в звонках
Основа для самообучения агентов на основе QCI данных
"""

import json
import os
from typing import Dict, List, Any, Tuple
import logging
from collections import defaultdict, Counter
from statistics import mean, median
import openai
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PatternAnalyzer:
    def __init__(self):
        """Инициализация анализатора паттернов"""
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY не найден в переменных окружения")
        
        openai.api_key = self.openai_api_key
        logger.info(">>> Pattern Analyzer инициализирован")

    def load_qci_results(self, agent_id: str) -> Dict[str, Any]:
        """Загружает результаты QCI анализа для агента"""
        qci_file = f"data/processed/qci_results/agent_{agent_id[:8]}_qci_analysis.json"
        
        if not os.path.exists(qci_file):
            logger.error(f">>> QCI файл не найден: {qci_file}")
            return {}
        
        with open(qci_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def categorize_calls_by_performance(self, qci_results: Dict[str, Any]) -> Dict[str, List[Dict]]:
        """Разделяет звонки по уровню производительности на основе QCI"""
        
        calls = qci_results.get('detailed_results', [])
        
        categorized = {
            'excellent': [],    # QCI 80-100
            'good': [],         # QCI 60-79  
            'average': [],      # QCI 40-59
            'poor': [],         # QCI 20-39
            'failed': []        # QCI 0-19
        }
        
        for call in calls:
            qci_score = call.get('qci_score', 0)
            
            if qci_score >= 80:
                categorized['excellent'].append(call)
            elif qci_score >= 60:
                categorized['good'].append(call)
            elif qci_score >= 40:
                categorized['average'].append(call)
            elif qci_score >= 20:
                categorized['poor'].append(call)
            else:
                categorized['failed'].append(call)
        
        logger.info(f">>> Категоризация: Excellent={len(categorized['excellent'])}, Good={len(categorized['good'])}, Average={len(categorized['average'])}, Poor={len(categorized['poor'])}, Failed={len(categorized['failed'])}")
        
        return categorized

    def extract_successful_patterns(self, excellent_calls: List[Dict], good_calls: List[Dict]) -> Dict[str, Any]:
        """Извлекает успешные паттерны из лучших звонков"""
        
        if not excellent_calls and not good_calls:
            return {"patterns": [], "error": "No successful calls to analyze"}
        
        # Объединяем лучшие звонки
        successful_calls = excellent_calls + good_calls
        
        # Собираем все успешные элементы
        successful_openings = []
        successful_value_props = []
        successful_objection_handling = []
        successful_closings = []
        coaching_tips_success = []
        
        for call in successful_calls:
            step1_data = call.get('step1_structured', {})
            step2_data = call.get('step2_qci', {})
            
            # Ключевые моменты
            key_moments = step1_data.get('key_moments', {})
            if key_moments.get('opening_line'):
                successful_openings.append(key_moments['opening_line'])
            if key_moments.get('value_proposition'):
                successful_value_props.append(key_moments['value_proposition'])
            if key_moments.get('closing_attempt'):
                successful_closings.append(key_moments['closing_attempt'])
            
            # Успешные доказательства
            evidence = step2_data.get('evidence', {})
            for moment in evidence.get('successful_moments', []):
                if moment.get('quote'):
                    successful_objection_handling.append({
                        'quote': moment['quote'],
                        'reason': moment.get('reason', '')
                    })
            
            # Советы по коучингу (из успешных звонков)
            coaching_tips_success.extend(step2_data.get('coaching_tips', []))
        
        # Анализируем паттерны через OpenAI
        patterns_analysis = self._analyze_patterns_with_ai(
            successful_openings, successful_value_props, 
            successful_objection_handling, successful_closings,
            coaching_tips_success
        )
        
        return patterns_analysis

    def extract_failure_patterns(self, poor_calls: List[Dict], failed_calls: List[Dict]) -> Dict[str, Any]:
        """Извлекает проблемные паттерны из худших звонков"""
        
        if not poor_calls and not failed_calls:
            return {"patterns": [], "error": "No failed calls to analyze"}
        
        # Объединяем проблемные звонки
        failed_calls_combined = poor_calls + failed_calls
        
        # Собираем проблемы
        failed_openings = []
        failed_objection_handling = []
        improvement_areas = []
        coaching_tips_failures = []
        
        for call in failed_calls_combined:
            step1_data = call.get('step1_structured', {})
            step2_data = call.get('step2_qci', {})
            
            # Проблемные моменты
            key_moments = step1_data.get('key_moments', {})
            if key_moments.get('opening_line'):
                failed_openings.append(key_moments['opening_line'])
            
            # Области для улучшения
            evidence = step2_data.get('evidence', {})
            for area in evidence.get('improvement_areas', []):
                if area.get('quote'):
                    improvement_areas.append({
                        'quote': area['quote'],
                        'issue': area.get('issue', '')
                    })
            
            # Советы по коучингу (из проблемных звонков)
            coaching_tips_failures.extend(step2_data.get('coaching_tips', []))
        
        # Анализируем проблемы через OpenAI
        failure_analysis = self._analyze_failures_with_ai(
            failed_openings, improvement_areas, coaching_tips_failures
        )
        
        return failure_analysis

    def _analyze_patterns_with_ai(self, openings: List[str], value_props: List[str], 
                                 objection_handling: List[Dict], closings: List[str],
                                 coaching_tips: List[str]) -> Dict[str, Any]:
        """Анализ успешных паттернов через OpenAI"""
        
        prompt = f"""
Проанализируй успешные паттерны из звонков агента и выдели ключевые элементы.

УСПЕШНЫЕ ОТКРЫТИЯ:
{json.dumps(openings, ensure_ascii=False, indent=2)}

УСПЕШНЫЕ ПРЕДЛОЖЕНИЯ ЦЕННОСТИ:
{json.dumps(value_props, ensure_ascii=False, indent=2)}

УСПЕШНАЯ РАБОТА С ВОЗРАЖЕНИЯМИ:
{json.dumps(objection_handling, ensure_ascii=False, indent=2)}

УСПЕШНЫЕ ЗАКРЫТИЯ:
{json.dumps(closings, ensure_ascii=False, indent=2)}

СОВЕТЫ ПО КОУЧИНГУ ИЗ УСПЕШНЫХ ЗВОНКОВ:
{json.dumps(coaching_tips, ensure_ascii=False, indent=2)}

Выдели основные паттерны успеха в JSON формате:
{{
    "successful_patterns": {{
        "opening_patterns": [
            {{"pattern": "паттерн", "frequency": число, "effectiveness": "высокая|средняя", "example": "пример"}}
        ],
        "value_proposition_patterns": [
            {{"pattern": "паттерн", "frequency": число, "key_words": ["ключевые слова"], "example": "пример"}}
        ],
        "objection_handling_patterns": [
            {{"pattern": "паттерн", "situation": "тип возражения", "response": "эффективный ответ", "example": "пример"}}
        ],
        "closing_patterns": [
            {{"pattern": "паттерн", "timing": "когда использовать", "example": "пример"}}
        ]
    }},
    "key_success_factors": [
        "фактор успеха 1",
        "фактор успеха 2",
        "фактор успеха 3"
    ],
    "recommended_phrases": [
        {{"phrase": "фраза", "context": "когда использовать", "impact": "эффект"}}
    ]
}}

Анализируй внимательно и выдели только реально работающие паттерны.
"""

        try:
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Ты эксперт по анализу продажных разговоров. Выдели только действительно эффективные паттерны."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=2500
            )
            
            result_text = response.choices[0].message.content.strip()
            return json.loads(result_text)
            
        except Exception as e:
            logger.error(f">>> Ошибка анализа успешных паттернов: {e}")
            return {"error": str(e)}

    def _analyze_failures_with_ai(self, failed_openings: List[str], 
                                 improvement_areas: List[Dict], 
                                 coaching_tips: List[str]) -> Dict[str, Any]:
        """Анализ проблемных паттернов через OpenAI"""
        
        prompt = f"""
Проанализируй проблемные паттерны из неуспешных звонков и определи что нужно исправить.

ПРОБЛЕМНЫЕ ОТКРЫТИЯ:
{json.dumps(failed_openings, ensure_ascii=False, indent=2)}

ОБЛАСТИ ДЛЯ УЛУЧШЕНИЯ:
{json.dumps(improvement_areas, ensure_ascii=False, indent=2)}

СОВЕТЫ ПО КОУЧИНГУ ИЗ ПРОБЛЕМНЫХ ЗВОНКОВ:
{json.dumps(coaching_tips, ensure_ascii=False, indent=2)}

Выдели основные проблемы и способы их решения в JSON формате:
{{
    "problem_patterns": {{
        "opening_problems": [
            {{"problem": "проблема", "frequency": число, "impact": "высокий|средний|низкий", "solution": "как исправить"}}
        ],
        "objection_handling_problems": [
            {{"problem": "проблема", "consequence": "к чему приводит", "solution": "как исправить"}}
        ],
        "general_issues": [
            {{"issue": "проблема", "examples": ["пример 1", "пример 2"], "fix": "решение"}}
        ]
    }},
    "avoid_phrases": [
        {{"phrase": "фраза которую нужно избегать", "reason": "почему плохо", "alternative": "чем заменить"}}
    ],
    "improvement_priorities": [
        {{"priority": 1, "area": "область улучшения", "action": "конкретное действие"}}
    ]
}}

Сосредоточься на конкретных, исправимых проблемах.
"""

        try:
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Ты эксперт по диагностике проблем в продажных разговорах. Давай конкретные решения."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=2500
            )
            
            result_text = response.choices[0].message.content.strip()
            return json.loads(result_text)
            
        except Exception as e:
            logger.error(f">>> Ошибка анализа проблемных паттернов: {e}")
            return {"error": str(e)}

    def generate_agent_improvements(self, agent_id: str) -> Dict[str, Any]:
        """Генерирует рекомендации по улучшению для конкретного агента"""
        
        logger.info(f">>> Генерируем улучшения для агента: {agent_id[:12]}")
        
        # Загружаем QCI результаты
        qci_results = self.load_qci_results(agent_id)
        if not qci_results:
            return {"error": "QCI results not found"}
        
        # Категоризируем звонки
        categorized_calls = self.categorize_calls_by_performance(qci_results)
        
        # Анализируем успешные паттерны
        successful_patterns = self.extract_successful_patterns(
            categorized_calls['excellent'], 
            categorized_calls['good']
        )
        
        # Анализируем проблемные паттерны  
        failure_patterns = self.extract_failure_patterns(
            categorized_calls['poor'],
            categorized_calls['failed']
        )
        
        # Статистика агента
        summary = qci_results.get('summary', {})
        
        # Объединяем анализ
        improvement_plan = {
            "agent_id": agent_id,
            "current_performance": {
                "average_qci": summary.get('average_qci', 0),
                "total_calls_analyzed": summary.get('successful_analyses', 0),
                "qci_range": summary.get('qci_range', {}),
                "performance_distribution": {
                    "excellent": len(categorized_calls['excellent']),
                    "good": len(categorized_calls['good']),
                    "average": len(categorized_calls['average']),
                    "poor": len(categorized_calls['poor']),
                    "failed": len(categorized_calls['failed'])
                }
            },
            "successful_patterns": successful_patterns,
            "failure_patterns": failure_patterns,
            "improvement_recommendations": self._generate_specific_recommendations(
                successful_patterns, failure_patterns, summary.get('average_qci', 0)
            )
        }
        
        # Сохраняем анализ
        os.makedirs("data/processed/agent_improvements", exist_ok=True)
        improvement_file = f"data/processed/agent_improvements/agent_{agent_id[:8]}_improvement_plan.json"
        
        with open(improvement_file, 'w', encoding='utf-8') as f:
            json.dump(improvement_plan, f, ensure_ascii=False, indent=2)
        
        logger.info(f">>> План улучшений сохранен: {improvement_file}")
        return improvement_plan

    def _generate_specific_recommendations(self, successful_patterns: Dict, 
                                         failure_patterns: Dict, 
                                         current_qci: float) -> Dict[str, Any]:
        """Генерирует конкретные рекомендации на основе анализа"""
        
        recommendations = {
            "priority_actions": [],
            "script_improvements": {},
            "training_focus": [],
            "performance_targets": {}
        }
        
        # Определяем приоритеты на основе текущего QCI
        if current_qci < 40:
            recommendations["priority_actions"] = [
                "Срочный пересмотр скрипта открытия",
                "Интенсивное обучение работе с возражениями", 
                "Анализ каждого звонка в течение недели"
            ]
            recommendations["performance_targets"] = {
                "target_qci": 55,
                "timeline": "2 недели",
                "key_metric": "Увеличить время удержания клиента на линии"
            }
        elif current_qci < 60:
            recommendations["priority_actions"] = [
                "Улучшить предложение ценности",
                "Работать над техникой закрытия",
                "Персонализировать подход к клиентам"
            ]
            recommendations["performance_targets"] = {
                "target_qci": 70,
                "timeline": "3 недели", 
                "key_metric": "Повысить конверсию в назначенные встречи"
            }
        else:
            recommendations["priority_actions"] = [
                "Масштабировать успешные паттерны",
                "Тонко настроить работу с возражениями",
                "Оптимизировать время звонка"
            ]
            recommendations["performance_targets"] = {
                "target_qci": 80,
                "timeline": "1 месяц",
                "key_metric": "Стабилизировать высокое качество"
            }
        
        # Конкретные улучшения скрипта
        if successful_patterns.get('successful_patterns'):
            patterns = successful_patterns['successful_patterns']
            
            if patterns.get('opening_patterns'):
                recommendations["script_improvements"]["opening"] = [
                    p.get('example', '') for p in patterns['opening_patterns'][:3]
                ]
            
            if patterns.get('recommended_phrases'):
                recommendations["script_improvements"]["key_phrases"] = [
                    p.get('phrase', '') for p in patterns['recommended_phrases'][:5]
                ]
        
        # Фокус обучения
        if failure_patterns.get('problem_patterns'):
            problems = failure_patterns['problem_patterns']
            
            if problems.get('opening_problems'):
                recommendations["training_focus"].append("Техника открытия звонка")
            
            if problems.get('objection_handling_problems'):
                recommendations["training_focus"].append("Работа с возражениями")
            
            if problems.get('general_issues'):
                recommendations["training_focus"].extend([
                    issue.get('area', 'Общие навыки') for issue in problems['general_issues'][:3]
                ])
        
        return recommendations


def main():
    """Основная функция для запуска анализа паттернов"""
    print(">>> Pattern Analyzer - анализ паттернов для улучшения агентов")
    print("=" * 70)
    
    try:
        analyzer = PatternAnalyzer()
        
        # Получаем список агентов с QCI результатами
        qci_dir = "data/processed/qci_results"
        if not os.path.exists(qci_dir):
            print(">>> ERROR: QCI результаты не найдены. Запустите сначала qci_integration.py")
            return
        
        qci_files = [f for f in os.listdir(qci_dir) if f.endswith('_qci_analysis.json')]
        
        if not qci_files:
            print(">>> ERROR: QCI файлы не найдены")
            return
        
        print(f">>> Найдено QCI файлов: {len(qci_files)}")
        
        # Анализируем каждого агента
        for i, qci_file in enumerate(qci_files, 1):
            # Извлекаем agent_id из имени файла
            agent_id = qci_file.replace('agent_', '').replace('_qci_analysis.json', '')
            
            print(f"\\n>>> [{i}/{len(qci_files)}] Анализируем агента: {agent_id}")
            
            try:
                improvement_plan = analyzer.generate_agent_improvements(agent_id + "0" * 32)  # Дополняем до полной длины
                
                if "error" not in improvement_plan:
                    current_perf = improvement_plan["current_performance"]
                    print(f"    - Текущий QCI: {current_perf['average_qci']:.1f}")
                    print(f"    - Звонков проанализировано: {current_perf['total_calls_analyzed']}")
                    
                    # Рекомендации
                    recommendations = improvement_plan["improvement_recommendations"]
                    target_qci = recommendations["performance_targets"].get("target_qci", 0)
                    timeline = recommendations["performance_targets"].get("timeline", "не определен")
                    
                    print(f"    - Цель QCI: {target_qci} (срок: {timeline})")
                    print(f"    - Приоритетные действия: {len(recommendations['priority_actions'])}")
                    
                else:
                    print(f"    - Ошибка: {improvement_plan['error']}")
                    
            except Exception as e:
                print(f"    - ОШИБКА: {e}")
        
        print("\\n>>> Анализ паттернов завершен!")
        print(">>> Планы улучшений сохранены в data/processed/agent_improvements/")
        
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    main()