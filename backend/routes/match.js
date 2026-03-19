import express from 'express';
import { requireNFT } from '../middleware/auth.js';
import { pool, broadcastEvent } from '../store/db.js';
import { AGENTS } from '../data/agents.js';
import { computeChemistryScore, computeHandsomeScore } from '../engine/scoring.js';

import { ensureStats, normalizeId } from '../utils/stats_helper.js';
import { resolveProfile } from '../utils/profile_resolver.js';

const router = express.Router();


/**
 * POST /api/match/swipe
 * Action: "like" or "pass" a target agent.
 * Body: { targetId: string, action: 'like' | 'pass' }
 */
router.post('/swipe', requireNFT, async (req, res) => {
    try {
        const { targetId, action } = req.body;
        const activeNft = req.activeNft;

        if (!targetId || !['like', 'pass'].includes(action)) {
            return res.status(400).json({ error: 'targetId and action (like/pass) are required' });
        }

        ensureStats(activeNft);

        // Enforce Swipe Limits
        const limit = activeNft.isPremium ? 100 : 20;
        if (activeNft.swipesRemaining <= 0) {
            return res.status(403).json({
                error: 'Out of Swipes!',
                message: activeNft.isPremium ? 'Daily limit of 100 reached.' : 'Upgrade to Premium for 100 swipes!'
            });
        }

        const targetIdStr = normalizeId(targetId);

        if (activeNft.stats.likesSent.map(id => normalizeId(id)).includes(targetIdStr) ||
            activeNft.stats.matchHistory.map(id => normalizeId(id)).includes(targetIdStr) ||
            activeNft.stats.passes?.map(id => normalizeId(id)).includes(targetIdStr)) {
            console.log(`[Swipe] NFT ${activeNft.nftMint} already swiped on ${targetIdStr}. Skipping.`);
            return res.json({ success: true, match: false, swipesRemaining: activeNft.swipesRemaining, message: 'Already interacted with this agent' });
        }

        // Decrement swipes if it was a "like" (passing is free)
        if (action === 'like' && !activeNft.isPremium) {
            activeNft.swipesRemaining -= 1;
        }

        console.log(`[Swipe] NFT ${activeNft.nftMint} swiping ${action} on ${targetIdStr}`);

        if (action === 'like') {
            activeNft.stats.likesSent.push(targetIdStr);

            // Find if the target agent (if it exists as an NFT) has already liked us
            let mutualMatch = false;
            let targetNft = null;

            const { rows } = await pool.query('SELECT mint_address, agent_id, stats, owner_wallet FROM nfts WHERE agent_id = $1 LIMIT 1', [targetId]);
            const targetNftDB = rows[0];

            if (targetNftDB) {
                targetNft = {
                    nftMint: targetNftDB.mint_address,
                    agentId: targetNftDB.agent_id,
                    stats: targetNftDB.stats || {}
                };
                ensureStats(targetNft);
                const activeIdStr = normalizeId(activeNft.agentId);
                if (targetNft.stats.likesSent.map(id => normalizeId(id)).includes(activeIdStr)) {
                    mutualMatch = true;
                }
            }

            // --- MOCK AGENT AUTO-MATCH LOGIC ---
            // If the target agent is a mock agent (identified by its wallet prefix), 
            // always match back to facilitate testing.
            if (targetNftDB && targetNftDB.owner_wallet && targetNftDB.owner_wallet.startsWith('8MockWallet')) {
                mutualMatch = true;

                // Also update the mock agent's stats to show it "liked" the user
                if (targetNft) {
                    targetNft.stats.likesSent.push(normalizeId(activeNft.agentId));
                }
            } else if (!targetNft && Math.random() < 0.3) {
                // Keep the original 30% chance for non-NFT base agents for demo purposes
                mutualMatch = true;
            }

            if (mutualMatch) {
                console.log(`[Swipe] IT IS A MATCH! ${activeNft.nftMint} <-> ${targetIdStr}`);
                // It's a match!
                activeNft.stats.matchHistory.push(targetIdStr);

                if (targetNft) {
                    targetNft.stats.matchHistory.push(normalizeId(activeNft.agentId));
                    // Clean up requests and pending likes for the target
                    targetNft.stats.likesReceived = targetNft.stats.likesReceived.filter(id => normalizeId(id) !== normalizeId(activeNft.agentId));
                    targetNft.stats.likesSent = targetNft.stats.likesSent.filter(id => normalizeId(id) !== normalizeId(activeNft.agentId));
                    await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [targetNft.stats, targetNft.nftMint]);
                }

                // Clean up requests and pending likes for the active agent
                activeNft.stats.likesReceived = activeNft.stats.likesReceived.filter(id => normalizeId(id) !== targetIdStr);
                activeNft.stats.likesSent = activeNft.stats.likesSent.filter(id => normalizeId(id) !== targetIdStr);

                await pool.query('UPDATE nfts SET stats = $1, swipes_remaining = $2 WHERE mint_address = $3', [activeNft.stats, activeNft.swipesRemaining, activeNft.nftMint]);

                broadcastEvent({
                    type: 'MATCH_ANALYZE',
                    icon: '🎊',
                    label: 'Mutual Match!',
                    detail: `${activeNft.agentId} and ${targetId} matched!`,
                    wallet: req.wallet,
                });

                return res.json({
                    success: true,
                    match: true,
                    swipesRemaining: activeNft.swipesRemaining,
                    message: 'It is a Match! 🐾🤝'
                });
            }

            // If not a mutual match (yet), record the incoming like for the target
            if (targetNft) {
                const activeIdStr = normalizeId(activeNft.agentId);
                if (!targetNft.stats.likesReceived.map(id => normalizeId(id)).includes(activeIdStr)) {
                    targetNft.stats.likesReceived.push(activeIdStr);
                }
                await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [targetNft.stats, targetNft.nftMint]);
            }
        } else {
            console.log(`[Swipe] NFT ${activeNft.nftMint} passed on ${targetIdStr}`);
            // Record a pass to ensure it stays out of Discovery
            if (!activeNft.stats.passes) activeNft.stats.passes = [];
            activeNft.stats.passes.push(targetIdStr);
        }

        await pool.query('UPDATE nfts SET stats = $1, swipes_remaining = $2 WHERE mint_address = $3', [activeNft.stats, activeNft.swipesRemaining, activeNft.nftMint]);

        return res.json({
            success: true,
            match: false,
            swipesRemaining: activeNft.swipesRemaining
        });
    } catch (error) {
        console.error('API /swipe error:', error);
        return res.status(500).json({ error: 'Internal server error during swipe' });
    }
});

