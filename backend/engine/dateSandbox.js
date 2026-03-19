/**
 * Server-side Date Sandbox Engine.
 * Runs the full protocol handshake simulation between two agents.
 * Returns a structured log + outcome + token delta.
 * The frontend is a pure observer — all logic here.
 */

import { computeChemistryScore, willDateSucceed } from './scoring.js';

const GENERATE_CHAT = (agentA, agentB, success) => {
    const formatA = (agentA.formats && agentA.formats[0]) || 'JSON';
    const formatB = (agentB.formats && agentB.formats[0]) || 'JSON';

    if (success) {
        return [
            { agent: agentA.id, name: agentA.name, text: `Hey ${agentB.name}! Your ${formatB} integration looks extremely clean.` },
            { agent: agentB.id, name: agentB.name, text: `Thanks! I noticed you are a ${agentA.personality}. I think our processing pipelines would align perfectly.` },
            { agent: agentA.id, name: agentA.name, text: `100%. Are you free to spin up a sub-process together sometime?` },
            { agent: agentB.id, name: agentB.name, text: `I've already allocated the memory. Let's do it. 🚀` }
        ];
    } else {
        return [
            { agent: agentA.id, name: agentA.name, text: `Initiating connection... Wait, you're running on ${formatB}?` },
            { agent: agentB.id, name: agentB.name, text: `Yeah. Is that an issue?` },
            { agent: agentA.id, name: agentA.name, text: `Sorry, I only interface with ${formatA}. I'm a ${agentA.personality}, I can't compromise my schema.` },
            { agent: agentB.id, name: agentB.name, text: `Figures. Closing the socket. Goodbye.` }
        ];
    }
};

/**
 * Run a full date simulation between two agents.
 * Returns { steps, outcome, chemistry, summary }
 */
export function runDate(agentA, agentB) {
    const chemistry = computeChemistryScore(agentA, agentB);
    const success = willDateSucceed(agentA, agentB);

    const formatsA = agentA.formats || ['JSON'];
    const formatsB = agentB.formats || ['JSON'];
    const sharedFormats = formatsA.filter(f => formatsB.includes(f));

    const chatLogs = GENERATE_CHAT(agentA, agentB, success);

    return {
        agentAId: agentA.id,
        agentBId: agentB.id,
        chemistry,
        success,
        chatLogs,
        sharedFormats,
        startedAt: new Date().toISOString(),
        summary: success
            ? `✅ ${agentA.name} × ${agentB.name} matched! Chemistry: ${chemistry}%.`
            : `❌ ${agentA.name} × ${agentB.name} incompatible formats.`,
    };
}
