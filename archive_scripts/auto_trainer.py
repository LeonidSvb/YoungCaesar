#!/usr/bin/env python3
"""
Auto Trainer - Мастер-скрипт для полного цикла самообучения агентов
Объединяет QCI анализ, анализ паттернов и оптимизацию промптов
"""

import json
import os
import sys
import time
from typing import Dict, List, Any
import logging
from datetime import datetime
import subprocess

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AutoTrainer:
    def __init__(self):
        """Инициализация автоматического тренера"""
        self.start_time = datetime.now()
        logger.info(">>> Auto Trainer запущен")
        
        # Проверяем что все необходимые модули доступны
        self._check_dependencies()

    def _check_dependencies(self):
        """Проверка зависимостей и файлов"""
        required_files = [
            "qci_integration.py",
            "pattern_analyzer.py", 
            "prompt_optimizer.py",
            "data/processed/agents_analysis.json"
        ]
        
        missing_files = []
        for file in required_files:
            if not os.path.exists(file):
                missing_files.append(file)
        
        if missing_files:
            logger.error(f">>> Отсутствуют файлы: {missing_files}")
            raise FileNotFoundError(f"Required files missing: {missing_files}")
        
        logger.info(">>> Все зависимости в порядке")

    def run_qci_analysis(self, max_calls_per_agent: int = 20) -> Dict[str, Any]:
        """Этап 1: QCI анализ всех агентов"""
        logger.info(">>> === ЭТАП 1: QCI АНАЛИЗ ===")
        
        try:
            # Импортируем QCI анализатор
            from qci_integration import QCIAnalyzer
            
            analyzer = QCIAnalyzer()
            
            # Загружаем список агентов
            with open("data/processed/agents_analysis.json", 'r', encoding='utf-8') as f:
                agents_data = json.load(f)
            
            agent_ids = list(agents_data['agents_detailed'].keys())
            results = {}
            
            logger.info(f">>> Найдено агентов для анализа: {len(agent_ids)}")
            
            for i, agent_id in enumerate(agent_ids, 1):
                logger.info(f">>> [{i}/{len(agent_ids)}] QCI анализ агента: {agent_id[:12]}...")
                
                try:
                    qci_results = analyzer.batch_analyze_agent_calls(agent_id, max_calls=max_calls_per_agent)
                    
                    if "error" not in qci_results:
                        summary = qci_results["summary"]
                        results[agent_id] = {
                            "status": "success",
                            "average_qci": summary["average_qci"],
                            "calls_analyzed": summary["successful_analyses"],
                            "qci_range": summary["qci_range"]
                        }
                        logger.info(f"    - Успешно: QCI = {summary['average_qci']:.1f}, звонков = {summary['successful_analyses']}")
                    else:
                        results[agent_id] = {
                            "status": "error", 
                            "error": qci_results["error"]
                        }
                        logger.error(f"    - Ошибка: {qci_results['error']}")
                
                except Exception as e:
                    results[agent_id] = {
                        "status": "error",
                        "error": str(e)
                    }
                    logger.error(f"    - Исключение: {e}")
                
                # Пауза между агентами
                time.sleep(3)
            
            logger.info(">>> QCI анализ завершен")
            return {"stage": "qci_analysis", "results": results}
            
        except Exception as e:
            logger.error(f">>> Критическая ошибка QCI анализа: {e}")
            return {"stage": "qci_analysis", "error": str(e)}

    def run_pattern_analysis(self) -> Dict[str, Any]:
        """Этап 2: Анализ паттернов"""
        logger.info(">>> === ЭТАП 2: АНАЛИЗ ПАТТЕРНОВ ===")
        
        try:
            from pattern_analyzer import PatternAnalyzer
            
            analyzer = PatternAnalyzer()
            
            # Получаем список агентов с QCI результатами
            qci_dir = "data/processed/qci_results"
            qci_files = [f for f in os.listdir(qci_dir) if f.endswith('_qci_analysis.json')]
            
            results = {}
            
            for i, qci_file in enumerate(qci_files, 1):
                # Извлекаем agent_id
                agent_id = qci_file.replace('agent_', '').replace('_qci_analysis.json', '')
                full_agent_id = agent_id + "0" * (36 - len(agent_id))
                
                logger.info(f">>> [{i}/{len(qci_files)}] Анализ паттернов агента: {agent_id}")
                
                try:
                    improvement_plan = analyzer.generate_agent_improvements(full_agent_id)
                    
                    if "error" not in improvement_plan:
                        current_perf = improvement_plan["current_performance"]
                        recommendations = improvement_plan["improvement_recommendations"]
                        
                        results[agent_id] = {
                            "status": "success",
                            "current_qci": current_perf["average_qci"],
                            "target_qci": recommendations["performance_targets"].get("target_qci", 0),
                            "priority_actions": len(recommendations["priority_actions"]),
                            "timeline": recommendations["performance_targets"].get("timeline", "unknown")
                        }
                        
                        logger.info(f"    - Успешно: QCI {current_perf['average_qci']:.1f} → {recommendations['performance_targets'].get('target_qci', 0)}")
                    else:
                        results[agent_id] = {
                            "status": "error",
                            "error": improvement_plan["error"]
                        }
                        logger.error(f"    - Ошибка: {improvement_plan['error']}")
                
                except Exception as e:
                    results[agent_id] = {
                        "status": "error", 
                        "error": str(e)
                    }
                    logger.error(f"    - Исключение: {e}")
            
            logger.info(">>> Анализ паттернов завершен")
            return {"stage": "pattern_analysis", "results": results}
            
        except Exception as e:
            logger.error(f">>> Критическая ошибка анализа паттернов: {e}")
            return {"stage": "pattern_analysis", "error": str(e)}

    def run_prompt_optimization(self) -> Dict[str, Any]:
        """Этап 3: Оптимизация промптов"""
        logger.info(">>> === ЭТАП 3: ОПТИМИЗАЦИЯ ПРОМПТОВ ===")
        
        try:
            from prompt_optimizer import PromptOptimizer
            
            optimizer = PromptOptimizer()
            
            # Получаем список агентов с планами улучшений
            improvement_dir = "data/processed/agent_improvements"
            improvement_files = [f for f in os.listdir(improvement_dir) if f.endswith('_improvement_plan.json')]
            
            results = {}
            
            for i, improvement_file in enumerate(improvement_files, 1):
                # Извлекаем agent_id
                agent_id = improvement_file.replace('agent_', '').replace('_improvement_plan.json', '')
                full_agent_id = agent_id + "0" * (36 - len(agent_id))
                
                logger.info(f">>> [{i}/{len(improvement_files)}] Оптимизация промпта агента: {agent_id}")
                
                try:
                    optimization_package = optimizer.generate_full_optimization_package(full_agent_id)
                    
                    if "error" not in optimization_package:
                        current_perf = optimization_package["current_performance"]
                        optimized_data = optimization_package.get("optimized_prompt", {})
                        
                        # Генерируем инструкции по внедрению
                        instructions = optimizer.generate_implementation_instructions(full_agent_id)
                        instructions_file = f"data/processed/optimization_packages/agent_{agent_id}_IMPLEMENTATION.md"
                        
                        with open(instructions_file, 'w', encoding='utf-8') as f:
                            f.write(instructions)
                        
                        results[agent_id] = {
                            "status": "success",
                            "current_qci": current_perf.get("average_qci", 0),
                            "key_changes": len(optimized_data.get("key_changes", [])),
                            "ab_variants": bool(optimization_package.get("ab_test_variants")),
                            "implementation_file": instructions_file
                        }
                        
                        logger.info(f"    - Успешно: {len(optimized_data.get('key_changes', []))} изменений, A/B: {bool(optimization_package.get('ab_test_variants'))}")
                    else:
                        results[agent_id] = {
                            "status": "error",
                            "error": optimization_package["error"]
                        }
                        logger.error(f"    - Ошибка: {optimization_package['error']}")
                
                except Exception as e:
                    results[agent_id] = {
                        "status": "error",
                        "error": str(e)
                    }
                    logger.error(f"    - Исключение: {e}")
            
            logger.info(">>> Оптимизация промптов завершена")
            return {"stage": "prompt_optimization", "results": results}
            
        except Exception as e:
            logger.error(f">>> Критическая ошибка оптимизации промптов: {e}")
            return {"stage": "prompt_optimization", "error": str(e)}

    def generate_final_report(self, stage_results: List[Dict]) -> Dict[str, Any]:
        """Генерирует финальный отчет о тренировке"""
        logger.info(">>> === ГЕНЕРАЦИЯ ФИНАЛЬНОГО ОТЧЕТА ===")
        
        execution_time = (datetime.now() - self.start_time).total_seconds()
        
        # Собираем статистику по этапам
        stage_stats = {}
        all_agents = set()
        
        for stage_result in stage_results:
            stage = stage_result.get("stage", "unknown")
            results = stage_result.get("results", {})
            
            successful_agents = len([r for r in results.values() if r.get("status") == "success"])
            failed_agents = len([r for r in results.values() if r.get("status") == "error"])
            
            stage_stats[stage] = {
                "total_agents": len(results),
                "successful": successful_agents,
                "failed": failed_agents,
                "success_rate": successful_agents / len(results) if results else 0
            }
            
            all_agents.update(results.keys())
        
        # Собираем данные по агентам
        agent_summaries = {}
        
        for agent_id in all_agents:
            agent_summary = {"agent_id": agent_id, "stages": {}}
            
            for stage_result in stage_results:
                stage = stage_result.get("stage", "unknown")
                results = stage_result.get("results", {})
                
                if agent_id in results:
                    agent_summary["stages"][stage] = results[agent_id]
            
            # Определяем общий статус агента
            stages_successful = sum(1 for stage_data in agent_summary["stages"].values() 
                                  if stage_data.get("status") == "success")
            total_stages = len(agent_summary["stages"])
            
            agent_summary["overall_success"] = stages_successful == total_stages
            agent_summary["completion_rate"] = stages_successful / total_stages if total_stages > 0 else 0
            
            agent_summaries[agent_id] = agent_summary
        
        # Создаем финальный отчет
        final_report = {
            "training_session": {
                "timestamp": self.start_time.isoformat(),
                "duration_seconds": int(execution_time),
                "total_agents_processed": len(all_agents)
            },
            "stage_statistics": stage_stats,
            "agent_summaries": agent_summaries,
            "overall_results": {
                "fully_successful_agents": len([a for a in agent_summaries.values() if a["overall_success"]]),
                "partially_successful_agents": len([a for a in agent_summaries.values() 
                                                   if not a["overall_success"] and a["completion_rate"] > 0]),
                "failed_agents": len([a for a in agent_summaries.values() if a["completion_rate"] == 0]),
                "average_completion_rate": sum(a["completion_rate"] for a in agent_summaries.values()) / len(agent_summaries) if agent_summaries else 0
            },
            "next_steps": self._generate_next_steps(agent_summaries),
            "files_created": self._list_created_files()
        }
        
        # Сохраняем отчет
        report_file = f"data/processed/training_reports/auto_training_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        os.makedirs("data/processed/training_reports", exist_ok=True)
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(final_report, f, ensure_ascii=False, indent=2)
        
        logger.info(f">>> Финальный отчет сохранен: {report_file}")
        
        return final_report

    def _generate_next_steps(self, agent_summaries: Dict) -> List[str]:
        """Генерирует рекомендации по следующим шагам"""
        next_steps = []
        
        successful_agents = [a for a in agent_summaries.values() if a["overall_success"]]
        failed_agents = [a for a in agent_summaries.values() if a["completion_rate"] == 0]
        
        if successful_agents:
            next_steps.append(f"✅ {len(successful_agents)} агентов готовы к внедрению оптимизированных промптов")
            next_steps.append("📋 Проверьте файлы IMPLEMENTATION.md в data/processed/optimization_packages/")
            next_steps.append("🧪 Запустите A/B тестирование для агентов с готовыми вариантами")
        
        if failed_agents:
            next_steps.append(f"⚠️ {len(failed_agents)} агентов требуют дополнительной работы")
            next_steps.append("🔍 Проверьте логи на предмет ошибок и повторите анализ")
        
        next_steps.append("📊 Настройте мониторинг QCI для отслеживания улучшений")
        next_steps.append("🔄 Запланируйте следующий цикл обучения через 2-4 недели")
        
        return next_steps

    def _list_created_files(self) -> Dict[str, List[str]]:
        """Составляет список созданных файлов"""
        created_files = {
            "qci_results": [],
            "improvement_plans": [],
            "optimization_packages": [],
            "implementation_instructions": []
        }
        
        # QCI результаты
        qci_dir = "data/processed/qci_results"
        if os.path.exists(qci_dir):
            created_files["qci_results"] = [f for f in os.listdir(qci_dir) if f.endswith('.json')]
        
        # Планы улучшений
        improvement_dir = "data/processed/agent_improvements" 
        if os.path.exists(improvement_dir):
            created_files["improvement_plans"] = [f for f in os.listdir(improvement_dir) if f.endswith('.json')]
        
        # Пакеты оптимизации
        optimization_dir = "data/processed/optimization_packages"
        if os.path.exists(optimization_dir):
            created_files["optimization_packages"] = [f for f in os.listdir(optimization_dir) if f.endswith('.json')]
            created_files["implementation_instructions"] = [f for f in os.listdir(optimization_dir) if f.endswith('.md')]
        
        return created_files

    def run_full_training_cycle(self, max_calls_per_agent: int = 15) -> Dict[str, Any]:
        """Запускает полный цикл обучения всех агентов"""
        logger.info(">>> === ЗАПУСК ПОЛНОГО ЦИКЛА ОБУЧЕНИЯ ===")
        logger.info(f">>> Максимум звонков на агента: {max_calls_per_agent}")
        
        stage_results = []
        
        try:
            # Этап 1: QCI анализ
            qci_result = self.run_qci_analysis(max_calls_per_agent)
            stage_results.append(qci_result)
            
            if "error" in qci_result:
                logger.error(">>> QCI анализ провален, останавливаем процесс")
                return {"error": "QCI analysis failed", "details": qci_result}
            
            # Этап 2: Анализ паттернов  
            pattern_result = self.run_pattern_analysis()
            stage_results.append(pattern_result)
            
            if "error" in pattern_result:
                logger.error(">>> Анализ паттернов провален, но продолжаем")
            
            # Этап 3: Оптимизация промптов
            prompt_result = self.run_prompt_optimization()
            stage_results.append(prompt_result)
            
            if "error" in prompt_result:
                logger.error(">>> Оптимизация промптов провалена, но продолжаем")
            
            # Генерируем финальный отчет
            final_report = self.generate_final_report(stage_results)
            
            logger.info(">>> === ЦИКЛ ОБУЧЕНИЯ ЗАВЕРШЕН ===")
            
            return final_report
            
        except Exception as e:
            logger.error(f">>> Критическая ошибка цикла обучения: {e}")
            return {"error": str(e), "partial_results": stage_results}


