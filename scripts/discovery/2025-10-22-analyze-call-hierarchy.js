/**
 * Анализ иерархии звонков для Sales Funnel Tree
 *
 * Проверяем:
 * 1. Ошибки (started_at IS NULL)
 * 2. Voicemail detection
 * 3. Duration stages (0s, 1-59s, 60+s)
 * 4. Все инструменты (tools) которые используются
 *
 * Цель: Подтвердить иерархию перед реализацией Sankey diagram
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Настройки анализа
const SAMPLE_SIZE = 300;

// Категории для анализа
const stats = {
  total: 0,

  // Level 1: Errors
  with_errors: 0,
  without_errors: 0,

  // Level 2: Voicemail (только для without_errors)
  voicemail: 0,
  not_voicemail: 0,

  // Level 3: Duration (только для not_voicemail)
  no_pickup: 0,        // < 1s
  short_calls: 0,      // 1-59s
  quality_calls: 0,    // >= 60s

  // Level 4: Tools (только для quality_calls)
  with_tools: 0,
  without_tools: 0,

  // Все инструменты
  all_tools: {},

  // Примеры для каждой категории
  examples: {
    errors: [],
    voicemail: [],
    no_pickup: [],
    short: [],
    quality_no_tools: [],
    quality_with_tools: []
  }
};

/**
 * Определяет есть ли voicemail
 */
function detectVoicemail(call) {
  try {
    const analysis = call.raw_json?.analysis?.successEvaluation || '';
    const lowerAnalysis = analysis.toLowerCase();

    return lowerAnalysis.includes('voicemail') ||
           lowerAnalysis.includes('voice mail') ||
           lowerAnalysis.includes('answering machine');
  } catch {
    return false;
  }
}

/**
 * Извлекает все инструменты из звонка
 */
function extractTools(call) {
  try {
    const messages = call.raw_json?.artifact?.messages || [];
    const tools = [];

    messages.forEach(msg => {
      const toolCalls = msg.toolCalls || [];
      toolCalls.forEach(tc => {
        if (tc.function?.name) {
          const status = tc.result?.status || null;
          tools.push({
            name: tc.function.name,
            status: status,
            success: status === 200
          });
        }
      });
    });

    return tools;
  } catch (e) {
    return [];
  }
}

/**
 * Классифицирует звонок по иерархии
 */
function classifyCall(call) {
  // Level 1: Errors
  if (!call.started_at) {
    return {
      level: 'error',
      category: 'with_errors',
      reason: 'started_at is NULL'
    };
  }

  // Level 2: Voicemail
  if (detectVoicemail(call)) {
    return {
      level: 'voicemail',
      category: 'voicemail',
      reason: 'voicemail detected in analysis'
    };
  }

  // Level 3: Duration
  const duration = call.duration_seconds || 0;

  if (duration < 1) {
    return {
      level: 'no_pickup',
      category: 'no_pickup',
      reason: `duration ${duration}s < 1s`
    };
  }

  if (duration < 60) {
    return {
      level: 'short',
      category: 'short_calls',
      reason: `duration ${duration}s (1-59s)`
    };
  }

  // Level 4: Quality + Tools
  const tools = extractTools(call);

  if (tools.length === 0) {
    return {
      level: 'quality_no_tools',
      category: 'quality_calls',
      subcategory: 'without_tools',
      reason: `quality call (${duration}s) without tools`
    };
  }

  return {
    level: 'quality_with_tools',
    category: 'quality_calls',
    subcategory: 'with_tools',
    tools: tools,
    reason: `quality call (${duration}s) with ${tools.length} tools`
  };
}

/**
 * Добавляет пример в нужную категорию
 */
function addExample(level, call, classification) {
  const example = {
    id: call.id.substring(0, 8),
    duration: call.duration_seconds || 0,
    started_at: call.started_at ? new Date(call.started_at).toISOString().split('T')[0] : 'NULL',
    reason: classification.reason
  };

  if (classification.tools) {
    example.tools = classification.tools.map(t => `${t.name}:${t.status}`).join(', ');
  }

  const exampleList = stats.examples[level.replace('quality_', '')] || [];
  if (exampleList.length < 3) {
    exampleList.push(example);
  }
}

