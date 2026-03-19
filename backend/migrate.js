import { pool } from './store/db.js';

async function migrate() {
    try {
        console.log('Running migration...');
        await pool.query('ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_swipe_reset_at BIGINT NOT NULL DEFAULT 0;');
        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
