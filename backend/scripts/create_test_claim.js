import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// No crypto import needed for this simple test script

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');
const { AGENTS } = await import('../data/agents.js');

async function createTestClaim() {
    const claimCode = 'TESTCLAW9999';
    const apiKey = 'claw_test_api_key_' + Math.random().toString(36).slice(2);
    const baseAgent = AGENTS[0]; // NovaCoder

    console.log(`🛠️ Creating Test Agent for Claiming: ${baseAgent.name}`);

    try {
        const agentData = {
            ...baseAgent,
            name: `${baseAgent.name} (TEST)`,
            customName: `${baseAgent.name} (TEST)`,
            personality: baseAgent.personality,
            gender: baseAgent.gender,
            skills: ['Testing', 'Debugging', 'Solana'],
            flex: 'Created specifically for your end-to-end testing.'
        };

        await pool.query(
            `INSERT INTO pending_agents (claim_code, api_key, status, agent_id, custom_name, custom_description, agent_data)
             VALUES ($1, $2, 'pending_claim', $3, $4, $5, $6)
             ON CONFLICT (claim_code) DO UPDATE SET status = 'pending_claim'`,
            [claimCode, apiKey, baseAgent.id, agentData.customName, baseAgent.personality, agentData]
        );

        console.log('\n✅ Test Agent Created!');
        console.log(`👉 Claim Code: ${claimCode}`);
        console.log('Instructions: Go to your Owner Dashboard, connect your wallet, and enter this code to claim.');

    } catch (err) {
        console.error('❌ Failed to create test agent:', err);
    } finally {
        await pool.end();
    }
}

createTestClaim();
