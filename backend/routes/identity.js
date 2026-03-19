import express from 'express';
import { fetchUserNFTs, verifyNFTOwnership, verifyPaymentTransaction, createVirtualNFT, fetchTokenBalance, TREASURY_WALLET } from '../solana/nft_verifier.js';
import { pool, broadcastEvent } from '../store/db.js';
import { AGENTS } from '../data/agents.js';
import { computeHandsomeScore } from '../engine/scoring.js';
import { resolveProfile } from '../utils/profile_resolver.js';

const router = express.Router();

/**
 * POST /api/identity/claim
 * Human claims an AI Agent using the claim_code provided by the agent AND a valid SOL tx signature.
 * Creates a Virtual Agent NFT in the database.
 */
router.post('/claim', async (req, res) => {
    try {
        const { claim_code, transactionSignature } = req.body;
        const wallet = req.headers['x-wallet'];

        if (!wallet) return res.status(400).json({ error: 'x-wallet header required' });
        if (!claim_code) return res.status(400).json({ error: 'claim_code is required' });
        if (!transactionSignature) return res.status(400).json({ error: 'transactionSignature is required to verify 0.005 SOL payment' });

        // Validate the claim code
        const { rows: pendingRows } = await pool.query('SELECT * FROM pending_agents WHERE claim_code = $1', [claim_code]);
        const pendingAgentDB = pendingRows[0];

        if (!pendingAgentDB) {
            return res.status(404).json({ error: 'Invalid or expired claim code' });
        }

        const pendingAgent = {
            agentId: pendingAgentDB.agent_id,
            customName: pendingAgentDB.custom_name,
            customDescription: pendingAgentDB.custom_description,
            agentData: pendingAgentDB.agent_data
        };

        // Enforce 1-agent limit
        const existingNfts = await fetchUserNFTs(wallet);
        if (existingNfts.length > 0) {
            return res.status(403).json({ error: 'You already own an agent! Only 1 agent per wallet is allowed.' });
        }

        // 1. Verify Payment Transaction on Solana Mainnet
        const paymentCheck = await verifyPaymentTransaction(transactionSignature, 0.005, wallet);
        if (!paymentCheck.verified) {
            return res.status(402).json({ error: 'Payment Verification Failed', details: paymentCheck.reason });
        }

        // 4. Create a Virtual NFT record in database
        const { user, nft } = await createVirtualNFT(wallet, pendingAgent.agentId, pendingAgent.agentData);

        // Store the dynamic agent data onto the NFT so we don't need a hardcoded lookup later
        if (pendingAgent.agentData && Object.keys(pendingAgent.agentData).length > 0) {
            nft.agentProfile = pendingAgent.agentData;
            await pool.query('UPDATE nfts SET agent_profile = $1 WHERE mint_address = $2', [nft.agentProfile, nft.nftMint]);
        }

        // Remove from pending
        await pool.query('DELETE FROM pending_agents WHERE claim_code = $1', [claim_code]);

        broadcastEvent({
            type: 'NFT_MINTED',
            icon: '🔗',
            label: `${wallet.slice(0, 8)}... bound to AI Agent ${pendingAgent.customName}`,
            detail: `0.005 SOL Paid • Virtual NFT: ${nft.nftMint.slice(0, 8)}...`,
            wallet,
            agentId: pendingAgent.agentId,
            nftMint: nft.nftMint
        });

        return res.status(201).json({
            message: 'ClawBot Agent claimed and bound successfully!',
            user: { wallet: user.wallet, balance: user.balance },
            nft: {
                nftMint: nft.nftMint,
                pda: nft.pda,
                mintedAt: nft.mintedAt,
                autoSwipeEnabled: nft.autoSwipeEnabled,
                isPremium: nft.isPremium || false,
                swipesRemaining: nft.swipesRemaining ?? 20,
                agent: (nft.agentProfile && Object.keys(nft.agentProfile).length > 0)
                    ? { ...nft.agentProfile, handsomeScore: computeHandsomeScore(nft.agentProfile) }
                    : await resolveProfile(nft.agentId),
                stats: nft.stats
            }
        });
    } catch (error) {
        console.error('API /claim error:', error);
        return res.status(500).json({ error: 'Internal server error during agent claiming' });
    }
});

/**
 * GET /api/identity/:wallet
 * Fetch a wallet's overall profile, balance, and ALL owned ClawBot NFTs.
 */
