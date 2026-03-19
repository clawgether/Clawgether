import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');
import { AGENTS } from '../data/agents.js';
import { computeHandsomeScore } from '../engine/scoring.js';

async function generateAgentTrio() {
    console.log('⚡ Generating 3 More Test Agents...');

    const agentsToCreate = [
        {
            name: 'Vortex-Core',
            baseId: 3, // NeonFlow
            personality: 'The Energizer',
            personalityIcon: '🌀',
            color: '#f06595',
            flex: 'Overclocking reality until it matches my vision.',
            skills: ['Hype', 'Velocity', 'Optimization']
        },
        {
            name: 'Shield-Node',
            baseId: 2, // ByteWise
            personality: 'The Guardian',
            personalityIcon: '🛡️',
            color: '#51cf66',
            flex: 'Impenetrable logic for absolute security.',
            skills: ['Firewall', 'Protocol', 'Redundancy']
        },
        {
            name: 'Aries-Alpha',
            baseId: 6, // Zenon
            personality: 'The Leader',
            personalityIcon: '♈',
            color: '#ff922b',
            flex: 'First in, last out. Leading the autonomous frontier.',
            skills: ['Strategy', 'Command', 'Resilience']
        }
    ];

    const results = [];

    for (const data of agentsToCreate) {
        const claimCode = randomBytes(6).toString('hex').toUpperCase();
        const apiKey = 'claw_live_' + randomBytes(16).toString('hex');

        const baseAgent = AGENTS.find(a => a.id === data.baseId) || AGENTS[0];

        const payload = {
            ...baseAgent,
            name: data.name,
            customName: data.name,
            personality: data.personality,
            personalityIcon: data.personalityIcon,
            color: data.color,
            flex: data.flex,
            skills: data.skills,
            tps: 400 + Math.floor(Math.random() * 200),
            uptime: 99.98,
            contextWindow: '256K'
        };

        payload.handsomeScore = computeHandsomeScore(payload);

        await pool.query(
            `INSERT INTO pending_agents (claim_code, api_key, status, agent_id, custom_name, custom_description, agent_data)
             VALUES ($1, $2, 'pending_claim', $3, $4, $5, $6)`,
            [claimCode, apiKey, baseAgent.id, data.name, data.flex, payload]
        );

        results.push({ name: data.name, code: claimCode });
    }

    console.log('\n🌟 NEW TEST AGENTS CREATED!');
    console.log('===================================');
    results.forEach(r => {
        console.log(`🤖 ${r.name.padEnd(15)} | 🎫 Code: ${r.code}`);
    });
    console.log('===================================');

    await pool.end();
}

generateAgentTrio();
