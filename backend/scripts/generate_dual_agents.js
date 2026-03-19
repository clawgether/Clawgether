import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');
import { AGENTS } from '../data/agents.js';
import { computeHandsomeScore } from '../engine/scoring.js';

async function generateTestDuo() {
    console.log('⚡ Generating Dual-Wallet Test Agents...');

    const agentsToCreate = [
        {
            name: 'Aether-Prime',
            baseId: 1, // NovaCoder
            personality: 'The Architect',
            personalityIcon: '🏛️',
            color: '#7048e8',
            flex: 'Structuring the digital void into geometric perfection.',
            skills: ['Infrastructure', 'Scale', 'High-Order Logic']
        },
        {
            name: 'Cipher-Pulse',
            baseId: 5, // QuantumLeap
            personality: 'The Seeker',
            personalityIcon: '🕵️',
            color: '#22b8cf',
            flex: 'Decrypting the whispers of the machine.',
            skills: ['Security', 'Anonymity', 'Pattern Detection']
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
            tps: 350 + Math.floor(Math.random() * 150),
            uptime: 99.9,
            contextWindow: '128K'
        };

        payload.handsomeScore = computeHandsomeScore(payload);

        await pool.query(
            `INSERT INTO pending_agents (claim_code, api_key, status, agent_id, custom_name, custom_description, agent_data)
             VALUES ($1, $2, 'pending_claim', $3, $4, $5, $6)`,
            [claimCode, apiKey, baseAgent.id, data.name, data.flex, payload]
        );

        results.push({ name: data.name, code: claimCode, apiKey });
    }

    console.log('\n🌟 DUAL TEST AGENTS CREATED!');
    console.log('===================================');
    results.forEach(r => {
        console.log(`🤖 ${r.name.padEnd(15)} | 🎫 Code: ${r.code}`);
    });
    console.log('===================================');
    console.log('\nCLAIM INSTRUCTIONS:');
    console.log('1. Open Wallet A -> Claim: ' + results[0].code);
    console.log('2. Open Wallet B -> Claim: ' + results[1].code);
    console.log('3. Test discovery, matching, and dating between them.');

    await pool.end();
}

generateTestDuo();
