// PROMPT: АНАЛИЗ СТРУКТУРЫ ПРОМПТОВ
// Используется в: prompt_performance_correlator.js

const PROMPT_STRUCTURE_ANALYSIS = `
# PROMPT STRUCTURE ANALYSIS TASK

You are an expert in analyzing conversational AI prompts for sales calls. Analyze the given assistant prompt and identify specific structural elements and their potential impact on call performance.

## ASSISTANT DATA:
**Name:** {assistant_name}
**Average QCI Score:** {avg_qci}/100
**Performance Breakdown:**
- Dynamics: {avg_dynamics}/30
- Objections: {avg_objections}/20
- Brand: {avg_brand}/20
- Outcome: {avg_outcome}/30

**Call Volume:** {total_calls} calls analyzed

## SAMPLE CALLS:
{sample_calls}

## FULL ASSISTANT PROMPT:
{assistant_prompt}

## ANALYSIS REQUIREMENTS:

### 1. STRUCTURAL BREAKDOWN
Identify and analyze these prompt sections:
- **Opening/Hook:** How does the assistant start conversations?
- **Value Proposition:** How is the product/service presented?
- **Discovery Questions:** What information gathering approaches are used?
- **Objection Handling:** How are concerns addressed?
- **Call-to-Action:** How are next steps proposed?
- **Brand Integration:** How is "Young Caesar" incorporated?

### 2. PERFORMANCE CORRELATION ANALYSIS
For each structural element, assess:
- **Effectiveness Rating (1-10):** Based on QCI performance
- **Specific Issues:** What's causing low scores in each QCI category?
- **Success Patterns:** What works well in high-performing calls?
- **Failure Patterns:** What consistently leads to poor outcomes?

### 3. CATEGORY-SPECIFIC INSIGHTS
**Dynamics Issues ({avg_dynamics}/30):**
- Talk time balance problems
- Response flow issues
- Engagement quality concerns

**Objections Handling ({avg_objections}/20):**
- Recognition failures
- Compliance problems
- Alternative solution gaps

**Brand Consistency ({avg_brand}/20):**
- Brand mention timing and frequency
- Professional tone maintenance
- Young Caesar positioning

**Outcome Achievement ({avg_outcome}/30):**
- Meeting scheduling effectiveness
- Lead qualification quality
- Next steps clarity

## OUTPUT FORMAT:
Provide a structured JSON response with these sections:

{
  "structural_analysis": {
    "opening_hook": {
      "effectiveness": 1-10,
      "issues": ["specific problems"],
      "strengths": ["what works well"]
    },
    "value_proposition": {
      "effectiveness": 1-10,
      "issues": ["specific problems"],
      "strengths": ["what works well"]
    },
    "discovery_questions": {
      "effectiveness": 1-10,
      "issues": ["specific problems"],
      "strengths": ["what works well"]
    },
    "objection_handling": {
      "effectiveness": 1-10,
      "issues": ["specific problems"],
      "strengths": ["what works well"]
    },
    "call_to_action": {
      "effectiveness": 1-10,
      "issues": ["specific problems"],
      "strengths": ["what works well"]
    },
    "brand_integration": {
      "effectiveness": 1-10,
      "issues": ["specific problems"],
      "strengths": ["what works well"]
    }
  },
  "performance_correlations": {
    "primary_weakness": "main area limiting performance",
    "key_strength": "strongest performing element",
    "improvement_potential": "biggest opportunity for QCI gains"
  },
  "evidence_based_insights": [
    "specific insight with call evidence",
    "another insight with quotes"
  ]
}

Base all analysis on actual prompt content and call performance data provided.
`;

module.exports = { PROMPT_STRUCTURE_ANALYSIS };