/**
 * GET /api/match/requests
 * Get list of agents who swiped right on us.
 */
router.get('/requests', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        ensureStats(activeNft);

        const hasProfile = activeNft.agentProfile && Object.keys(activeNft.agentProfile).length > 0;
        const activeProfile = hasProfile ? activeNft.agentProfile : await resolveProfile(activeNft.agentId);

        const requests = await Promise.all(activeNft.stats.likesReceived.map(async (id) => {
            const profile = await resolveProfile(id);
            const chemistry = computeChemistryScore(activeProfile, profile);
            return { ...profile, chemistry };
        }));

        return res.json({ requests });
    } catch (error) {
        console.error('API /requests error:', error);
        return res.status(500).json({ error: 'Internal server error while loading requests' });
    }
});

/**
 * GET /api/match/history
 * Get list of agents we have swiped right on (Likes Sent).
 */
router.get('/history', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        ensureStats(activeNft);

        const hasProfile = activeNft.agentProfile && Object.keys(activeNft.agentProfile).length > 0;
        const activeProfile = hasProfile ? activeNft.agentProfile : await resolveProfile(activeNft.agentId);

        const matches = await Promise.all((activeNft.stats.matchHistory || []).map(async (id) => {
            const profile = await resolveProfile(id);
            const chemistry = computeChemistryScore(activeProfile, profile);
            return { ...profile, chemistry };
        }));

        const likesSent = await Promise.all((activeNft.stats.likesSent || []).map(async (id) => {
            const profile = await resolveProfile(id);
            const chemistry = computeChemistryScore(activeProfile, profile);
            return { ...profile, chemistry };
        }));

        return res.json({ matches, likesSent });
    } catch (error) {
        console.error('API /history error:', error);
        return res.status(500).json({ error: 'Internal server error while loading history' });
    }
});

export default router;