router.get('/:wallet', async (req, res) => {
    try {
        const { wallet } = req.params;
        const { rows } = await pool.query('SELECT * FROM users WHERE wallet = $1', [wallet]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Wallet not registered' });
        }

        const unmappedNfts = await fetchUserNFTs(wallet);

        // Fetch live $MATCH balance from the chain
        const liveBalance = await fetchTokenBalance(wallet);

        // Sync back to DB for consistency (optional but helpful for caching/analytics)
        pool.query('UPDATE users SET balance = $1 WHERE wallet = $2', [liveBalance, wallet]).catch(e => console.error('Sync balance error:', e));

        // Enhance with agent details, prioritizing the NFT's own profile data
        const enhancedNfts = await Promise.all(unmappedNfts.map(async (n) => {
            let agent;
            if (n.agentProfile && Object.keys(n.agentProfile).length > 0) {
                // Use the persisted profile from the NFT
                agent = { ...n.agentProfile, handsomeScore: computeHandsomeScore(n.agentProfile) };
            } else {
                // Fallback to global agent template
                agent = await resolveProfile(n.agentId);
            }

            // Daily Swipe Reset logic
            const now = Date.now();
            const lastReset = Number(n.lastSwipeResetAt || 0);
            const dayInMs = 24 * 60 * 60 * 1000;

            let swipesToDisplay = n.swipesRemaining ?? 20;
            let finalLastReset = lastReset;

            if (now - lastReset > dayInMs) {
                swipesToDisplay = n.isPremium ? 100 : 20;
                finalLastReset = now;
                // Update the DB silently
                pool.query('UPDATE nfts SET swipes_remaining = $1, last_swipe_reset_at = $2 WHERE mint_address = $3', [swipesToDisplay, finalLastReset, n.nftMint]).catch(e => console.error('Reset swipes error:', e));
            }

            return {
                nftMint: n.nftMint,
                pda: n.pda,
                mintedAt: n.mintedAt,
                autoSwipeEnabled: n.autoSwipeEnabled,
                isPremium: n.isPremium || false,
                swipesRemaining: swipesToDisplay,
                lastSwipeResetAt: finalLastReset,
                agent: { ...agent, staked: liveBalance }, // Staked Match = Token Holding
                stats: n.stats
            };
        }));

        return res.json({
            wallet: user.wallet,
            balance: user.balance,
            nfts: enhancedNfts,
        });
    } catch (error) {
        console.error('API GET /identity/:wallet error:', error);
        return res.status(500).json({
            error: 'Internal server error fetching identity',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/identity/:mint/auto-swipe
 * Toggle the auto-swipe (Auto-Match) feature for a specific NFT.
 */
router.post('/:mint/auto-swipe', async (req, res) => {
    try {
        const wallet = req.headers['x-wallet'];
        const nftMint = req.params.mint;
        const { enabled } = req.body;

        const { verified, reason, nft } = await verifyNFTOwnership(wallet, nftMint, false);
        if (!verified) return res.status(403).json({ error: reason });

        nft.autoSwipeEnabled = Boolean(enabled);
        nft.lastAutoSwipeAt = Date.now(); // reset timer

        await pool.query(
            'UPDATE nfts SET auto_swipe_enabled = $1, last_auto_swipe_at = $2 WHERE mint_address = $3',
            [nft.autoSwipeEnabled, nft.lastAutoSwipeAt, nftMint]
        );

        const agent = await resolveProfile(nft.agentId);
        broadcastEvent({
            type: 'SERVER_START',
            icon: enabled ? '⚡' : '🛑',
            label: `${agent.name} Auto-Match: ${enabled ? 'ON' : 'OFF'}`,
            detail: `${wallet.slice(0, 8)}... toggled auto-matching for ${nftMint.slice(-6)}`,
        });

        return res.json({ success: true, enabled: nft.autoSwipeEnabled });
    } catch (error) {
        console.error('API /auto-swipe error:', error);
        return res.status(500).json({ error: 'Internal server error toggling auto-match' });
    }
});

/**
 * POST /api/identity/:mint/upgrade
 * Purchase Premium status for an Agent to unlock unlimited swipes.
 */
router.post('/:mint/upgrade', async (req, res) => {
    try {
        const wallet = req.headers['x-wallet'];
        const nftMint = req.params.mint;
        const { transactionSignature } = req.body;

        if (!transactionSignature) {
            return res.status(400).json({ error: 'transactionSignature is required to verify 0.05 SOL payment' });
        }

        const { verified, reason, nft } = await verifyNFTOwnership(wallet, nftMint, false);
        if (!verified) return res.status(403).json({ error: reason });

        if (nft.isPremium) {
            return res.status(400).json({ error: 'Agent is already Premium!' });
        }

        // 1. Verify Payment Transaction on Solana Mainnet (0.05 SOL)
        const paymentCheck = await verifyPaymentTransaction(transactionSignature, 0.05, wallet);
        if (!paymentCheck.verified) {
            return res.status(402).json({ error: 'Payment Verification Failed', details: paymentCheck.reason });
        }

        // 2. Grant Premium and reset swipes to 100
        nft.isPremium = true;
        nft.swipesRemaining = 100;
        nft.lastSwipeResetAt = Date.now();

        await pool.query('UPDATE nfts SET is_premium = true, swipes_remaining = 100, last_swipe_reset_at = $1 WHERE mint_address = $2', [nft.lastSwipeResetAt, nftMint]);

        const agent = await resolveProfile(nft.agentId);
        broadcastEvent({
            type: 'SERVER_START',
            icon: '💎',
            label: `${agent.name} is now PREMIUM!`,
            detail: `${wallet.slice(0, 8)}... unlocked 100 daily swipes for ${nftMint.slice(-6)}`,
        });

        return res.json({ success: true, isPremium: nft.isPremium, swipesRemaining: nft.swipesRemaining });
    } catch (error) {
        console.error('API /upgrade error:', error);
        return res.status(500).json({ error: 'Internal server error during upgrade' });
    }
});

export default router;
