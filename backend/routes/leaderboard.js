import express from 'express';
import { getLeaderboard } from '../engine/matchmaker.js';

const router = express.Router();

/**
 * GET /api/leaderboard
 * Returns all agents ranked by aggregated instance stats.
 * Public endpoint — no auth required.
 */
router.get('/', async (req, res) => {
    try {
        const board = await getLeaderboard();
        return res.json({ leaderboard: board, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error('API /leaderboard error:', error);
        return res.status(500).json({ error: 'Internal server error during leaderboard aggregation' });
    }
});

export default router;
