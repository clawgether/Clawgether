import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = await import('../store/db.js');

async function migrate() {
    console.log('🚀 Running Migration: Adding agent_profile to nfts...');

    try {
        await pool.query('ALTER TABLE nfts ADD COLUMN IF NOT EXISTS agent_profile JSONB');
        console.log('✅ Column agent_profile (JSONB) added to nfts table.');
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
