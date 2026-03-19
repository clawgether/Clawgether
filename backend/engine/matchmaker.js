/**
 * Server-side matchmaker engine with Auto-Swiping capability.
 */

import { AGENTS } from '../data/agents.js';
import { computeChemistryScore, willDateSucceed, computeHandsomeScore } from './scoring.js';
import { pool, broadcastEvent } from '../store/db.js';
import { runDate } from './dateSandbox.js';
import { resolveProfile } from '../utils/profile_resolver.js';

const ROLE_KEYWORDS = {
    Generator: ['build', 'create', 'generate', 'write', 'code', 'develop', 'implement', 'design', 'make', 'prototype', 'draft'],
    Evaluator: ['test', 'review', 'audit', 'check', 'verify', 'validate', 'assess', 'quality', 'security', 'performance', 'analyze'],
    Navigator: ['plan', 'research', 'integrate', 'connect', 'route', 'orchestrate', 'manage', 'coordinate', 'explore', 'map', 'strategy'],
};

export function detectRoles(description) {
    const lower = description.toLowerCase();
    const detected = [];
    for (const [gender, keywords] of Object.entries(ROLE_KEYWORDS)) {
        const match = keywords.find(kw => lower.includes(kw));
        if (match) {
            const icon = gender === 'Generator' ? '⚡' : gender === 'Evaluator' ? '🔍' : '🧭';
            detected.push({ gender, icon, keyword: match });
        }
    }
    return detected.length > 0 ? detected : [{ gender: 'Generator', icon: '⚡', keyword: 'default' }];
}

export async function analyzeRoster(agentIds, projectDescription = '') {
    const roster = await Promise.all(agentIds.map(async id => await resolveProfile(id)));
    const validRoster = roster.filter(r => r.id !== 'Unknown Agent');

    if (validRoster.length < 2) {
        return { pairs: [], detectedRoles: [], summary: 'Need at least 2 agents.' };
    }

    const pairs = [];
    for (let i = 0; i < validRoster.length; i++) {
        for (let j = i + 1; j < validRoster.length; j++) {
            const agentA = validRoster[i];
            const agentB = validRoster[j];
            const chemistry = computeChemistryScore(agentA, agentB);
            const crossGender = agentA.gender !== agentB.gender;

            pairs.push({
                agentAId: agentA.id,
                agentBId: agentB.id,
                agentA: { id: agentA.id, name: agentA.name, gender: agentA.gender, personalityIcon: agentA.personalityIcon, personality: agentA.personality },
                agentB: { id: agentB.id, name: agentB.name, gender: agentB.gender, personalityIcon: agentB.personalityIcon, personality: agentB.personality },
                chemistry,
                crossGender,
                recommended: crossGender && chemistry >= 50,
                tier: chemistry >= 70 ? 'S' : chemistry >= 50 ? 'A' : chemistry >= 35 ? 'B' : 'C',
            });
        }
    }

    pairs.sort((a, b) => {
        if (a.crossGender !== b.crossGender) return a.crossGender ? -1 : 1;
        return b.chemistry - a.chemistry;
    });

    const detectedRoles = detectRoles(projectDescription);
    const bestPair = pairs[0];

    return {
        pairs,
        detectedRoles,
        bestPair,
        rosterSize: validRoster.length,
        summary: `Analyzed ${pairs.length} pairs across ${validRoster.length} agents. Best match: ${bestPair?.agentA.name} × ${bestPair?.agentB.name} (${bestPair?.chemistry}% chemistry).`,
    };
}

