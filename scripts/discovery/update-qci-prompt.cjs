require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const newPrompt = `Analyze this VAPI call transcript for Quality Call Index (QCI) with DETAILED coaching insights.

Transcript: "{transcript}"

Assistant Context: Biesse sales agent for CNC and woodworking machinery

CRITICAL: Respond ONLY with valid JSON. NO markdown, NO explanations.

{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,

  "evidence": {
    "agent_talk_ratio": "XX%",
    "brand_mentions": ["exact quotes mentioning Biesse"],
    "outcomes": ["specific outcomes achieved"],
    "key_moments": ["critical moments with timestamps"]
  },

  "coaching_tips": [
    {
      "category": "Critical Bug|Logic Error|Best Practice|Optimization",
      "issue": "Short title of problem",
      "evidence": "Exact quote showing the issue",
      "impact": "How this hurts conversion",
      "fix": "Specific actionable solution"
    }
  ],

  "critical_failures": ["List deal-breaking mistakes"],
  "what_went_well": ["Positive behaviors to reinforce"]
}

SCORING CRITERIA:

DYNAMICS (0-30 pts):
- Talk ratio (0-12): Count AI vs User turns. 35-55%=10-12pts, 25-35% or 55-70%=6-9pts, else 0-5pts
- Flow/timing (0-12): Smooth conversation=10-12pts, some issues=6-9pts, loops/repetitions=0-5pts
- Engagement (0-6): Active listening=5-6pts, basic=3-4pts, scripted=0-2pts

OBJECTIONS (0-20 pts):
- Recognition (0-7): Caught resistance/concerns?
- Handling (0-7): Appropriate response?
- Alternatives (0-6): Offered options?

BRAND (0-20 pts):
- "Biesse" mentioned clearly: 15-20 pts
- Professional but no brand: 5-10 pts
- Poor/confusing: 0-5 pts

OUTCOME (0-30 pts):
- Meeting booked: 25-30 pts
- Warm lead: 15-24 pts
- Callback arranged: 10-14 pts
- Info exchange: 5-9 pts
- Total failure: 0-4 pts

COACHING REQUIREMENTS - Include for EVERY call:

1. CRITICAL BUGS (if any):
   - Prompt violations (e.g. multiple "Hi" when should be once)
   - Incomplete sentences/cut-off speech
   - Wrong tool usage (DTMF for humans)
   - Loops/repetitions

2. LOGIC ERRORS:
   - Wrong conversation flow
   - Missing context before pitch
   - Inappropriate responses

3. IMMEDIATE FIXES:
   - Prioritize by conversion impact
   - Specific evidence from THIS call
   - Actionable fixes, not vague advice

4. IF CALL FAILED:
   - List ALL critical failures
   - Exact moment customer was lost
   - Recovery opportunity missed

5. IF CALL SUCCEEDED:
   - What behaviors led to success
   - Patterns to replicate

EVIDENCE RULES:
✅ Quote exact phrases from transcript
✅ Count actual turns for talk ratio
✅ List concrete outcomes
❌ NO made-up information
❌ NO vague descriptions
❌ NO generic advice without evidence`;

(async () => {
  console.log('Обновляю QCI Standard промпт на детальную версию...\n');

  const { data, error } = await supabase
    .from('analysis_frameworks')
    .update({
      prompt_template: newPrompt,
      version: 'v2.0',
      description: 'Detailed QCI analysis with specific coaching tips, evidence, impact, and actionable fixes',
      model_config: {
        model: 'gpt-4o',
        temperature: 0.1,
        max_tokens: 3000
      },
      updated_at: new Date().toISOString()
    })
    .eq('name', 'QCI Standard')
    .select();

  if (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }

  console.log('✅ Промпт успешно обновлен!');
  console.log('Framework:', data[0].name);
  console.log('Version:', data[0].version);
  console.log('Model:', data[0].model_config.model);
  console.log('Max tokens:', data[0].model_config.max_tokens);
  console.log('Prompt length:', newPrompt.length, 'chars\n');

  console.log('📋 Изменения:');
  console.log('  ✓ Детальные coaching_tips с 4 полями (category, evidence, impact, fix)');
  console.log('  ✓ critical_failures - почему звонок провалился');
  console.log('  ✓ what_went_well - что делать дальше');
  console.log('  ✓ Требование цитировать exact quotes');
  console.log('  ✓ Анализ prompt violations (например множественные Hi)');
  console.log('  ✓ Контекст Biesse вместо Young Caesar\n');

  console.log('🔄 Теперь переанализируй проблемный звонок чтобы увидеть разницу!');
  console.log('\nКоманда:');
  console.log('node production_scripts/qci_analysis/qci_analyzer.js');
})();
