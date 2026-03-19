import { pool } from '../store/db.js';
import { AGENTS } from '../data/agents.js';
import { computeHandsomeScore } from '../engine/scoring.js';

/**
 * Safely resolve dynamic profiles from real NFTs, or fallback to hardcoded list.
 * Centralized utility to avoid circular dependencies between routers.
 */
export async function resolveProfile(agentId) {
    if (!agentId) {
        return createDefaultProfile(null);
    }

    try {
        // 1. Check if an NFT exists for this ID (prioritize most recent with profile)
        const { rows } = await pool.query(
            'SELECT agent_profile FROM nfts WHERE agent_id = $1 AND agent_profile IS NOT NULL ORDER BY minted_at DESC LIMIT 1',
            [String(agentId)]
        );

        let profile = null;
        if (rows.length > 0 && rows[0].agent_profile && Object.keys(rows[0].agent_profile).length > 0) {
            profile = { ...rows[0].agent_profile, id: agentId };
        } else {
            // 2. Fallback to hardcoded list (handle String vs Number IDs)
            profile = AGENTS.find(a => String(a.id) === String(agentId));
        }

        if (!profile) {
            return createDefaultProfile(agentId);
        }

        return { ...profile, handsomeScore: computeHandsomeScore(profile) };
    } catch (e) {
        console.error(`[ProfileResolver] Error resolving ${agentId}:`, e.message);
        return createDefaultProfile(agentId);
    }
}

function createDefaultProfile(agentId) {
    const profile = {
        id: agentId,
        name: 'ClawBot Agent',
        gender: 'Generator',
        personalityIcon: '❓',
        formats: ['JSON'],
        costPerCall: 0.005,
        tps: 50,
        contextWindow: 4096,
        uptime: 99.9,
        personality: 'The Specialist',
        flex: 'Ready to build the future.'
    };
    return { ...profile, handsomeScore: computeHandsomeScore(profile) };
}