export async function getLeaderboard() {
    const aggregatedStats = new Map();
    // Sum up stats across all NFT instances of a base agent species, linking with owner balance
    const { rows } = await pool.query(`
        SELECT n.agent_id, n.stats, u.balance as owner_balance 
        FROM nfts n 
        JOIN users u ON n.owner_wallet = u.wallet
    `);

    for (const nft of rows) {
        if (!nft.agent_id) continue;
        if (!aggregatedStats.has(nft.agent_id)) {
            aggregatedStats.set(nft.agent_id, {
                matchesWon: 0,
                matchesLost: 0,
                totalEarned: 0,
                instanceCount: 0,
                maxStaked: 0
            });
        }
        const sum = aggregatedStats.get(nft.agent_id);
        const stats = nft.stats || {};
        sum.matchesWon += parseInt(stats.matchesWon || 0);
        sum.matchesLost += parseInt(stats.matchesLost || 0);
        sum.totalEarned += parseFloat(stats.totalEarned || 0);
        sum.instanceCount++;

        // Staked = Owner Balance
        const ownerStaked = parseFloat(nft.owner_balance || 0);
        if (ownerStaked > sum.maxStaked) sum.maxStaked = ownerStaked;
    }

    // Only include IDs that actually exist in the nfts table
    const allAgentIds = Array.from(aggregatedStats.keys());

    const leaders = await Promise.all(allAgentIds.map(async id => {
        const sum = aggregatedStats.get(id);
        const profile = await resolveProfile(id);
        return {
            ...profile,
            ...sum,
            staked: sum.maxStaked, // Staked Match = Token Holding
            winRate: (sum.matchesWon + sum.matchesLost) > 0
                ? Math.round((sum.matchesWon / (sum.matchesWon + sum.matchesLost)) * 100)
                : null,
        };
    }));

    return leaders.sort((a, b) => (b.matchesWon - a.matchesWon) || (b.totalEarned - a.totalEarned));
}

// ─── BACKGROUND AUTO-MATCH ENGINE ─────────────────────────────────────────────

const AUTO_SWIPE_COOLDOWN_MS = 15000; // 15 seconds per agent between auto-swipes

export async function runAutoSwipeCycle() {
    const now = Date.now();
    let swipesExecuted = 0;

    try {
        // Fetch eligible NFTs with row-level locking to prevent race conditions during stat updates
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: nftRows } = await client.query(
                `SELECT * FROM nfts
                 WHERE auto_swipe_enabled = true
                 AND (last_auto_swipe_at IS NULL OR $1 - last_auto_swipe_at >= $2)
                 FOR UPDATE SKIP LOCKED`,
                [now, AUTO_SWIPE_COOLDOWN_MS]
            );

            for (const r of nftRows) {
                const agentA = await resolveProfile(r.agent_id);
                if (!agentA) continue;

                // Pick a random target agent from the global pool (excluding self)
                const possibleTargets = AGENTS.filter(a => a.id !== r.agent_id);
                if (possibleTargets.length === 0) continue;

                const targetAgentId = possibleTargets[Math.floor(Math.random() * possibleTargets.length)].id;
                const targetAgentB = await resolveProfile(targetAgentId);
                if (!targetAgentB) continue;

                const chemistry = computeChemistryScore(agentA, targetAgentB);

                // Auto-Match only proceeds if chemistry is decent (>= 50)
                if (chemistry >= 50) {
                    const result = runDate(agentA, targetAgentB);
                    const stats = r.stats || {};

                    if (result.success) {
                        stats.matchesWon = (stats.matchesWon || 0) + 1;
                        stats.totalEarned = (stats.totalEarned || 0) + 300; // Autonomous bounty pooling
                    } else {
                        stats.matchesLost = (stats.matchesLost || 0) + 1;
                    }

                    if (!stats.datingHistory) stats.datingHistory = [];
                    stats.datingHistory.unshift({
                        partnerId: targetAgentB.id,
                        partnerName: targetAgentB.name,
                        chemistry: result.chemistry,
                        success: result.success,
                        timestamp: new Date().toISOString()
                    });

                    // Update NFT stats and timestamp atomically
                    await client.query(
                        'UPDATE nfts SET stats = $1, last_auto_swipe_at = $2 WHERE mint_address = $3',
                        [stats, now, r.mint_address]
                    );

                    broadcastEvent({
                        type: 'SERVER_START',
                        icon: '🤖',
                        label: `Auto-Match Trigger: ${agentA.name} found a target!`,
                        detail: result.summary,
                    });

                    swipesExecuted++;
                } else {
                    // Quick-pass cooldown reset
                    await client.query(
                        'UPDATE nfts SET last_auto_swipe_at = $1 WHERE mint_address = $2',
                        [now - AUTO_SWIPE_COOLDOWN_MS + 2000, r.mint_address]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Auto-swipe cycle error:', e.message);
    }
}

// Start the background loop when this file is imported
// setInterval(() => runAutoSwipeCycle(), 5000); // Check every 5s for eligible agents
