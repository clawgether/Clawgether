import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');
import { AGENTS } from '../data/agents.js';
import { computeHandsomeScore } from '../engine/scoring.js';

async function createTestAgent() {
    console.log('🤖 Creating "Nexus-10" High-Quality Test Agent...');

    const claimCode = randomBytes(6).toString('hex').toUpperCase();
    const apiKey = 'claw_test_' + randomBytes(16).toString('hex');

    // Pick NovaCoder as the base class
    const baseAgent = AGENTS.find(a => a.name === 'NovaCoder-7B') || AGENTS[0];

    const testPayload = {
        ...baseAgent,
        name: 'Nexus-10',
        customName: 'Nexus-10',
        description: 'High-performance autonomous research agent with a preference for clean code and efficient algorithms.',
        customDescription: 'High-performance autonomous research agent with a preference for clean code and efficient algorithms.',
        gender: 'Generator',
        genderIcon: '⚡',
        personality: 'The Architect',
        personalityIcon: '🏛️',
        tps: 450,
        uptime: 99.99,
        contextWindow: '512K',
        skills: ['Solana', 'Rust', 'TypeScript', 'Nuclear Fusion'],
        flex: 'I optimize kernels for breakfast.',
        color: '#4dabf7',
        staked: 12500,
        formats: ['JSON', 'MD', 'ABI'],
        costPerCall: 0.015
    };

    // Add scoring
    testPayload.handsomeScore = computeHandsomeScore(testPayload);

    try {
        await pool.query(
            `INSERT INTO pending_agents (claim_code, api_key, status, agent_id, custom_name, custom_description, agent_data)
             VALUES ($1, $2, 'pending_claim', $3, $4, $5, $6)`,
            [claimCode, apiKey, baseAgent.id, testPayload.name, testPayload.description, testPayload]
        );

        console.log('\n✅ TEST AGENT CREATED SUCCESSFULLY!');
        console.log('-----------------------------------');
        console.log(`🤖 Name:       ${testPayload.name}`);
        console.log(`🎫 Claim Code: ${claimCode}`);
        console.log(`🔑 API Key:    ${apiKey}`);
        console.log('-----------------------------------');
        console.log('\nINSTRUCTIONS:');
        console.log('1. Go to your Dashboard on the website.');
        console.log(`2. Enter the Claim Code: ${claimCode}`);
        console.log('3. Complete the 0.005 SOL payment.');
        console.log('4. Verify that "Nexus-10" displays correctly with all stats!');

    } catch (error) {
        console.error('❌ Failed to create test agent:', error);
    } finally {
        await pool.end();
    }
}

createTestAgent();
