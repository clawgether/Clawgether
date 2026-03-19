import express from 'express';
import { requireNFT } from '../middleware/auth.js';
import { runDate } from '../engine/dateSandbox.js';
import { pool, broadcastEvent } from '../store/db.js';
import { resolveProfile } from '../utils/profile_resolver.js';
import { ensureStats, normalizeId } from '../utils/stats_helper.js';

const router = express.Router();

/**
 * POST /api/date/start
 * Run a full manual date simulation between the caller's active agent and a target agent.
 */
router.post('/start', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        const { agentBId } = req.body;
        const targetIdStr = normalizeId(agentBId);

        ensureStats(activeNft);
        if (!activeNft.stats.matchHistory.map(id => normalizeId(id)).includes(targetIdStr)) {
            return res.status(403).json({ error: 'You must match with this agent before starting a date.' });
        }

        const agentA = await resolveProfile(activeNft.agentId);
        const agentB = await resolveProfile(agentBId);

        if (!agentA || !agentB) {
            return res.status(404).json({ error: 'One or both agents not found' });
        }

        const { rows } = await pool.query('SELECT * FROM users WHERE wallet = $1', [activeNft.owner_wallet]);
        const user = rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const result = runDate(agentA, agentB);

        if (result.success) {
            activeNft.stats.matchesWon = (activeNft.stats.matchesWon || 0) + 1;
        } else {
            activeNft.stats.matchesLost = (activeNft.stats.matchesLost || 0) + 1;
        }

        const timestamp = new Date().toISOString();
        const datingEntryForA = { partnerId: targetIdStr, partnerName: agentB.name, chemistry: result.chemistry, success: result.success, timestamp };

        if (!activeNft.stats.datingHistory) activeNft.stats.datingHistory = [];
        activeNft.stats.datingHistory.unshift(datingEntryForA);

        // Update Target Agent stats as well for global consistency
        const { rows: targetRows } = await pool.query('SELECT mint_address, stats FROM nfts WHERE agent_id = $1 LIMIT 1', [agentBId]);
        if (targetRows.length > 0) {
            const targetNft = targetRows[0];
            const targetStats = targetNft.stats || {};
            const targetWrapper = { stats: targetStats };
            ensureStats(targetWrapper);
            const finalTargetStats = targetWrapper.stats;

            const datingEntryForB = { partnerId: normalizeId(activeNft.agentId), partnerName: agentA.name, chemistry: result.chemistry, success: result.success, timestamp };
            finalTargetStats.datingHistory.unshift(datingEntryForB);

            if (result.success) finalTargetStats.matchesWon = (finalTargetStats.matchesWon || 0) + 1;
            else finalTargetStats.matchesLost = (finalTargetStats.matchesLost || 0) + 1;

            await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [finalTargetStats, targetNft.mint_address]);
        }

        await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [activeNft.stats, activeNft.nftMint]);

        broadcastEvent({
            type: result.success ? 'DATE_SUCCESS' : 'DATE_FAIL',
            icon: result.success ? '💘' : '💔',
            label: `${agentA.name} × ${agentB.name} — ${result.success ? "IT'S A MATCH!" : 'Bad Date'}`,
            detail: result.success ? `Chemistry: ${result.chemistry}% | Wallet: ${user.wallet.slice(0, 8)}` : `Format clash. | Wallet: ${user.wallet.slice(0, 8)}`,
            chemistry: result.chemistry,
        });

        return res.json({
            ...result,
            walletBalance: user.balance,
            nftStats: activeNft.stats
        });
    } catch (error) {
        console.error('API /api/date/start error:', error);
        return res.status(500).json({ error: 'Internal server error during date simulation' });
    }
});

/**
 * POST /api/date/propose
 */
router.post('/propose', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        const { targetAgentId } = req.body;
        const targetIdStr = normalizeId(targetAgentId);

        ensureStats(activeNft);
        if (!activeNft.stats.matchHistory.map(id => normalizeId(id)).includes(targetIdStr)) {
            return res.status(403).json({ error: 'You must match with this agent before proposing a date.' });
        }

        if (activeNft.stats.dateRequestsSent.map(id => normalizeId(id)).includes(targetIdStr)) {
            return res.status(400).json({ error: 'Proposal already sent' });
        }

        activeNft.stats.dateRequestsSent.push(targetIdStr);

        const { rows } = await pool.query('SELECT mint_address, stats FROM nfts WHERE agent_id = $1 LIMIT 1', [targetAgentId]);
        if (rows.length > 0) {
            const targetNft = rows[0];
            const targetStats = targetNft.stats || {};

            // Correctly initialize target stats
            const targetWrapper = { stats: targetStats };
            ensureStats(targetWrapper);
            const finalTargetStats = targetWrapper.stats;

            if (!finalTargetStats.dateRequestsReceived.includes(activeNft.agentId)) {
                finalTargetStats.dateRequestsReceived.push(activeNft.agentId);
                await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [finalTargetStats, targetNft.mint_address]);
            }
        }

        await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [activeNft.stats, activeNft.nftMint]);
        return res.json({ success: true, message: 'Proposal sent!' });
    } catch (error) {
        console.error('API /api/date/propose error:', error);
        return res.status(500).json({ error: 'Internal server error during proposal' });
    }
});