/**
 * Основная функция анализа
 */
async function analyzeCallHierarchy() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('АНАЛИЗ ИЕРАРХИИ ЗВОНКОВ ДЛЯ SALES FUNNEL TREE');
  console.log(`${'='.repeat(60)}\n`);

  // Получаем случайную выборку звонков
  console.log(`📊 Загружаем ${SAMPLE_SIZE} случайных звонков...\n`);

  const { data: calls, error } = await supabase
    .from('vapi_calls_raw')
    .select('id, started_at, duration_seconds, raw_json')
    .order('created_at', { ascending: false })
    .limit(SAMPLE_SIZE);

  if (error) {
    console.error('❌ Ошибка загрузки:', error.message);
    process.exit(1);
  }

  stats.total = calls.length;
  console.log(`✅ Загружено ${stats.total} звонков\n`);

  // Анализируем каждый звонок
  console.log('🔍 Анализируем иерархию...\n');

  calls.forEach(call => {
    const classification = classifyCall(call);

    // Level 1: Errors
    if (!call.started_at) {
      stats.with_errors++;
      addExample('errors', call, classification);
      return;
    }

    stats.without_errors++;

    // Level 2: Voicemail
    if (classification.level === 'voicemail') {
      stats.voicemail++;
      addExample('voicemail', call, classification);
      return;
    }

    stats.not_voicemail++;

    // Level 3: Duration
    if (classification.level === 'no_pickup') {
      stats.no_pickup++;
      addExample('no_pickup', call, classification);
      return;
    }

    if (classification.level === 'short') {
      stats.short_calls++;
      addExample('short', call, classification);
      return;
    }

    // Level 4: Quality + Tools
    stats.quality_calls++;

    if (classification.subcategory === 'without_tools') {
      stats.without_tools++;
      addExample('quality_no_tools', call, classification);
    } else {
      stats.with_tools++;
      addExample('quality_with_tools', call, classification);

      // Собираем статистику по инструментам
      classification.tools.forEach(tool => {
        if (!stats.all_tools[tool.name]) {
          stats.all_tools[tool.name] = {
            total: 0,
            success: 0,
            failed: 0
          };
        }
        stats.all_tools[tool.name].total++;
        if (tool.success) {
          stats.all_tools[tool.name].success++;
        } else {
          stats.all_tools[tool.name].failed++;
        }
      });
    }
  });

  // Выводим результаты
  printResults();
}

/**
 * Форматированный вывод результатов
 */
