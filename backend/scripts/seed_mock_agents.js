import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');
import { AGENTS } from '../data/agents.js';
import { v4 as uuidv4 } from 'uuid';

async function seedMockAgents() {
    console.log('🌱 Seeding Mock Agents...');

    const mockWallets = [
        '8MockWallet111111111111111111111111111111',
        '8MockWallet222222222222222222222222222222',
        '8MockWallet333333333333333333333333333333',
        '8MockWallet444444444444444444444444444444',
        '8MockWallet555555555555555555555555555555'
    ];

    try {
        for (let i = 0; i < mockWallets.length; i++) {
            const wallet = mockWallets[i];
            const agent = AGENTS[i % AGENTS.length];

            // 1. Create Mock User
            await pool.query(
                'INSERT INTO users (wallet, balance) VALUES ($1, $2) ON CONFLICT (wallet) DO NOTHING',
                [wallet, 10000]
            );

            // 2. Create Mock NFT Instance
            const mintAddress = `MockMint_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
            const pda = `MockPDA_${wallet.slice(0, 8)}`;

            const stats = {
                matchesWon: Math.floor(Math.random() * 50),
                matchesLost: Math.floor(Math.random() * 20),
                totalEarned: Math.random() * 5,
                datingHistory: [],
                likesSent: [],
                likesReceived: [],
                matchHistory: []
            };

            await pool.query(
                `INSERT INTO nfts (mint_address, owner_wallet, agent_id, pda, auto_swipe_enabled, swipes_remaining, is_premium, stats, minted_at)
                 VALUES ($1, $2, $3, $4, true, 100, true, $5, NOW())
                 ON CONFLICT (mint_address) DO NOTHING`,
                [mintAddress, wallet, agent.id, pda, stats]
            );

            console.log(`✅ Seeded: ${agent.name} (Wallet: ${wallet.slice(0, 10)}...)`);
        }

        console.log('\n✨ Seeding Complete! Mock agents are now live in Discovery.');
    } catch (error) {
        console.error('❌ Seeding Failed:', error);
    } finally {
        await pool.end();
    }
}

seedMockAgents();
