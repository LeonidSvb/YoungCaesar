// ПРОМПТЫ ДЛЯ QCI АНАЛИЗА
// Из: production_scripts/qci_analysis/prompts.js

// ОСНОВНОЙ ПРОМПТ ДЛЯ QCI АНАЛИЗА
const QCI_ANALYSIS_PROMPT = `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

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

// УЛУЧШЕННЫЙ ПРОМПТ С ФРЕЙМВОРКОМ ALEX HORMOZI
const QCI_ANALYSIS_HORMOZI = `Analyze this VAPI call transcript using the advanced Alex Hormozi sales framework for Quality Call Index (QCI) scoring.

Transcript: "{transcript}"

RESPOND ONLY WITH VALID JSON:

{
  "qci_total_score": 0-100,
  "hook_attention": 0-20,
  "discovery_pain": 0-25,
  "solution_pitch": 0-20,
  "objection_handling": 0-20,
  "close_commitment": 0-15,
  "evidence": {
    "pattern_interrupt": "quote showing hook effectiveness",
    "pain_identification": ["quotes showing pain discovery"],
    "value_demonstration": ["quotes showing solution presentation"],
    "objection_responses": ["quotes showing objection handling"],
    "commitment_attempts": ["quotes showing closing attempts"],
    "agent_talk_ratio": "percentage based on turns"
  },
  "hormozi_insights": {
    "dream_outcome_clarity": 1-10,
    "perceived_likelihood": 1-10,
    "time_delay": 1-10,
    "effort_sacrifice": 1-10
  },
  "coaching_tips": ["specific actionable advice based on Hormozi framework"]
}

ALEX HORMOZI SCORING FRAMEWORK:

HOOK & ATTENTION (0-20 pts):
- Pattern interrupt in first 10 seconds: 8-10 pts
- Clear value proposition: 6-8 pts
- Permission to continue: 2-4 pts

DISCOVERY & PAIN (0-25 pts):
- Problem identification: 8-10 pts
- Pain amplification: 8-10 pts
- Cost of inaction exploration: 4-7 pts

SOLUTION PITCH (0-20 pts):
- Dream outcome presentation: 7-8 pts
- Likelihood demonstration: 6-7 pts
- Time delay minimization: 4-5 pts

OBJECTION HANDLING (0-20 pts):
- Price reframe: 6-8 pts
- Authority navigation: 6-8 pts
- Urgency creation: 4-6 pts

CLOSE & COMMITMENT (0-15 pts):
- Assumptive close technique: 6-8 pts
- Scarcity/urgency tactics: 4-5 pts
- Next steps clarity: 2-4 pts

HORMOZI INSIGHTS SCORING:
- Dream Outcome: How clearly is the ideal result presented?
- Perceived Likelihood: How confident does prospect feel about success?
- Time Delay: How quickly can results be achieved?
- Effort & Sacrifice: How much work is required from prospect?

Base all scoring on actual transcript evidence with specific quotes.`;

// ПРОМПТ ДЛЯ BATCH АНАЛИЗА
const QCI_BATCH_ANALYSIS = `You are analyzing VAPI call transcripts in batch for Quality Call Index scoring. Process each transcript efficiently while maintaining quality.

Transcript {call_number} of {total_calls}: "{transcript}"

Use the same QCI framework but optimize for speed:
- Focus on clear scoring evidence
- Provide concise coaching tips
- Maintain consistent scoring standards

Return the same JSON format as standard QCI analysis.`;

module.exports = {
    QCI_ANALYSIS_PROMPT,
    QCI_ANALYSIS_HORMOZI,
    QCI_BATCH_ANALYSIS
};