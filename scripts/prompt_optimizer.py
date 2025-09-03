#!/usr/bin/env python3
"""
Prompt Optimizer - генерация улучшенных промптов для VAPI агентов
на основе анализа паттернов и QCI данных
"""

import json
import os
from typing import Dict, List, Any, Optional
import logging
from datetime import datetime
import openai
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PromptOptimizer:
    def __init__(self):
        """Инициализация оптимизатора промптов"""
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY не найден в переменных окружения")
        
        self.client = openai.OpenAI(api_key=self.openai_api_key)
        logger.info(">>> Prompt Optimizer инициализирован")

    def load_agent_data(self, agent_id: str) -> Dict[str, Any]:
        """Загружает все данные агента для анализа"""
        
        # Загружаем исходные звонки агента
        agent_calls_file = f"data/processed/by_agent/agent_{agent_id[:8]}_calls.json"
        original_calls = []
        if os.path.exists(agent_calls_file):
            with open(agent_calls_file, 'r', encoding='utf-8') as f:
                original_calls = json.load(f)
        
        # Загружаем план улучшений
        improvement_file = f"data/processed/agent_improvements/agent_{agent_id[:8]}_improvement_plan.json"
        improvement_plan = {}
        if os.path.exists(improvement_file):
            with open(improvement_file, 'r', encoding='utf-8') as f:
                improvement_plan = json.load(f)
        
        return {
            "agent_id": agent_id,
            "original_calls": original_calls,
            "improvement_plan": improvement_plan
        }

    def extract_current_prompt(self, agent_calls: List[Dict]) -> Optional[str]:
        """Извлекает текущий системный промпт агента"""
        
        for call in agent_calls:
            messages = call.get('messages', [])
            for message in messages:
                if message.get('role') == 'system':
                    return message.get('message', '')
        
        return None

    def generate_optimized_prompt(self, agent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Генерирует оптимизированный промпт для агента"""
        
        agent_id = agent_data['agent_id']
        original_calls = agent_data['original_calls']
        improvement_plan = agent_data['improvement_plan']
        
        logger.info(f">>> Генерируем оптимизированный промпт для агента: {agent_id[:12]}")
        
        # Извлекаем текущий промпт
        current_prompt = self.extract_current_prompt(original_calls)
        if not current_prompt:
            logger.error(">>> Текущий промпт не найден")
            return {"error": "Current prompt not found"}
        
        # Получаем данные для улучшения
        successful_patterns = improvement_plan.get('successful_patterns', {})
        failure_patterns = improvement_plan.get('failure_patterns', {})
        recommendations = improvement_plan.get('improvement_recommendations', {})
        current_performance = improvement_plan.get('current_performance', {})
        
        # Генерируем улучшенный промпт через OpenAI
        optimized_prompt = self._create_enhanced_prompt(
            current_prompt, successful_patterns, failure_patterns, 
            recommendations, current_performance
        )
        
        return optimized_prompt

    def _create_enhanced_prompt(self, current_prompt: str, 
                               successful_patterns: Dict, failure_patterns: Dict,
                               recommendations: Dict, performance: Dict) -> Dict[str, Any]:
        """Создает улучшенный промпт используя OpenAI"""
        
        prompt_optimization_request = f"""
Ты - эксперт по оптимизации промптов для AI агентов продаж. 

ТЕКУЩИЙ ПРОМПТ АГЕНТА:
{current_prompt}

ТЕКУЩАЯ ПРОИЗВОДИТЕЛЬНОСТЬ:
- Средний QCI: {performance.get('average_qci', 0):.1f}
- Всего звонков: {performance.get('total_calls_analyzed', 0)}
- Распределение качества: {performance.get('performance_distribution', {})}

УСПЕШНЫЕ ПАТТЕРНЫ:
{json.dumps(successful_patterns, ensure_ascii=False, indent=2)}

ПРОБЛЕМНЫЕ ОБЛАСТИ:
{json.dumps(failure_patterns, ensure_ascii=False, indent=2)}

РЕКОМЕНДАЦИИ:
{json.dumps(recommendations, ensure_ascii=False, indent=2)}

ЗАДАЧА: Создай улучшенный промпт который:
1. Сохранит все ключевые элементы оригинального промпта
2. Интегрирует успешные паттерны из лучших звонков
3. Исправит выявленные проблемы
4. Добавит конкретные инструкции для улучшения QCI

ТРЕБОВАНИЯ К НОВОМУ ПРОМПТУ:
- Сохрани структуру и стиль оригинала
- Добавь секцию "SUCCESSFUL PATTERNS" с лучшими фразами
- Добавь секцию "AVOID THESE MISTAKES" с ошибками которых нужно избегать  
- Улучши секции работы с возражениями
- Добавь конкретные метрики качества для агента
- Сделай инструкции более конкретными и действенными

Ответь в JSON формате:
{{
    "optimized_prompt": "полный текст улучшенного промпта",
    "key_changes": [
        "изменение 1",
        "изменение 2", 
        "изменение 3"
    ],
    "added_sections": [
        {{"section": "название секции", "purpose": "зачем добавлено"}}
    ],
    "expected_improvements": [
        "ожидаемое улучшение 1",
        "ожидаемое улучшение 2"
    ]
}}
"""

        try:
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Ты эксперт по созданию высокоэффективных промптов для AI агентов продаж. Создавай конкретные, действенные инструкции."},
                    {"role": "user", "content": prompt_optimization_request}
                ],
                temperature=0.1,
                max_tokens=4000
            )
            
            result_text = response.choices[0].message.content.strip()
            return json.loads(result_text)
            
        except Exception as e:
            logger.error(f">>> Ошибка генерации оптимизированного промпта: {e}")
            return {"error": str(e)}

    def create_a_b_test_variants(self, optimized_prompt_data: Dict) -> Dict[str, Any]:
        """Создает варианты для A/B тестирования"""
        
        base_prompt = optimized_prompt_data.get('optimized_prompt', '')
        if not base_prompt:
            return {"error": "No base prompt provided"}
        
        # Создаем 2 варианта для тестирования
        variants_request = f"""
На основе этого оптимизированного промпта создай 2 варианта для A/B тестирования:

БАЗОВЫЙ ПРОМПТ:
{base_prompt}

Создай:
ВАРИАНТ A - более агрессивный подход (фокус на быстром закрытии)
ВАРИАНТ B - более консультативный подход (фокус на построении доверия)

Ответь в JSON:
{{
    "variant_a": {{
        "prompt": "полный текст варианта A",
        "focus": "агрессивные продажи",
        "key_differences": ["отличие 1", "отличие 2"]
    }},
    "variant_b": {{
        "prompt": "полный текст варианта B", 
        "focus": "консультативные продажи",
        "key_differences": ["отличие 1", "отличие 2"]
    }}
}}
"""

        try:
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Создавай четкие различия между вариантами для валидного A/B тестирования."},
                    {"role": "user", "content": variants_request}
                ],
                temperature=0.2,
                max_tokens=3500
            )
            
            result_text = response.choices[0].message.content.strip()
            return json.loads(result_text)
            
        except Exception as e:
            logger.error(f">>> Ошибка создания A/B вариантов: {e}")
            return {"error": str(e)}

    def generate_full_optimization_package(self, agent_id: str) -> Dict[str, Any]:
        """Создает полный пакет оптимизации для агента"""
        
        logger.info(f">>> Создаем полный пакет оптимизации для агента: {agent_id[:12]}")
        
        # Загружаем все данные агента
        agent_data = self.load_agent_data(agent_id)
        
        if not agent_data['improvement_plan']:
            return {"error": "Improvement plan not found. Run pattern_analyzer.py first."}
        
        # Генерируем оптимизированный промпт
        optimized_prompt_data = self.generate_optimized_prompt(agent_data)
        if "error" in optimized_prompt_data:
            return {"error": f"Failed to optimize prompt: {optimized_prompt_data['error']}"}
        
        # Создаем A/B варианты
        ab_variants = self.create_a_b_test_variants(optimized_prompt_data)
        if "error" in ab_variants:
            logger.warning(f">>> A/B варианты не созданы: {ab_variants['error']}")
            ab_variants = {}
        
        # Создаем полный пакет
        optimization_package = {
            "agent_id": agent_id,
            "optimization_timestamp": datetime.now().isoformat(),
            "current_performance": agent_data['improvement_plan'].get('current_performance', {}),
            "original_prompt": self.extract_current_prompt(agent_data['original_calls']),
            "optimized_prompt": optimized_prompt_data,
            "ab_test_variants": ab_variants,
            "implementation_plan": {
                "phase_1": "Тестирование оптимизированного промпта (1 неделя)",
                "phase_2": "A/B тестирование вариантов (2 недели)",
                "phase_3": "Выбор лучшего варианта и внедрение",
                "success_metrics": [
                    "Увеличение среднего QCI на 15-20%",
                    "Рост конверсии в назначенные встречи",
                    "Уменьшение количества отказов в первые 30 секунд"
                ]
            },
            "monitoring_requirements": {
                "track_daily": ["QCI scores", "Call success rate", "Average call duration"],
                "track_weekly": ["Pattern consistency", "Coaching adherence", "Performance trends"],
                "alert_triggers": [
                    "QCI падает ниже текущего уровня на 10%",
                    "Резкий рост количества отказов",
                    "Снижение конверсии"
                ]
            }
        }
        
        # Сохраняем пакет оптимизации
        os.makedirs("data/processed/optimization_packages", exist_ok=True)
        package_file = f"data/processed/optimization_packages/agent_{agent_id[:8]}_optimization_package.json"
        
        with open(package_file, 'w', encoding='utf-8') as f:
            json.dump(optimization_package, f, ensure_ascii=False, indent=2)
        
        logger.info(f">>> Пакет оптимизации сохранен: {package_file}")
        
        return optimization_package

    def generate_implementation_instructions(self, agent_id: str) -> str:
        """Генерирует инструкции по внедрению для разработчика"""
        
        package_file = f"data/processed/optimization_packages/agent_{agent_id[:8]}_optimization_package.json"
        
        if not os.path.exists(package_file):
            return "ERROR: Optimization package not found. Run generate_full_optimization_package first."
        
        with open(package_file, 'r', encoding='utf-8') as f:
            package = json.load(f)
        
        current_qci = package.get('current_performance', {}).get('average_qci', 0)
        target_qci = package.get('optimized_prompt', {}).get('expected_improvements', ['Unknown improvement'])[0]
        
        instructions = f"""
# 🚀 ИНСТРУКЦИИ ПО ВНЕДРЕНИЮ ОПТИМИЗИРОВАННОГО ПРОМПТА

## Агент: {agent_id[:12]}...
**Текущий QCI:** {current_qci:.1f}  
**Целевой QCI:** {target_qci if isinstance(target_qci, str) else "Определится после тестирования"}

---

## 🔧 ШАГ 1: Подготовка к внедрению

1. **Создайте резервную копию текущего промпта:**
   ```bash
   # Сохраните текущие настройки VAPI агента
   curl -X GET "https://api.vapi.ai/assistant/{agent_id}" \\
        -H "Authorization: Bearer YOUR_VAPI_API_KEY" \\
        > backup_agent_{agent_id[:8]}.json
   ```

2. **Подготовьте новый промпт:**
   - Файл: `{package_file}`
   - Секция: `optimized_prompt.optimized_prompt`

---

## 🧪 ШАГ 2: Поэтапное тестирование  

### Фаза 1: Тестирование оптимизированного промпта (1 неделя)

```bash
# Обновите промпт агента
curl -X PATCH "https://api.vapi.ai/assistant/{agent_id}" \\
     -H "Authorization: Bearer YOUR_VAPI_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{{"model": {{"messages": [{{"role": "system", "content": "НОВЫЙ_ПРОМПТ_ЗДЕСЬ"}}]}}}}'
```

**Мониторинг в течение недели:**
- Ежедневный QCI анализ новых звонков
- Сравнение с предыдущими показателями
- Фиксация изменений в поведении агента

### Фаза 2: A/B тестирование (2 недели)

**Если есть A/B варианты:**
1. Создайте копию агента для варианта B
2. Распределите трафик 50/50
3. Отслеживайте метрики в реальном времени

### Фаза 3: Внедрение лучшего варианта

---

## 📊 ШАГ 3: Мониторинг результатов

### Ежедневно отслеживать:
"""
        
        for metric in package.get('monitoring_requirements', {}).get('track_daily', []):
            instructions += f"\n- ✅ {metric}"
        
        instructions += "\n\n### Еженедельно отслеживать:"
        
        for metric in package.get('monitoring_requirements', {}).get('track_weekly', []):
            instructions += f"\n- 📈 {metric}"
        
        instructions += f"""

### 🚨 Тревожные сигналы:
"""
        
        for alert in package.get('monitoring_requirements', {}).get('alert_triggers', []):
            instructions += f"\n- ⚠️ {alert}"
        
        instructions += f"""

---

## 🎯 ШАГ 4: Ожидаемые результаты

### Через 1 неделю:
- Первые изменения в QCI оценках
- Адаптация агента к новым инструкциям
- Возможные временные флуктуации показателей

### Через 2 недели:  
- Стабилизация новых паттернов
- Четкая картина улучшений
- Решение о продолжении или корректировке

### Через 1 месяц:
- Достижение целевых показателей QCI
- Полная интеграция новых подходов
- Готовность к следующему циклу оптимизации

---

## 🔄 ШАГ 5: Откат (если необходимо)

**Если результаты неудовлетворительны:**

```bash
# Восстановите оригинальный промпт
curl -X PATCH "https://api.vapi.ai/assistant/{agent_id}" \\
     -H "Authorization: Bearer YOUR_VAPI_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d @backup_agent_{agent_id[:8]}.json
```

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи VAPI на предмет ошибок
2. Сравните QCI оценки до и после внедрения
3. Проанализируйте конкретные примеры звонков

**Готово для внедрения!** 🚀
"""
        
        return instructions


def main():
    """Основная функция для запуска оптимизации промптов"""
    print(">>> Prompt Optimizer - создание улучшенных промптов")
    print("=" * 60)
    
    try:
        optimizer = PromptOptimizer()
        
        # Получаем список агентов с планами улучшений
        improvement_dir = "data/processed/agent_improvements"
        if not os.path.exists(improvement_dir):
            print(">>> ERROR: Планы улучшений не найдены. Запустите сначала pattern_analyzer.py")
            return
        
        improvement_files = [f for f in os.listdir(improvement_dir) if f.endswith('_improvement_plan.json')]
        
        if not improvement_files:
            print(">>> ERROR: Файлы улучшений не найдены")
            return
        
        print(f">>> Найдено планов улучшений: {len(improvement_files)}")
        
        # Создаем пакеты оптимизации для каждого агента
        for i, improvement_file in enumerate(improvement_files, 1):
            # Извлекаем agent_id из имени файла
            agent_id = improvement_file.replace('agent_', '').replace('_improvement_plan.json', '')
            
            print(f"\\n>>> [{i}/{len(improvement_files)}] Оптимизируем агента: {agent_id}")
            
            try:
                # Дополняем agent_id до полной длины
                full_agent_id = agent_id + "0" * (36 - len(agent_id))
                
                optimization_package = optimizer.generate_full_optimization_package(full_agent_id)
                
                if "error" not in optimization_package:
                    current_qci = optimization_package["current_performance"].get("average_qci", 0)
                    key_changes = len(optimization_package.get("optimized_prompt", {}).get("key_changes", []))
                    
                    print(f"    - Текущий QCI: {current_qci:.1f}")
                    print(f"    - Ключевых изменений: {key_changes}")
                    print(f"    - A/B варианты: {'создан' if optimization_package.get('ab_test_variants') else 'не созданы'}")
                    
                    # Генерируем инструкции по внедрению
                    instructions = optimizer.generate_implementation_instructions(full_agent_id)
                    
                    instructions_file = f"data/processed/optimization_packages/agent_{agent_id}_IMPLEMENTATION.md"
                    with open(instructions_file, 'w', encoding='utf-8') as f:
                        f.write(instructions)
                    
                    print(f"    - Инструкции: {instructions_file}")
                    
                else:
                    print(f"    - Ошибка: {optimization_package['error']}")
                    
            except Exception as e:
                print(f"    - ОШИБКА: {e}")
        
        print("\\n>>> Оптимизация промптов завершена!")
        print(">>> Пакеты оптимизации: data/processed/optimization_packages/")
        
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    main()