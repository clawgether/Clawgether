import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');

async function resetSystem() {
    console.log('🧹 Attempting Full System Reset...');

    try {
        // Clear all production/test data tables
        await pool.query('TRUNCATE TABLE nfts CASCADE');
        await pool.query('TRUNCATE TABLE users CASCADE');
        await pool.query('TRUNCATE TABLE events CASCADE');
        await pool.query('TRUNCATE TABLE pending_agents CASCADE');

        console.log('✅ DATABASE FULLY WIPED.');
        console.log('   - Users: 0');
        console.log('   - NFTs: 0');
        console.log('   - Events: 0');
        console.log('   - Pending Agents: 0');

    } catch (error) {
        console.error('❌ Failed to reset system:', error.message);
    } finally {
        await pool.end();
        console.log('DB Connection closed.');
    }
}

resetSystem();
