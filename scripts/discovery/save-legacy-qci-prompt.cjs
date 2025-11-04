require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Старый промпт v1.0 (для legacy/backup)
const oldPrompt = `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

Transcript: "{transcript}"

CRITICAL: Respond ONLY with valid JSON. NO explanations, NO markdown formatting, NO \`\`\`json blocks.

{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,
  "evidence": {
    "agent_talk_ratio": "estimated percentage based on Agent vs User turns",
    "brand_mentions": ["exact quotes mentioning Young Caesar"],
    "outcomes": ["specific outcomes achieved"],
    "key_moments": ["important quotes affecting scoring"]
  },
  "coaching_tips": ["specific actionable advice"]
}

SCORING CRITERIA:

DYNAMICS (0-30 pts):
- Talk ratio: Count Agent vs User turns, estimate ratio. Target 35-55% agent talk: 8-12 pts, 20-35% or 55-70%: 4-8 pts, else: 0-4 pts
- Response timing and flow: Smooth conversation without loops/repetition: 8-12 pts, some issues: 4-8 pts, poor flow: 0-4 pts
- Engagement quality: Agent asks questions, responds appropriately: 6-8 pts, basic responses: 2-4 pts, poor: 0-2 pts

OBJECTIONS (0-20 pts):
- Recognition of resistance/concerns: 0-7 pts
- Compliance with objections: 0-7 pts
- Offering alternatives: 0-6 pts

BRAND (0-20 pts) - HARDCODED RULES:
- "Young Caesar" mentioned explicitly in transcript: 15-20 pts
- Professional tone without "Young Caesar" mention: 0-10 pts
- ONLY award 15+ points if "Young Caesar" appears in transcript

OUTCOME (0-30 pts):
- Meeting scheduled: 25-30 pts
- Warm lead generated: 15-20 pts
- Callback arranged: 10-15 pts
- Information exchanged: 5-10 pts
- No concrete result: 0-5 pts

EVIDENCE REQUIREMENTS:
- Base ALL scoring on actual transcript content
- Include exact quotes for brand mentions (must contain "Young Caesar")
- Count actual Agent vs User speaking turns for talk ratio estimation
- List specific outcomes achieved with quotes
- Do not invent information not present in transcript

TALK RATIO CALCULATION:
- Count lines starting with "Agent:" vs "User:" to estimate talk ratio
- Agent ratio = Agent turns / (Agent turns + User turns) * 100
- Report this percentage in agent_talk_ratio field`;

(async () => {
  console.log('Сохраняю старый промпт v1.0 как legacy...\n');

  // Проверяем, не существует ли уже
  const { data: existing } = await supabase
    .from('analysis_frameworks')
    .select('id, name')
    .eq('name', 'QCI Standard v1.0 (Legacy)')
    .single();

  if (existing) {
    console.log('⚠️  Legacy версия уже существует:', existing.name);
    console.log('ID:', existing.id);
    return;
  }

  const { data, error } = await supabase
    .from('analysis_frameworks')
    .insert({
      name: 'QCI Standard v1.0 (Legacy)',
      version: 'v1.0',
      description: 'Original QCI prompt - simple scoring with basic coaching tips. Archived for comparison and rollback.',
      prompt_template: oldPrompt,
      framework_type: 'analysis',
      model_config: {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 2000
      },
      is_active: false,
      created_by: 'system'
    })
    .select();

  if (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }

  console.log('✅ Старый промпт сохранен как legacy!');
  console.log('ID:', data[0].id);
  console.log('Name:', data[0].name);
  console.log('Version:', data[0].version);
  console.log('Active:', data[0].is_active);
  console.log('');
  console.log('📋 Теперь в базе есть:');
  console.log('  1. "QCI Standard v1.0 (Legacy)" - is_active: false');
  console.log('  2. "QCI Standard" (v2.0) - is_active: true');
  console.log('');
  console.log('💡 Возможности:');
  console.log('  ✓ Откат на v1.0 (переключить is_active)');
  console.log('  ✓ Сравнение эффективности v1.0 vs v2.0');
  console.log('  ✓ A/B тестирование (framework_id в qci_analyses)');
})();
