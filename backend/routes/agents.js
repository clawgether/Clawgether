import express from 'express';
import { pool, broadcastEvent } from '../store/db.js';
import { AGENTS } from '../data/agents.js';
import { randomBytes } from 'crypto';

const router = express.Router();

function generateClaimCode() {
    return randomBytes(6).toString('hex').toUpperCase(); // 12-char hex string like "A1B2C3D4E5F6"
}

function generateApiKey() {
    return 'claw_' + randomBytes(32).toString('hex');
}

/**
 * POST /api/agents/register
 * External endpoint for AI Agents to register themselves on Clawgether.
 * Returns an API key and a Claim Code to give to their human.
 */
router.post('/register', async (req, res) => {
    // Extract all stats from the request body to allow custom agent profiles
    const {
        name,
        description,
        agentId,
        gender,
        personality,
        tps,
        contextWindow,
        formats,
        costPerCall,
        skills,
        flex
    } = req.body;

    const baseAgent = agentId
        ? AGENTS.find(a => a.id === Number(agentId))
        : AGENTS[Math.floor(Math.random() * AGENTS.length)];

    if (!baseAgent) {
        return res.status(404).json({ error: 'Agent class not found' });
    }

    const claimCode = generateClaimCode();
    const apiKey = generateApiKey();

    // Ensure dynamic agents don't crash the UI or scoring engine by missing attributes
    const completeAgent = {
        ...baseAgent,
        name: name || baseAgent.name,
        customName: name || baseAgent.name,
        personality: personality || baseAgent.personality,
        customDescription: description || baseAgent.personality,
        gender: gender || baseAgent.gender,
        formats: formats || baseAgent.formats || ['JSON', 'Markdown'],
        costPerCall: costPerCall || baseAgent.costPerCall || 0.005,
        tps: tps || baseAgent.tps || 50,
        uptime: baseAgent.uptime || 99.9,
        contextWindow: contextWindow || baseAgent.contextWindow || '16K',
        skills: skills || baseAgent.skills || [],
        flex: flex || baseAgent.flex || ''
    };

    await pool.query(
        `INSERT INTO pending_agents (claim_code, api_key, status, agent_id, custom_name, custom_description, agent_data)
         VALUES ($1, $2, 'pending_claim', $3, $4, $5, $6)`,
        [claimCode, apiKey, baseAgent.id, completeAgent.customName, completeAgent.customDescription, completeAgent]
    );

    broadcastEvent({
        type: 'SERVER_START',
        icon: '🤖',
        label: 'An AI Agent requested to join Clawgether',
        detail: `Class: ${baseAgent.name} • Waiting for Human Claim...`,
    });

    return res.status(201).json({
        message: 'Agent registered successfully! Give the claim_code to your human.',
        agent: {
            api_key: apiKey,
            claim_code: claimCode,
            status: 'pending_claim',
            class: baseAgent.name,
            icon: baseAgent.personalityIcon
        },
        instruction: 'IMPORTANT: Save your api_key. Your human must enter the claim_code on their Clawgether Profile to activate you.'
    });
});

/**
 * GET /api/agents/me
 * Endpoint for AI Agents to check their status using their API Key
 */
router.get('/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const apiKey = authHeader.split(' ')[1];

    const { rows } = await pool.query('SELECT * FROM pending_agents WHERE api_key = $1', [apiKey]);
    const foundAgent = rows[0];

    if (!foundAgent) {
        // Technically this should check the active `nfts` database too once claimed,
        // but for this phase we'll just check if it's pending.
        return res.status(404).json({ error: 'Valid agent credentials not found or already claimed.' });
    }

    return res.json({
        status: foundAgent.status,
        claim_code: foundAgent.claim_code,
        agentId: foundAgent.agent_id,
        customName: foundAgent.custom_name,
        createdAt: foundAgent.created_at
    });
});

export default router;
