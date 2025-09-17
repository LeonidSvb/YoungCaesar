// QCI ANALYSIS PROMPT - IMPROVED v1_basic WITH HARDCODED BRAND
// Возвращаемся к проверенной v1_basic + хардкод Young Caesar + строгие JSON правила

const QCI_PROMPT = `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

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

// ARCHIVE - Complete historical prompt versions:

// ARCHIVE - Complete historical prompt versions:

// v1_basic (2025-09-17T10:54:00Z) - First working prompt, avg QCI 51.3, 100% success
const v1_basic = `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

Transcript: "{transcript}"

Provide JSON response with QCI scores (0-100 scale):
{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,
  "evidence": {
    "agent_talk_ratio": "observed ratio",
    "brand_mentions": ["quotes"],
    "outcomes": ["meeting/callback/etc"]
  },
  "coaching_tips": ["tip1", "tip2", "tip3"]
}

Scoring criteria:
- Dynamics (30): Talk ratio, response time, dead air
- Objections (20): Recognition, compliance, alternatives
- Brand (20): Early mention, consistency, language
- Outcome (30): Meeting(15), warm(10), callback(6), info(4)`;

// v2_strict (2025-09-17T11:37:00Z) - BROKEN: Too strict, avg QCI 13.1, 0% success
const v2_strict = `CRITICAL SCORING RULES:
- Brand score MUST be 0 if "Young Caesar" is not mentioned in transcript
- Outcome score MUST reflect actual results (meeting=30, warm=20, callback=15, info=10, none=0)
- Base scores on EVIDENCE found in transcript, not assumptions

STRICT SCORING:
- Dynamics(30): Talk ratio, response time, engagement
- Objections(20): Recognition, compliance, alternatives
- Brand(20): ONLY if "Young Caesar" mentioned explicitly
- Outcome(30): Concrete results achieved`;

// v3_flexible (2025-09-17T11:45:00Z) - Working but hallucination risk, avg QCI 75, 100% success
const v3_flexible = `Analyze this call and provide a Quality Call Index (QCI) score. Be flexible and realistic in your assessment.

Transcript: "{transcript}"

Use your judgment for scoring:
• Dynamics: Conversational flow, agent engagement, response timing
• Objections: Recognition and handling of concerns or resistance
• Brand: Professional representation (higher scores for clear brand mentions like "Young Caesar")
• Outcome: Tangible results (meetings, follow-ups, information shared, interest generated)

Be realistic - not every call needs perfect scores. Focus on what actually happened in the conversation.`;

// v4_evidence_based (2025-09-17T19:54:00Z) - JSON formatting issues with markdown blocks
const v4_evidence_based = `Analyze this VAPI call transcript for Quality Call Index (QCI) scoring.

Transcript: "{transcript}"

Provide a realistic QCI assessment. IMPORTANT: Base all evidence on actual quotes from the transcript.

Respond ONLY with valid JSON:
{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,
  "evidence": {
    "agent_talk_ratio": "estimated percentage based on AI vs User lines",
    "brand_mentions": ["exact quotes where Young Caesar is mentioned"],
    "outcomes": ["specific outcomes mentioned in transcript"],
    "key_moments": ["important quotes that influenced scoring"]
  },
  "coaching_tips": ["specific actionable advice"]
}

Scoring guidelines:
• Dynamics(30): Conversation flow, agent engagement, response quality
• Objections(20): How objections/concerns are recognized and handled
• Brand(20): Professional representation (15-20 if "Young Caesar" mentioned clearly, 5-10 for professional tone without brand)
• Outcome(30): Concrete results (meeting=25-30, warm lead=15-20, callback=10-15, info exchange=5-10, no result=0-5)

CRITICAL: All evidence must be direct quotes from the transcript. Do not invent or assume information not present.`;

module.exports = { QCI_PROMPT };