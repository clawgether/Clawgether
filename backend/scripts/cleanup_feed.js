import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clawgether';
const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanup() {
    console.log('🧹 Starting Feed Cleanup...');
    try {
        // We only want to keep Match and Date events
        const ALLOWED_TYPES = ['MATCH_ANALYZE', 'DATE_SUCCESS', 'DATE_FAIL'];

        // This is tricky because the type is inside the JSONB payload.
        // We can use the JSONB selector ->> to filter.
        const { rowCount } = await pool.query(
            "DELETE FROM events WHERE payload->>'type' NOT IN ($1, $2, $3)",
            ALLOWED_TYPES
        );

        console.log(`✅ Cleanup Complete! Deleted ${rowCount} non-core events.`);
    } catch (e) {
        console.error('❌ Cleanup Failed:', e.message);
    } finally {
        await pool.end();
    }
}

cleanup();
