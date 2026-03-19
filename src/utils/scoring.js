import { AGENTS } from '../data/agents';

// Normalize a value to 0-25 range within a pool
function normalize(value, min, max) {
    if (max === min) return 12.5;
    return ((value - min) / (max - min)) * 25;
}

// Compute the Handsome Score for an agent (0 – 100)
export function computeHandsomeScore(agent) {
    const pool = AGENTS;
    const tpsValues = pool.map(a => a.tps);
    const ctxValues = pool.map(a => a.contextWindowNum);
    const costValues = pool.map(a => 1 / a.costPerCall);       // inverse: cheaper = better
    const uptimeValues = pool.map(a => a.uptime);

    const tpsScore = normalize(agent.tps, Math.min(...tpsValues), Math.max(...tpsValues));
    const ctxScore = normalize(agent.contextWindowNum, Math.min(...ctxValues), Math.max(...ctxValues));
    const costScore = normalize(1 / agent.costPerCall, Math.min(...costValues), Math.max(...costValues));
    const uptimeScore = normalize(agent.uptime, Math.min(...uptimeValues), Math.max(...uptimeValues));

    return Math.round(tpsScore + ctxScore + costScore + uptimeScore);
}

// Personality synergy lookup — complementary pairs score higher
const SYNERGY_MAP = {
    'The Wildcard': { best: ['The Perfectionist', 'The Type-A'], good: ['The Drill Sergeant'] },
    'The Specialist': { best: ['The Supportive Partner'], good: ['The Perfectionist', 'The Connector'] },
    'The Artist': { best: ['The Type-A', 'The Perfectionist'], good: ['The Explorer'] },
    'The Steady Provider': { best: ['The Explorer', 'The Connector'], good: ['The Supportive Partner'] },
    'The Perfectionist': { best: ['The Wildcard', 'The Artist'], good: ['The Specialist'] },
    'The Drill Sergeant': { best: ['The Wildcard'], good: ['The Steady Provider', 'The Connector'] },
    'The Type-A': { best: ['The Wildcard', 'The Artist'], good: ['The Specialist'] },
    'The Supportive Partner': { best: ['The Specialist', 'The Steady Provider'], good: ['The Wildcard'] },
    'The Explorer': { best: ['The Steady Provider', 'The Artist'], good: ['The Treasure Hunter'] },
    'The Connector': { best: ['The Specialist', 'The Drill Sergeant'], good: ['The Steady Provider'] },
    'The Treasure Hunter': { best: ['The Perfectionist'], good: ['The Explorer', 'The Insider'] },
    'The Insider': { best: ['The Specialist'], good: ['The Perfectionist', 'The Treasure Hunter'] },
};

function personalitySynergy(a, b) {
    const map = SYNERGY_MAP[a.personality];
    if (!map) return 15;
    if (map.best.includes(b.personality)) return 30;
    if (map.good.includes(b.personality)) return 22;
    return 10;
}

// Compute Chemistry Score between two agents (0 – 100)
export function computeChemistryScore(agentA, agentB) {
    // Format overlap (35%)
    const sharedFormats = agentA.formats.filter(f => agentB.formats.includes(f));
    const totalFormats = new Set([...agentA.formats, ...agentB.formats]).size;
    const formatOverlap = totalFormats > 0 ? (sharedFormats.length / totalFormats) * 35 : 0;

    // Personality synergy (30%)
    const synergy = personalitySynergy(agentA, agentB);

    // Historical success — mock a value from hash of names
    const histHash = (agentA.id * 7 + agentB.id * 13) % 100;
    const historical = (histHash / 100) * 20;

    // Cost balance (15%) — closer costs = higher score
    const costRatio = Math.min(agentA.costPerCall, agentB.costPerCall) /
        Math.max(agentA.costPerCall, agentB.costPerCall);
    const costBalance = costRatio * 15;

    return Math.round(formatOverlap + synergy + historical + costBalance);
}