def main():
    """Основная функция"""
    print(">>> AUTO TRAINER - Полный цикл самообучения VAPI агентов")
    print("=" * 80)
    
    try:
        trainer = AutoTrainer()
        
        # Запрашиваем параметры у пользователя
        max_calls = input(">>> Максимум звонков на агента для анализа (по умолчанию 15): ").strip()
        if not max_calls:
            max_calls = 15
        else:
            max_calls = int(max_calls)
        
        print(f">>> Запускаем полный цикл обучения для {max_calls} звонков на агента...")
        print(">>> Это может занять 20-60 минут в зависимости от количества агентов")
        
        confirmation = input(">>> Продолжить? (y/N): ").strip().lower()
        if confirmation != 'y':
            print(">>> Отменено пользователем")
            return
        
        # Запускаем полный цикл
        result = trainer.run_full_training_cycle(max_calls)
        
        if "error" not in result:
            # Выводим краткую статистику
            overall = result["overall_results"]
            print(f"\\n>>> === РЕЗУЛЬТАТЫ ОБУЧЕНИЯ ===")
            print(f">>> Полностью успешных агентов: {overall['fully_successful_agents']}")
            print(f">>> Частично успешных агентов: {overall['partially_successful_agents']}")
            print(f">>> Провальных агентов: {overall['failed_agents']}")
            print(f">>> Средняя степень завершения: {overall['average_completion_rate']:.1%}")
            
            print(f"\\n>>> === СЛЕДУЮЩИЕ ШАГИ ===")
            for step in result["next_steps"]:
                print(f">>> {step}")
            
        else:
            print(f"\\n>>> ОШИБКА: {result['error']}")
        
    except KeyboardInterrupt:
        print("\\n>>> Процесс прерван пользователем")
    except Exception as e:
        print(f"\\n>>> КРИТИЧЕСКАЯ ОШИБКА: {e}")


if __name__ == "__main__":
    main()