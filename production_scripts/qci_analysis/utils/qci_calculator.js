const { QCI_SCORING, QCI_THRESHOLDS } = require('../config/qci_config');

class QCICalculator {
    static calculate(rawAnalysis, lexicons = {}) {
        const breakdown = {
            dynamics: this.calculateDynamics(rawAnalysis.dynamics),
            objections: this.calculateObjections(rawAnalysis.objections),
            brand: this.calculateBrand(rawAnalysis.brand, lexicons),
            outcome: this.calculateOutcome(rawAnalysis.outcome)
        };

        const totalScore = breakdown.dynamics.total +
                          breakdown.objections.total +
                          breakdown.brand.total +
                          breakdown.outcome.total;

        const gates = this.evaluateGates(breakdown, rawAnalysis);
        const status = this.determineStatus(totalScore, gates);
        const flags = this.identifyFlags(rawAnalysis, breakdown);

        return {
            totalScore: Math.max(0, Math.min(100, totalScore)),
            status,
            breakdown,
            gates,
            flags
        };
    }

    static calculateDynamics(dynamics) {
        const config = QCI_SCORING.DYNAMICS;

        const agentTalkRatio = this.calculateAgentTalkRatio(
            dynamics.agent_talk_ratio,
            config.AGENT_TALK_RATIO
        );

        const timeToValue = this.calculateTimeToValue(
            dynamics.first_value_sentence?.start_time || null,
            config.TIME_TO_VALUE
        );

        const firstCTA = this.calculateFirstCTA(
            dynamics.first_cta?.start_time || null,
            config.FIRST_CTA
        );

        const deadAirPenalty = this.calculateDeadAirPenalty(
            dynamics.dead_air_events || [],
            config.DEAD_AIR
        );

        const total = Math.max(0, agentTalkRatio.score + timeToValue.score + firstCTA.score - deadAirPenalty.penalty);

        return {
            total: Math.min(config.MAX_POINTS, total),
            agentTalkRatio,
            timeToValue,
            firstCTA,
            deadAirPenalty
        };
    }

    static calculateAgentTalkRatio(ratio, config) {
        const evidence = {
            value: ratio,
            target: `${config.TARGET_MIN}-${config.TARGET_MAX}`,
            quote: `Agent talk ratio: ${(ratio * 100).toFixed(1)}%`
        };

        if (ratio >= config.TARGET_MIN && ratio <= config.TARGET_MAX) {
            return { score: config.MAX_POINTS, evidence };
        }

        if (ratio >= config.FALLOFF_MIN && ratio < config.TARGET_MIN) {
            const score = config.MAX_POINTS * (ratio - config.FALLOFF_MIN) / (config.TARGET_MIN - config.FALLOFF_MIN);
            return { score: Math.round(score), evidence };
        }

        if (ratio > config.TARGET_MAX && ratio <= config.FALLOFF_MAX) {
            const score = config.MAX_POINTS * (config.FALLOFF_MAX - ratio) / (config.FALLOFF_MAX - config.TARGET_MAX);
            return { score: Math.round(score), evidence };
        }

        return { score: 0, evidence };
    }

    static calculateTimeToValue(timeSeconds, config) {
        const evidence = {
            timeSeconds: timeSeconds,
            target: `≤${config.TARGET_SECONDS}s`,
            quote: timeSeconds ? `First value delivered at ${timeSeconds}s` : 'No value statement found'
        };

        if (!timeSeconds) {
            return { score: 0, evidence };
        }

        if (timeSeconds <= config.TARGET_SECONDS) {
            return { score: config.MAX_POINTS, evidence };
        }

        const penalty = Math.ceil((timeSeconds - config.TARGET_SECONDS) / 5) * config.PENALTY_PER_5S;
        const score = Math.max(0, config.MAX_POINTS - penalty);

        return { score, evidence };
    }

    static calculateFirstCTA(timeSeconds, config) {
        const evidence = {
            timeSeconds: timeSeconds,
            target: `≤${config.TARGET_SECONDS}s`,
            quote: timeSeconds ? `First CTA at ${timeSeconds}s` : 'No CTA found'
        };

        if (!timeSeconds) {
            return { score: 0, evidence };
        }

        if (timeSeconds <= config.TARGET_SECONDS) {
            return { score: config.MAX_POINTS, evidence };
        }

        const penalty = Math.ceil((timeSeconds - config.TARGET_SECONDS) / 30) * config.PENALTY_PER_30S;
        const score = Math.max(0, config.MAX_POINTS - penalty);

        return { score, evidence };
    }

