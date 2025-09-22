const fs = require('fs');
const path = require('path');

// Загружаем данные звонков
const dataPath = path.join(__dirname, '..', 'data', 'raw', 'vapi_filtered_calls_2025-09-17T09-23-36-349.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const calls = JSON.parse(rawData);

console.log(`Создание лексикона на основе ${calls.length} звонков...`);

// Более точная категоризация фраз агента
const agentLexicon = {
  OPENINGS: [], // Приветствие и представление
  VALUE_PROPS: [], // Ценностные предложения
  QUALIFYING: [], // Вопросы для квалификации
  CTA_SOFT: [], // Мягкие призывы к действию
  CTA_DIRECT: [], // Прямые призывы к действию
  OBJECTION_HANDLING: [], // Работа с возражениями
  EMPATHY: [], // Эмпатия и понимание
  CLOSING: [], // Завершение разговора
  FOLLOW_UP: [] // Договоренности о следующих шагах
};

const clientPatterns = {
  HARD_NO: [], // Жесткие отказы
  SOFT_NO: [], // Мягкие отказы
  BUSY_EXCUSE: [], // Отговорки о занятости
  INTEREST_SIGNALS: [], // Сигналы интереса
  QUESTIONS: [], // Вопросы клиентов
  GATE_KEEPING: [], // Защита информации
  POSITIVE_RESPONSES: [] // Позитивные ответы
};

// Улучшенные паттерны для категоризации
const agentPatterns = {
  OPENINGS: [
    /^hi\b/i, /^hello\b/i, /this is/i, /i'm/i, /my name is/i, /calling from/i,
    /^привет/i, /^здравствуйте/i, /меня зовут/i, /это/i, /звоню из/i
  ],
  VALUE_PROPS: [
    /help.*businesses?/i, /специализируемся/i, /помогаем/i, /services/i, /solutions/i,
    /customers?/i, /клиентов/i, /manufacturing/i, /efficiency/i, /acquisition/i,
    /без.*выставок/i, /without.*trade shows/i, /referrals/i
  ],
  QUALIFYING: [
    /who.*handles?/i, /who.*in charge/i, /кто отвечает/i, /кто занимается/i,
    /marketing/i, /маркетинг/i, /right person/i, /правильный человек/i,
    /decision.*maker/i, /лицо принимающее решения/i
  ],
  CTA_SOFT: [
    /few minutes/i, /quick chat/i, /несколько минут/i, /быстро поговорить/i,
    /might be able/i, /возможно сможем/i, /worth discussing/i, /стоит обсудить/i
  ],
  CTA_DIRECT: [
    /schedule/i, /meeting/i, /appointment/i, /встреча/i, /запланировать/i,
    /send.*information/i, /отправить информацию/i, /follow.*up/i, /связаться/i
  ],
  OBJECTION_HANDLING: [
    /understand/i, /appreciate/i, /totally/i, /fair enough/i, /понимаю/i,
    /ценю/i, /конечно/i, /справедливо/i, /but/i, /however/i, /но/i, /однако/i
  ],
  EMPATHY: [
    /sorry/i, /apologize/i, /извините/i, /простите/i, /не хотел/i, /беспокоить/i,
    /understand.*concern/i, /понимаю.*беспокойство/i
  ],
  CLOSING: [
    /thank you/i, /appreciate.*time/i, /have a great/i, /спасибо/i, /благодарю/i,
    /хорошего дня/i, /до свидания/i
  ],
  FOLLOW_UP: [
    /follow.*up/i, /reach out/i, /send.*email/i, /свяжемся/i, /отправим/i,
    /call.*back/i, /перезвоним/i
  ]
};

const clientPatterns_regex = {
  HARD_NO: [
    /not interested/i, /stop calling/i, /remove.*list/i, /не интересно/i,
    /прекратите звонить/i, /уберите из базы/i, /don't call/i
  ],
  SOFT_NO: [
    /not right now/i, /maybe later/i, /сейчас не время/i, /возможно позже/i,
    /not at the moment/i, /в данный момент нет/i
  ],
  BUSY_EXCUSE: [
    /busy/i, /no time/i, /in a meeting/i, /занят/i, /нет времени/i,
    /на встрече/i, /can't talk now/i, /сейчас не могу говорить/i
  ],
  INTEREST_SIGNALS: [
    /tell me more/i, /interesting/i, /расскажите больше/i, /интересно/i,
    /what.*you do/i, /чем занимаетесь/i, /how.*work/i, /как работает/i
  ],
  QUESTIONS: [
    /what.*company/i, /how.*help/i, /what.*cost/i, /какая компания/i,
    /как поможете/i, /сколько стоит/i, /who.*you/i, /кто вы/i
  ],
  GATE_KEEPING: [
    /can't give.*information/i, /confidential/i, /не могу дать информацию/i,
    /конфиденциально/i, /not allowed/i, /не разрешено/i
  ],
  POSITIVE_RESPONSES: [
    /sure/i, /yes/i, /okay/i, /конечно/i, /да/i, /хорошо/i,
    /go ahead/i, /давайте/i, /alright/i, /ладно/i
  ]
};

// Функция для очистки и нормализации текста
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Множественные пробелы в один
    .replace(/[,\.!?]+/g, '') // Удаляем пунктуацию
    .trim();
}