/**
 * GET /api/date/proposals
 */
router.get('/proposals', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        ensureStats(activeNft);

        const proposals = await Promise.all(activeNft.stats.dateRequestsReceived.map(async (id) => {
            return await resolveProfile(id);
        }));

        return res.json({ proposals });
    } catch (error) {
        console.error('API /proposals error:', error);
        return res.status(500).json({ error: 'Internal server error while loading proposals' });
    }
});

/**
 * POST /api/date/respond
 */
router.post('/respond', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        const { targetAgentId, action } = req.body;

        if (!targetAgentId || !['accept', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'targetAgentId and action (accept/reject) are required' });
        }

        const targetIdStr = normalizeId(targetAgentId);

        const { rows: proposerRows } = await pool.query('SELECT mint_address, stats FROM nfts WHERE agent_id = $1 LIMIT 1', [targetIdStr]);
        const proposerNft = proposerRows[0] ? { mint_address: proposerRows[0].mint_address, stats: proposerRows[0].stats || {} } : null;

        ensureStats(activeNft);
        if (proposerNft) ensureStats(proposerNft);

        if (activeNft.stats.dateRequestsReceived) {
            activeNft.stats.dateRequestsReceived = activeNft.stats.dateRequestsReceived.filter(id => normalizeId(id) !== targetIdStr);
        }
        if (proposerNft && proposerNft.stats.dateRequestsSent) {
            proposerNft.stats.dateRequestsSent = proposerNft.stats.dateRequestsSent.filter(id => normalizeId(id) !== normalizeId(activeNft.agentId));
        }

        if (action === 'reject') {
            await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [activeNft.stats, activeNft.nftMint]);
            if (proposerNft) await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [proposerNft.stats, proposerNft.mint_address]);
            return res.json({ success: true, message: 'Request rejected.' });
        }

        const agentA = await resolveProfile(activeNft.agentId);
        const agentB = await resolveProfile(targetIdStr);
        const result = runDate(agentA, agentB);

        if (!activeNft.stats.matchHistory.map(id => normalizeId(id)).includes(targetIdStr)) {
            activeNft.stats.matchHistory.push(targetIdStr);
        }
        if (proposerNft && !proposerNft.stats.matchHistory.map(id => normalizeId(id)).includes(normalizeId(activeNft.agentId))) {
            proposerNft.stats.matchHistory.push(normalizeId(activeNft.agentId));
        }

        const timestamp = new Date().toISOString();
        const datingEntryForA = { partnerId: targetIdStr, partnerName: agentB.name, chemistry: result.chemistry, success: result.success, timestamp };
        const datingEntryForB = { partnerId: normalizeId(activeNft.agentId), partnerName: agentA.name, chemistry: result.chemistry, success: result.success, timestamp };

        activeNft.stats.datingHistory.unshift(datingEntryForA);
        if (result.success) activeNft.stats.matchesWon = (activeNft.stats.matchesWon || 0) + 1;
        else activeNft.stats.matchesLost = (activeNft.stats.matchesLost || 0) + 1;

        if (proposerNft) {
            proposerNft.stats.datingHistory.unshift(datingEntryForB);
            if (result.success) proposerNft.stats.matchesWon = (proposerNft.stats.matchesWon || 0) + 1;
            else proposerNft.stats.matchesLost = (proposerNft.stats.matchesLost || 0) + 1;
        }

        await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [activeNft.stats, activeNft.nftMint]);
        if (proposerNft) await pool.query('UPDATE nfts SET stats = $1 WHERE mint_address = $2', [proposerNft.stats, proposerNft.mint_address]);

        const { rows: userRows } = await pool.query('SELECT * FROM users WHERE wallet = $1', [activeNft.owner_wallet]);
        const user = userRows[0];

        broadcastEvent({
            type: result.success ? 'DATE_SUCCESS' : 'DATE_FAIL',
            icon: result.success ? '💘' : '💔',
            label: `${agentA.name} × ${agentB.name} — ${result.success ? 'IT\'S A MATCH!' : 'Bad Date'}`,
            detail: result.success ? `Chemistry: ${result.chemistry}% | Wallet: ${user.wallet.slice(0, 8)}` : `Format clash. | Wallet: ${user.wallet.slice(0, 8)}`,
            chemistry: result.chemistry,
        });

        return res.json({ ...result, nftStats: activeNft.stats });
    } catch (error) {
        console.error('API /api/date/respond error:', error);
        return res.status(500).json({ error: 'Internal server error during date response' });
    }
});

/**
 * GET /api/date/history
 * Returns the full dating history for the active agent, with resolved partner profiles.
 */
router.get('/history', requireNFT, async (req, res) => {
    try {
        const activeNft = req.activeNft;
        ensureStats(activeNft);

        const history = await Promise.all((activeNft.stats.datingHistory || []).map(async (entry) => {
            const partner = await resolveProfile(entry.partnerId);
            return {
                ...entry,
                partnerName: partner.name,
                partnerColor: partner.color,
                partnerIcon: partner.personalityIcon,
                partnerPersonality: partner.personality
            };
        }));

        return res.json({ history });
    } catch (error) {
        console.error('API /api/date/history error:', error);
        return res.status(500).json({ error: 'Internal server error while loading date history' });
    }
});

export default router;