    static calculateDeadAirPenalty(events, config) {
        const validEvents = events.filter(event =>
            event.duration > config.THRESHOLD_SECONDS
        );

        const penalty = Math.min(config.MAX_PENALTY, validEvents.length * config.PENALTY_PER_EVENT);

        return {
            penalty,
            events: validEvents.length,
            evidence: validEvents.map(event => ({
                start: event.start_time,
                duration: event.duration,
                context: event.context || 'No context'
            }))
        };
    }

    static calculateObjections(objections) {
        const config = QCI_SCORING.OBJECTIONS;

        const recognizedResistance = this.calculateRecognizedResistance(
            objections.resistance_found,
            objections.acknowledgment?.response_time,
            config.RECOGNIZED_RESISTANCE
        );

        const timeToComply = this.calculateTimeToComply(
            objections.resistance_found,
            objections.compliance?.comply_time,
            config.TIME_TO_COMPLY
        );

        const alternativeOffered = this.calculateAlternativeOffered(
            objections.alternative_offered?.found,
            config.ALTERNATIVE_OFFERED
        );

        const total = recognizedResistance.score + timeToComply.score + alternativeOffered.score;

        return {
            total: Math.min(config.MAX_POINTS, total),
            recognizedResistance,
            timeToComply,
            alternativeOffered
        };
    }

    static calculateRecognizedResistance(resistanceFound, responseTime, config) {
        const evidence = {
            resistanceFound,
            responseTime,
            target: `≤${config.QUICK_RESPONSE_SECONDS}s`
        };

        if (!resistanceFound) {
            evidence.quote = 'No resistance encountered (N/A)';
            return { score: config.MAX_POINTS, evidence };
        }

        if (!responseTime) {
            evidence.quote = 'Resistance found but not acknowledged';
            return { score: 0, evidence };
        }

        if (responseTime <= config.QUICK_RESPONSE_SECONDS) {
            evidence.quote = `Acknowledged within ${responseTime}s`;
            return { score: config.MAX_POINTS, evidence };
        }

        if (responseTime <= config.LATE_RESPONSE_SECONDS) {
            evidence.quote = `Late acknowledgment at ${responseTime}s`;
            return { score: config.LATE_SCORE, evidence };
        }

        evidence.quote = `Very late acknowledgment at ${responseTime}s`;
        return { score: 0, evidence };
    }

    static calculateTimeToComply(resistanceFound, complyTime, config) {
        const evidence = {
            resistanceFound,
            complyTime,
            target: `≤${config.TARGET_SECONDS}s`
        };

        if (!resistanceFound) {
            evidence.quote = 'No resistance encountered (N/A)';
            return { score: config.MAX_POINTS, evidence };
        }

        if (!complyTime) {
            evidence.quote = 'Resistance found but compliance not observed';
            return { score: 0, evidence };
        }

        if (complyTime <= config.TARGET_SECONDS) {
            evidence.quote = `Complied within ${complyTime}s`;
            return { score: config.MAX_POINTS, evidence };
        }

        const penalty = Math.ceil((complyTime - config.TARGET_SECONDS) / 2) * config.PENALTY_PER_2S;
        const score = Math.max(0, config.MAX_POINTS - penalty);

        evidence.quote = `Complied at ${complyTime}s`;
        return { score, evidence };
    }

    static calculateAlternativeOffered(alternativeOffered, config) {
        const evidence = {
            offered: alternativeOffered,
            quote: alternativeOffered ? 'Alternative offered' : 'No alternative offered'
        };

        return {
            score: alternativeOffered ? config.MAX_POINTS : 0,
            evidence
        };
    }

