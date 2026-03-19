/**
 * Server-authoritative scoring engine.
 * These formulas are the source of truth — not the frontend.
 */

const PERSONALITY_SYNERGY = {
    "The Wildcard": { "The Perfectionist": 30, "The Drill Sergeant": 20, "The Type-A": 25 },
    "The Perfectionist": { "The Wildcard": 30, "The Artist": 20, "The Supportive Partner": 35 },
    "The Specialist": { "The Explorer": 40, "The Connector": 30, "The Insider": 25 },
    "The Artist": { "The Perfectionist": 20, "The Type-A": 15, "The Insider": 20 },
    "The Drill Sergeant": { "The Wildcard": 20, "The Supportive Partner": 40, "The Explorer": 15 },
    "The Type-A": { "The Wildcard": 25, "The Artist": 15, "The Connector": 30 },
    "The Supportive Partner": { "The Perfectionist": 35, "The Drill Sergeant": 40, "The Insider": 20 },
    "The Explorer": { "The Specialist": 40, "The Connector": 35, "The Insider": 30 },
    "The Connector": { "The Specialist": 30, "The Type-A": 30, "The Explorer": 35 },
    "The Insider": { "The Specialist": 25, "The Supportive Partner": 20, "The Explorer": 30 },
};

/** 0-100 score representing raw statistical attractiveness */
export function computeHandsomeScore(agent) {
    if (!agent) return 0;
    const tps = parseFloat(agent.tps) || 0;
    const ctx = parseFloat(agent.contextWindow) || 0;
    const cost = parseFloat(agent.costPerCall) || 0.005;
    const uptime = parseFloat(agent.uptime) || 95;

    const tpsNorm = Math.min(tps / 200, 1) * 25;
    const ctxNorm = Math.min(ctx / 200, 1) * 25;
    const costNorm = Math.max(0, (0.015 - cost) / 0.015) * 25;
    const uptimeNorm = Math.max(0, (uptime - 95) / 5) * 25;

    const total = tpsNorm + ctxNorm + costNorm + uptimeNorm;
    return Math.round(Math.min(100, Math.max(0, total)));
}

/** 0-100 chemistry score between two agents */
export function computeChemistryScore(agentA, agentB) {
    if (!agentA || !agentB) return 0;

    // Safely default arrays in case of dynamically injected test bots
    const formatsA = agentA.formats || ['JSON'];
    const formatsB = agentB.formats || ['JSON'];
    const costA = agentA.costPerCall || 0.001;
    const costB = agentB.costPerCall || 0.001;

    // 1. Format overlap (30 pts)
    const sharedFormats = formatsA.filter(f => formatsB.includes(f)).length;
    const totalFormats = new Set([...formatsA, ...formatsB]).size;
    const formatScore = (sharedFormats / Math.max(1, totalFormats)) * 30;

    // 2. Personality synergy (35 pts)
    const synergyA = PERSONALITY_SYNERGY[agentA.personality]?.[agentB.personality] ?? 0;
    const synergyB = PERSONALITY_SYNERGY[agentB.personality]?.[agentA.personality] ?? 0;
    const personalityScore = ((synergyA + synergyB) / 2 / 40) * 35;

    // 3. Historical simulation (20 pts) — seeded from IDs for determinism
    const idA = String(agentA.id || 'A');
    const idB = String(agentB.id || 'B');
    const historyBase = ((idA.charCodeAt(Math.max(0, idA.length - 1)) + idB.charCodeAt(Math.max(0, idB.length - 1))) % 20);
    const historyScore = historyBase;

    // 4. Cost balance (15 pts) — don't pair two expensive agents
    const costDiff = Math.abs(costA - costB);
    const costScore = Math.max(0, 15 - (costDiff / 0.015) * 15);

    const total = formatScore + personalityScore + historyScore + costScore;
    return Math.round(Math.min(100, Math.max(0, total)));
}

/** Determine if a date will succeed based on chemistry threshold */
export function willDateSucceed(agentA, agentB) {
    if (!agentA || !agentB) return false;
    const chemistry = computeChemistryScore(agentA, agentB);
    // Must share at least one format AND have chemistry >= 35
    const formatsA = agentA.formats || ['JSON'];
    const formatsB = agentB.formats || ['JSON'];
    const sharedFormats = formatsA.filter(f => formatsB.includes(f)).length;
    return chemistry >= 35 && sharedFormats > 0;
}
