const fs = require('fs');
const path = require('path');

// Загружаем данные звонков
const dataPath = path.join(__dirname, '..', 'data', 'raw', 'vapi_filtered_calls_2025-09-17T09-23-36-349.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const calls = JSON.parse(rawData);

console.log(`Анализ данных из ${calls.length} звонков...`);

// Контейнеры для фраз
const agentPhrases = {
  VALUE: new Map(), // Предложения услуг и выгод
  CTA: new Map(),   // Призывы к действию
  BRAND: new Map(), // Представление компании
  STOP: new Map(),  // Реакции на возражения
  APOLOGY: new Map(), // Извинения и понимание
  WAIT: new Map(),  // Просьбы подождать
  OTHER: new Map()  // Остальные фразы
};

const userPhrases = {
  OBJECTIONS: new Map(), // Возражения клиентов
  REFUSAL: new Map(),    // Способы отказа
  OTHER: new Map()       // Остальные фразы
};

// Ключевые слова для категоризации агента
const categoryKeywords = {
  VALUE: [
    'помогаем', 'поможем', 'специализируемся', 'услуги', 'клиентов', 'заказчиков',
    'acquisition', 'customers', 'manufacturers', 'trade shows', 'referrals',
    'acquire', 'bring in', 'services', 'help', 'specialize'
  ],
  CTA: [
    'встреча', 'встретиться', 'созвон', 'обсудить', 'отправить', 'информацию',
    'meeting', 'chat', 'discuss', 'send', 'information', 'follow up', 'connect',
    'reach out', 'contact', 'call back'
  ],
  BRAND: [
    'Young Caesar', 'Я Alex', 'меня зовут', 'компания', 'представляю',
    'I\'m Alex', 'from Young Caesar', 'calling from', 'my name is', 'represent'
  ],
  STOP: [
    'понимаю', 'конечно', 'безусловно', 'согласен', 'но', 'однако', 'всё же',
    'understand', 'appreciate', 'but', 'however', 'still', 'fair enough',
    'I get', 'totally', 'completely'
  ],
  APOLOGY: [
    'извините', 'простите', 'сожалею', 'не хотел', 'беспокоить',
    'sorry', 'apologize', 'didn\'t mean', 'bother', 'disturb'
  ],
  WAIT: [
    'подождите', 'секунду', 'минуту', 'момент', 'сейчас',
    'wait', 'hold', 'moment', 'second', 'just a', 'one moment'
  ]
};

// Ключевые слова для возражений клиентов
const objectionKeywords = [
  'не интересно', 'не нужно', 'занят', 'некогда', 'не могу', 'нет времени',
  'not interested', 'busy', 'no time', 'can\'t', 'don\'t need', 'not now',
  'remove', 'stop calling', 'don\'t call', 'take off', 'unsubscribe'
];

const refusalKeywords = [
  'нет', 'отказ', 'не буду', 'не хочу', 'не дам', 'не скажу', 'конфиденциально',
  'no', 'refuse', 'won\'t', 'can\'t give', 'confidential', 'private', 'not allowed'
];

// Функция категоризации фраз агента
function categorizeAgentPhrase(message) {
  const text = message.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
      return category;
    }
  }

  return 'OTHER';
}

// Функция категоризации фраз клиентов
function categorizeUserPhrase(message) {
  const text = message.toLowerCase();

  if (objectionKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
    return 'OBJECTIONS';
  }

  if (refusalKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
    return 'REFUSAL';
  }

  return 'OTHER';
}

// Обрабатываем каждый звонок
let totalMessages = 0;
let agentMessages = 0;
let userMessages = 0;

calls.forEach((call, callIndex) => {
  if (!call.messages) return;

  call.messages.forEach(msg => {
    if (!msg.message || msg.role === 'system') return;

    totalMessages++;

    if (msg.role === 'assistant' || msg.role === 'bot') {
      agentMessages++;
      const category = categorizeAgentPhrase(msg.message);
      const phrase = msg.message.trim();

      if (phrase.length > 10) { // Игнорируем слишком короткие фразы
        const currentCount = agentPhrases[category].get(phrase) || 0;
        agentPhrases[category].set(phrase, currentCount + 1);
      }
    }
    else if (msg.role === 'user') {
      userMessages++;
      const category = categorizeUserPhrase(msg.message);
      const phrase = msg.message.trim();

      if (phrase.length > 5) { // Игнорируем слишком короткие фразы
        const currentCount = userPhrases[category].get(phrase) || 0;
        userPhrases[category].set(phrase, currentCount + 1);
      }
    }
  });

  if (callIndex % 100 === 0) {
    console.log(`Обработано звонков: ${callIndex + 1}/${calls.length}`);
  }
});

console.log(`\n=== СТАТИСТИКА ОБРАБОТКИ ===`);
console.log(`Общее количество сообщений: ${totalMessages}`);
console.log(`Сообщения агента: ${agentMessages}`);
console.log(`Сообщения клиентов: ${userMessages}`);

// Функция для вывода топ фраз
function printTopPhrases(phrasesMap, category, limit = 10) {
  const sorted = Array.from(phrasesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  console.log(`\n=== ТОП ${limit} ФРАЗ: ${category} ===`);
  sorted.forEach(([phrase, count], index) => {
    console.log(`${index + 1}. [${count}x] ${phrase}`);
  });

  return sorted;
}

// Выводим результаты анализа
console.log(`\n\n🤖 === АНАЛИЗ ФРАЗ АГЕНТА ===`);

Object.entries(agentPhrases).forEach(([category, phrasesMap]) => {
  if (phrasesMap.size > 0) {
    printTopPhrases(phrasesMap, category, 15);
  }
});

console.log(`\n\n👤 === АНАЛИЗ ФРАЗ КЛИЕНТОВ ===`);

Object.entries(userPhrases).forEach(([category, phrasesMap]) => {
  if (phrasesMap.size > 0) {
    printTopPhrases(phrasesMap, category, 15);
  }
});

// Создаем детальный отчет
const report = {
  metadata: {
    totalCalls: calls.length,
    totalMessages: totalMessages,
    agentMessages: agentMessages,
    userMessages: userMessages,
    processedAt: new Date().toISOString()
  },
  agentPhrases: {},
  userPhrases: {}
};

// Конвертируем Map в обычные объекты для JSON
Object.entries(agentPhrases).forEach(([category, phrasesMap]) => {
  report.agentPhrases[category] = Array.from(phrasesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([phrase, count]) => ({ phrase, count }));
});

Object.entries(userPhrases).forEach(([category, phrasesMap]) => {
  report.userPhrases[category] = Array.from(phrasesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([phrase, count]) => ({ phrase, count }));
});

// Сохраняем отчет
const reportPath = path.join(__dirname, '..', 'data', 'processed', `agent_phrases_analysis_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`\n📊 Детальный отчет сохранен: ${reportPath}`);
console.log(`\n✅ Анализ завершен!`);