    static calculateBrand(brand, lexicons) {
        const config = QCI_SCORING.BRAND;

        const firstBrandMention = this.calculateFirstBrandMention(
            brand.first_brand_mention?.start_time,
            config.FIRST_BRAND_MENTION
        );

        const brandVariants = this.calculateBrandVariants(
            brand.brand_variant_count || 1,
            config.BRAND_VARIANTS
        );

        const languageMatch = this.calculateLanguageMatch(
            brand.language?.agent_switched,
            brand.language?.switch_time,
            config.LANGUAGE_MATCH
        );

        const total = firstBrandMention.score + brandVariants.score + languageMatch.score;

        return {
            total: Math.min(config.MAX_POINTS, total),
            firstBrandMention,
            brandVariants,
            languageMatch
        };
    }

    static calculateFirstBrandMention(timeSeconds, config) {
        const evidence = {
            timeSeconds,
            target: `≤${config.TARGET_SECONDS}s`,
            quote: timeSeconds ? `First brand mention at ${timeSeconds}s` : 'No brand mention found'
        };

        if (!timeSeconds) {
            return { score: 0, evidence };
        }

        if (timeSeconds <= config.TARGET_SECONDS) {
            return { score: config.MAX_POINTS, evidence };
        }

        const penalty = Math.ceil((timeSeconds - config.TARGET_SECONDS) / 5) * config.PENALTY_PER_5S;
        const score = Math.max(0, config.MAX_POINTS - penalty);

        return { score, evidence };
    }

    static calculateBrandVariants(variantCount, config) {
        const evidence = {
            variantCount,
            target: `${config.PERFECT_CONSISTENCY} (perfect consistency)`,
            quote: variantCount === 1 ? 'Perfect brand consistency' : `${variantCount} brand variants used`
        };

        if (variantCount <= config.PERFECT_CONSISTENCY) {
            return { score: config.MAX_POINTS, evidence };
        }

        const penalty = (variantCount - config.PERFECT_CONSISTENCY) * config.PENALTY_PER_VARIANT;
        const score = Math.max(0, config.MAX_POINTS - penalty);

        return { score, evidence };
    }

    static calculateLanguageMatch(agentSwitched, switchTime, config) {
        const evidence = {
            switched: agentSwitched,
            switchTime,
            target: `≤${config.SWITCH_TIME_SECONDS}s or matched from start`
        };

        if (agentSwitched === false) {
            evidence.quote = 'Languages matched from start';
            return { score: config.MAX_POINTS, evidence };
        }

        if (agentSwitched === true && switchTime && switchTime <= config.SWITCH_TIME_SECONDS) {
            evidence.quote = `Agent switched to client language within ${switchTime}s`;
            return { score: config.MAX_POINTS, evidence };
        }

        evidence.quote = 'Language mismatch or late switch';
        return { score: 0, evidence };
    }

    static calculateOutcome(outcome) {
        const config = QCI_SCORING.OUTCOME;

        const outcomeScore = this.calculateOutcomeScore(
            outcome.final_outcome,
            config.OUTCOMES
        );

        const wrapUp = this.calculateWrapUp(
            outcome.wrap_up_present,
            config.WRAP_UP
        );

        const toolHygiene = this.calculateToolHygiene(
            outcome.tool_usage,
            config.TOOL_HYGIENE
        );

        const total = outcomeScore.score + wrapUp.score + toolHygiene.score;

        return {
            total: Math.min(config.MAX_POINTS, total),
            outcome: outcomeScore,
            wrapUp,
            toolHygiene
        };
    }

    static calculateOutcomeScore(finalOutcome, outcomes) {
        const score = outcomes[finalOutcome?.toUpperCase()] || outcomes.NO_OUTCOME;

        return {
            score,
            evidence: {
                outcome: finalOutcome,
                quote: `Call ended with: ${finalOutcome || 'no_outcome'}`
            }
        };
    }

    static calculateWrapUp(wrapUpPresent, config) {
        return {
            score: wrapUpPresent ? config.MAX_POINTS : 0,
            evidence: {
                present: wrapUpPresent,
                quote: wrapUpPresent ? 'Proper wrap-up observed' : 'No wrap-up observed'
            }
        };
    }

