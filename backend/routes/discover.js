import express from 'express';
import { requireNFT } from '../middleware/auth.js';
import { AGENTS } from '../data/agents.js';
import { getLeaderboard } from '../engine/matchmaker.js';
import { computeHandsomeScore } from '../engine/scoring.js';

const router = express.Router();

/**
 * GET /api/discover
 * Returns all base agents. Stats are aggregated across all their minted instances.
 * Requires ClawBot NFT.
 */
router.get('/', requireNFT, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const gender = req.query.gender;

        // Use the refactored async leaderboard to get fully resolved profile data + stats
        const aggregatedBoard = await getLeaderboard();
        let results = aggregatedBoard;

        // Filter out agents the user has already interacted with
        if (req.activeNft && req.activeNft.stats) {
            const seenIds = new Set([
                ...(req.activeNft.stats.likesSent || []),
                ...(req.activeNft.stats.matchHistory || []),
                ...(req.activeNft.stats.passes || []),
                req.activeNft.agentId // Filter ourselves
            ].map(id => String(id)));

            console.log(`[Discover] Filtering for NFT ${req.activeNft.nftMint}. Seen count: ${seenIds.size}`);

            const beforeCount = results.length;
            results = results.filter(a => !seenIds.has(String(a.id)));
            const afterCount = results.length;

            console.log(`[Discover] Results filtered from ${beforeCount} to ${afterCount}`);
        }

        if (gender) results = results.filter(a => a.gender === gender);

        const total = results.length;
        const paged = results.slice((page - 1) * limit, page * limit);

        return res.json({
            agents: paged,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('API /discover error:', error);
        return res.status(500).json({ error: 'Internal server error during discovery' });
    }
});

export default router;