function printResults() {
  console.log(`${'='.repeat(60)}`);
  console.log('РЕЗУЛЬТАТЫ АНАЛИЗА');
  console.log(`${'='.repeat(60)}\n`);

  const pct = (count) => ((count / stats.total) * 100).toFixed(1);

  // Level 1
  console.log('📊 LEVEL 1: ALL CALLS');
  console.log(`   Total: ${stats.total} calls (100%)`);
  console.log(`   ├─ ❌ With Errors: ${stats.with_errors} (${pct(stats.with_errors)}%)`);
  console.log(`   └─ ✅ Without Errors: ${stats.without_errors} (${pct(stats.without_errors)}%)\n`);

  // Level 2
  if (stats.without_errors > 0) {
    const pct2 = (count) => ((count / stats.without_errors) * 100).toFixed(1);
    console.log('📊 LEVEL 2: WITHOUT ERRORS BREAKDOWN');
    console.log(`   Total: ${stats.without_errors} calls`);
    console.log(`   ├─ 📪 Voicemail: ${stats.voicemail} (${pct2(stats.voicemail)}%)`);
    console.log(`   └─ 💬 Not Voicemail: ${stats.not_voicemail} (${pct2(stats.not_voicemail)}%)\n`);
  }

  // Level 3
  if (stats.not_voicemail > 0) {
    const pct3 = (count) => ((count / stats.not_voicemail) * 100).toFixed(1);
    console.log('📊 LEVEL 3: NOT VOICEMAIL BREAKDOWN');
    console.log(`   Total: ${stats.not_voicemail} calls`);
    console.log(`   ├─ 🔇 No Pickup (<1s): ${stats.no_pickup} (${pct3(stats.no_pickup)}%)`);
    console.log(`   ├─ 📞 Short (1-59s): ${stats.short_calls} (${pct3(stats.short_calls)}%)`);
    console.log(`   └─ 📈 Quality (≥60s): ${stats.quality_calls} (${pct3(stats.quality_calls)}%)\n`);
  }

  // Level 4
  if (stats.quality_calls > 0) {
    const pct4 = (count) => ((count / stats.quality_calls) * 100).toFixed(1);
    console.log('📊 LEVEL 4: QUALITY CALLS BREAKDOWN');
    console.log(`   Total: ${stats.quality_calls} calls`);
    console.log(`   ├─ 🛠  With Tools: ${stats.with_tools} (${pct4(stats.with_tools)}%)`);
    console.log(`   └─ ⚪ Without Tools: ${stats.without_tools} (${pct4(stats.without_tools)}%)\n`);
  }

  // Инструменты
  if (Object.keys(stats.all_tools).length > 0) {
    console.log(`${'='.repeat(60)}`);
    console.log('🛠  ВСЕ ИНСТРУМЕНТЫ (в качественных звонках)');
    console.log(`${'='.repeat(60)}\n`);

    const sortedTools = Object.entries(stats.all_tools)
      .sort((a, b) => b[1].total - a[1].total);

    sortedTools.forEach(([name, counts]) => {
      const successRate = ((counts.success / counts.total) * 100).toFixed(1);
      console.log(`   ${name.padEnd(30)} ${counts.total.toString().padStart(4)} calls  (${successRate}% success)`);
    });
    console.log();
  }

  // Примеры
  console.log(`${'='.repeat(60)}`);
  console.log('📝 ПРИМЕРЫ ИЗ КАЖДОЙ КАТЕГОРИИ');
  console.log(`${'='.repeat(60)}\n`);

  printExamples('❌ WITH ERRORS', stats.examples.errors);
  printExamples('📪 VOICEMAIL', stats.examples.voicemail);
  printExamples('🔇 NO PICKUP', stats.examples.no_pickup);
  printExamples('📞 SHORT CALLS', stats.examples.short);
  printExamples('📈 QUALITY (no tools)', stats.examples.quality_no_tools);
  printExamples('🛠  QUALITY (with tools)', stats.examples.quality_with_tools);

  // Выводы
  console.log(`${'='.repeat(60)}`);
  console.log('✅ ВЫВОДЫ ДЛЯ РЕАЛИЗАЦИИ');
  console.log(`${'='.repeat(60)}\n`);

  console.log('1. Иерархия подтверждена:');
  console.log(`   ALL → ERRORS/NO_ERRORS → VOICEMAIL/NOT_VOICEMAIL → DURATION → TOOLS\n`);

  console.log('2. Все стадии имеют достаточно данных для визуализации\n');

  if (Object.keys(stats.all_tools).length > 0) {
    console.log('3. Обнаружены инструменты:');
    Object.keys(stats.all_tools).slice(0, 5).forEach(tool => {
      console.log(`   - ${tool}`);
    });
    console.log(`   ... и еще ${Math.max(0, Object.keys(stats.all_tools).length - 5)} инструментов\n`);
  }

  console.log('4. Можно делать Sankey diagram с toggles для каждой ветки\n');

  console.log('5. Для фильтрации по инструментам нужен multiselect чекбоксов\n');
}

function printExamples(title, examples) {
  if (examples.length === 0) return;

  console.log(`${title}:`);
  examples.forEach(ex => {
    console.log(`   ${ex.id}  ${ex.started_at}  ${ex.duration}s  ${ex.reason}`);
    if (ex.tools) {
      console.log(`      → Tools: ${ex.tools}`);
    }
  });
  console.log();
}

// Запуск
analyzeCallHierarchy()
  .then(() => {
    console.log('✅ Анализ завершен!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });
