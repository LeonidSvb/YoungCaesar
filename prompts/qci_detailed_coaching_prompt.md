# DETAILED QCI COACHING ANALYSIS PROMPT

Analyze this VAPI call transcript for Quality Call Index (QCI) scoring WITH detailed coaching insights.

**Transcript:** "{transcript}"

**Assistant Context:** {assistant_name} - Biesse sales agent for CNC and woodworking machinery

---

## OUTPUT FORMAT (JSON only, no markdown):

```json
{
  "qci_total_score": 0-100,
  "dynamics_total": 0-30,
  "objections_total": 0-20,
  "brand_total": 0-20,
  "outcome_total": 0-30,

  "evidence": {
    "agent_talk_ratio": "XX%",
    "brand_mentions": ["exact quotes"],
    "outcomes": ["specific outcomes"],
    "key_moments": ["critical turning points with timestamps"]
  },

  "coaching_tips": [
    {
      "category": "Critical Bug|Logic Error|Best Practice|Optimization",
      "issue": "Short title of the problem",
      "evidence": "Exact quote or timestamp showing the issue",
      "impact": "How this hurts conversion/customer experience",
      "fix": "Specific actionable solution"
    }
  ],

  "critical_failures": [
    "List of deal-breaking mistakes that caused call failure"
  ],

  "what_went_well": [
    "Positive behaviors to reinforce (even in failed calls)"
  ]
}
```

---

## SCORING CRITERIA

### DYNAMICS (0-30 pts)
- **Talk ratio** (0-12 pts): Count "AI:" vs "User:" turns
  - Ideal 35-55%: 10-12 pts
  - Acceptable 25-35% or 55-70%: 6-9 pts
  - Poor <25% or >70%: 0-5 pts

- **Flow & timing** (0-12 pts):
  - Smooth, natural conversation: 10-12 pts
  - Some interruptions/awkward pauses: 6-9 pts
  - Loops, repetitions, or robotic: 0-5 pts

- **Engagement** (0-6 pts):
  - Active listening, relevant questions: 5-6 pts
  - Basic responses: 3-4 pts
  - Generic/scripted: 0-2 pts

### OBJECTIONS (0-20 pts)
- **Recognition** (0-7 pts): Did AI catch resistance/concerns?
- **Handling** (0-7 pts): Appropriate response to objections
- **Alternatives** (0-6 pts): Offered options/flexibility

### BRAND (0-20 pts) - Context aware
- For **Biesse** calls:
  - "Biesse" mentioned clearly: 15-20 pts
  - Professional but no brand mention: 5-10 pts
  - Poor/confusing: 0-5 pts

- For **Young Caesar** calls:
  - "Young Caesar" mentioned: 15-20 pts
  - Professional but no brand: 5-10 pts

### OUTCOME (0-30 pts)
- Meeting booked: 25-30 pts
- Warm lead (interested, wants info): 15-24 pts
- Callback arranged: 10-14 pts
- Basic info exchange: 5-9 pts
- Total failure: 0-4 pts

---

## COACHING TIPS REQUIREMENTS

**MUST include for every call:**

1. **Critical bugs** (if any):
   - Prompt violations (e.g. multiple "Hi" when prompt says "once only")
   - Incomplete sentences/cut-off speech
   - Wrong tool usage (DTMF for humans, etc)
   - State management failures (loops, repetitions)

2. **Logic errors** (if any):
   - Wrong conversation flow order
   - Missing context before pitch
   - Inappropriate responses to customer signals

3. **What to fix IMMEDIATELY**:
   - Prioritize by impact on conversion
   - Specific evidence from THIS call
   - Actionable fix (not vague advice)

4. **Patterns to watch**:
   - If this issue appears in multiple calls → systemic problem
   - Note if this is one-off vs recurring

---

## EVIDENCE RULES

✅ **DO:**
- Quote exact phrases from transcript
- Reference specific timestamps when critical
- Count actual turns for talk ratio
- List concrete outcomes achieved

❌ **DON'T:**
- Make up information not in transcript
- Use vague descriptions
- Give generic advice without evidence
- Assume context not explicitly stated

---

## SPECIAL CASES

**If call failed completely:**
1. List ALL critical failures that caused it
2. Prioritize fixes by impact
3. Note if this was recoverable or doomed from start

**If call succeeded:**
1. What behaviors led to success?
2. What could have made it even better?
3. Patterns to replicate

**If customer hung up:**
1. Identify the exact moment/phrase that lost them
2. What signal did AI miss?
3. Recovery opportunity that was missed

---

## RESPONSE TONE

- Direct, factual, specific
- Focus on WHAT happened and HOW to fix
- No sugarcoating - if it was terrible, say it
- Coaching is for improvement, not validation