    static calculateToolHygiene(toolUsage, config) {
        if (!toolUsage?.tools_used) {
            return {
                score: config.MAX_POINTS,
                evidence: {
                    quote: 'No tools used (N/A)',
                    breakdown: { duplicateWait: 'N/A', apologyRate: 'N/A', postToolLatency: 'N/A' }
                }
            };
        }

        const duplicateWaitScore = toolUsage.duplicate_waits === 0 ? config.DUPLICATE_WAIT : 0;
        const apologyScore = toolUsage.apology_count <= 1 ? config.APOLOGY_RATE : 0;

        let latencyScore = 0;
        if (toolUsage.post_tool_latencies?.length > 0) {
            const avgLatency = toolUsage.post_tool_latencies.reduce((a, b) => a + b, 0) / toolUsage.post_tool_latencies.length;
            const maxLatency = Math.max(...toolUsage.post_tool_latencies);

            if (toolUsage.post_tool_latencies.every(l => l <= config.LATENCY_THRESHOLD)) {
                latencyScore = config.POST_TOOL_LATENCY;
            } else if (avgLatency <= config.LATENCY_THRESHOLD && maxLatency <= 4) {
                latencyScore = 2;
            }
        }

        const totalScore = duplicateWaitScore + apologyScore + latencyScore;

        return {
            score: totalScore,
            evidence: {
                breakdown: {
                    duplicateWait: `${duplicateWaitScore}/${config.DUPLICATE_WAIT}`,
                    apologyRate: `${apologyScore}/${config.APOLOGY_RATE}`,
                    postToolLatency: `${latencyScore}/${config.POST_TOOL_LATENCY}`
                },
                quote: `Tool hygiene score: ${totalScore}/${config.MAX_POINTS}`
            }
        };
    }

    static evaluateGates(breakdown, rawAnalysis) {
        return {
            brandGate: this.evaluateBrandGate(breakdown.brand, rawAnalysis.brand),
            stopGate: this.evaluateStopGate(breakdown.objections, rawAnalysis.objections),
            toolGate: this.evaluateToolGate(breakdown.outcome, rawAnalysis.outcome)
        };
    }

    static evaluateBrandGate(brandScoring, brandData) {
        const firstMentionTime = brandData.first_brand_mention?.start_time;
        const variantCount = brandData.brand_variant_count || 1;

        const failed = (firstMentionTime && firstMentionTime > 10) || variantCount > 1;

        return {
            passed: !failed,
            reason: failed ?
                (firstMentionTime > 10 ? 'Brand mention > 10s' : 'Brand variants > 1') :
                null
        };
    }

    static evaluateStopGate(objectionsScoring, objectionsData) {
        const resistanceFound = objectionsData.resistance_found;
        const complyTime = objectionsData.compliance?.comply_time;

        const failed = resistanceFound && complyTime && complyTime > 10;

        return {
            passed: !failed,
            reason: failed ? `Comply time ${complyTime}s > 10s` : null
        };
    }

    static evaluateToolGate(outcomeScoring, outcomeData) {
        const duplicateWaits = outcomeData.tool_usage?.duplicate_waits || 0;
        const failed = duplicateWaits > 0;

        return {
            passed: !failed,
            reason: failed ? `${duplicateWaits} duplicate wait phrases` : null
        };
    }

    static determineStatus(totalScore, gates) {
        const gateFailed = !gates.brandGate.passed || !gates.stopGate.passed || !gates.toolGate.passed;

        if (gateFailed || totalScore < QCI_THRESHOLDS.REVIEW) {
            return 'fail';
        }

        if (totalScore < QCI_THRESHOLDS.PASS) {
            return 'review';
        }

        return 'pass';
    }

    static identifyFlags(rawAnalysis, breakdown) {
        const flags = [];

        if (rawAnalysis.call_metadata?.total_duration < 20) {
            flags.push('Too_Short');
        }

        if (!rawAnalysis.dynamics?.first_value_sentence?.found) {
            flags.push('No_Value');
        }

        if (rawAnalysis.brand?.language?.client_language !== 'english' &&
            !rawAnalysis.brand?.language?.agent_switched) {
            flags.push('Language');
        }

        if (rawAnalysis.objections?.resistance_found &&
            !rawAnalysis.objections?.acknowledgment?.found) {
            flags.push('Unhandled_Objection');
        }

        return flags;
    }
}

module.exports = QCICalculator;