// Функция категоризации фраз агента
function categorizeAgentPhrase(message) {
  const text = message.toLowerCase();

  for (const [category, patterns] of Object.entries(agentPatterns)) {
    if (patterns.some(pattern => pattern.test(text))) {
      return category;
    }
  }

  return null;
}

// Функция категоризации фраз клиентов
function categorizeClientPhrase(message) {
  const text = message.toLowerCase();

  for (const [category, patterns] of Object.entries(clientPatterns_regex)) {
    if (patterns.some(pattern => pattern.test(text))) {
      return category;
    }
  }

  return null;
}

// Обработка звонков
console.log('Извлекаем паттерны...');

let processedCalls = 0;
let validConversations = 0;

calls.forEach(call => {
  processedCalls++;

  if (!call.messages || call.messages.length < 3) return; // Пропускаем пустые или очень короткие

  let hasRealConversation = false;

  call.messages.forEach(msg => {
    if (!msg.message || msg.role === 'system') return;

    const cleanMessage = cleanText(msg.message);

    // Пропускаем автоответчики и системные сообщения
    if (cleanMessage.includes('voice mail') ||
        cleanMessage.includes('leave your message') ||
        cleanMessage.includes('press') ||
        cleanMessage.length < 15) {
      return;
    }

    hasRealConversation = true;

    if (msg.role === 'assistant' || msg.role === 'bot') {
      const category = categorizeAgentPhrase(cleanMessage);

      if (category && agentLexicon[category]) {
        // Избегаем дублирования очень похожих фраз
        const exists = agentLexicon[category].some(existing =>
          existing.phrase.toLowerCase() === cleanMessage.toLowerCase()
        );

        if (!exists) {
          agentLexicon[category].push({
            phrase: cleanMessage,
            original: msg.message,
            category: category,
            callId: call.id
          });
        }
      }
    }
    else if (msg.role === 'user') {
      const category = categorizeClientPhrase(cleanMessage);

      if (category && clientPatterns[category]) {
        const exists = clientPatterns[category].some(existing =>
          existing.phrase.toLowerCase() === cleanMessage.toLowerCase()
        );

        if (!exists) {
          clientPatterns[category].push({
            phrase: cleanMessage,
            original: msg.message,
            category: category,
            callId: call.id
          });
        }
      }
    }
  });

  if (hasRealConversation) {
    validConversations++;
  }

  if (processedCalls % 500 === 0) {
    console.log(`Обработано: ${processedCalls}/${calls.length} звонков`);
  }
});

console.log(`\nОбработано звонков: ${processedCalls}`);
console.log(`Звонков с реальными разговорами: ${validConversations}`);

// Выводим статистику по категориям
console.log('\n=== СТАТИСТИКА ЛЕКСИКОНА АГЕНТА ===');
Object.entries(agentLexicon).forEach(([category, phrases]) => {
  console.log(`${category}: ${phrases.length} уникальных фраз`);
});

console.log('\n=== СТАТИСТИКА ПАТТЕРНОВ КЛИЕНТОВ ===');
Object.entries(clientPatterns).forEach(([category, phrases]) => {
  console.log(`${category}: ${phrases.length} уникальных фраз`);
});

// Выводим примеры фраз
console.log('\n=== ПРИМЕРЫ ФРАЗ АГЕНТА ===');

Object.entries(agentLexicon).forEach(([category, phrases]) => {
  if (phrases.length > 0) {
    console.log(`\n--- ${category} (${phrases.length} фраз) ---`);
    phrases.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.phrase}`);
    });
  }
});

console.log('\n=== ПРИМЕРЫ ПАТТЕРНОВ КЛИЕНТОВ ===');

Object.entries(clientPatterns).forEach(([category, phrases]) => {
  if (phrases.length > 0) {
    console.log(`\n--- ${category} (${phrases.length} фраз) ---`);
    phrases.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.phrase}`);
    });
  }
});

// Сохраняем лексикон
const lexicon = {
  metadata: {
    totalCalls: calls.length,
    validConversations: validConversations,
    extractedAt: new Date().toISOString(),
    description: "Лексикон реальных фраз из VAPI звонков"
  },
  agentLexicon: agentLexicon,
  clientPatterns: clientPatterns
};

const outputPath = path.join(__dirname, '..', 'data', 'processed', `vapi_lexicon_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outputPath, JSON.stringify(lexicon, null, 2), 'utf8');

console.log(`\n📚 Лексикон сохранен: ${outputPath}`);
console.log('✅ Извлечение паттернов завершено!');