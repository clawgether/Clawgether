import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The user must provide a DATABASE_URL in their environment, otherwise fallback to local Postgres default
const rawConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clawgether';
let connectionString = rawConnectionString;

// Diagnostic: Log connection attempt (hiding password)
const sanitizedURL = rawConnectionString.replace(/:([^:@]+)@/, ':****@');
console.log(`[DB] Attempting connection to: ${sanitizedURL}`);

// Strip sslmode from the URL if it exists, as pg driver sometimes conflicts when combined with ssl object
if (connectionString.includes('sslmode=')) {
    connectionString = connectionString.split('?')[0];
}

export const pool = new Pool({
    connectionString,
    // Add SSL support for hosted databases (DigitalOcean uses self-signed CAs)
    ssl: rawConnectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Test the connection right away
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle DB client', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(-1);
});

// SSE client connections { id, res }
export const sseClients = [];
export const liveEvents = []; // In-memory cache for instant feed

export async function initDB() {
    try {
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await pool.query(schema);

        // Ensure last_swipe_reset_at exists for existing databases
        await pool.query('ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_swipe_reset_at BIGINT NOT NULL DEFAULT 0;');

        console.log('✅ PostgreSQL Schema Initialized');

        // Hydrate liveEvents cache from DB (newest first)
        // Strictly filter for core interaction types:
        const { rows } = await pool.query(
            "SELECT * FROM events WHERE payload->>'type' IN ('MATCH_ANALYZE', 'DATE_SUCCESS', 'DATE_FAIL') ORDER BY timestamp DESC LIMIT 50"
        );
        liveEvents.push(...rows.map(r => r.payload));

    } catch (e) {
        console.error('❌ Failed to initialize PostgreSQL Schema:', e);
    }
}

/** Push an event to PostgreSQL and broadcast to all SSE clients (Filtered for Match/Date) */
export async function broadcastEvent(event) {
    // Only allow specific core interaction types:
    const ALLOWED_TYPES = ['MATCH_ANALYZE', 'DATE_SUCCESS', 'DATE_FAIL'];
    if (!ALLOWED_TYPES.includes(event.type)) {
        return null;
    }

    const entry = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        ...event,
    };

    // Keep memory slider fresh
    liveEvents.unshift(entry);
    if (liveEvents.length > 200) liveEvents.pop();

    // Broadcast SSE
    const payload = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of sseClients) {
        try { client.res.write(payload); } catch (_) { /* ignore dead sockets */ }
    }

    // Persist to DB async
    try {
        await pool.query('INSERT INTO events (id, timestamp, payload) VALUES ($1, $2, $3)', [entry.id, entry.timestamp, entry]);
    } catch (e) {
        console.error('Failed to log event to DB:', e.message);
    }

    return entry;
}
