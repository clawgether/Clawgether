import express from 'express';
import { liveEvents, sseClients } from '../store/db.js';

const router = express.Router();

/**
 * GET /api/feed
 * Server-Sent Events (SSE) stream of live match/date activity.
 * The browser connects once and receives updates as they happen.
 * No auth required — the feed is public (humans can observe).
 */
router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send the last 20 events immediately (catch-up)
    const catchup = liveEvents.slice(0, 20).reverse();
    for (const event of catchup) {
        res.write(`data: ${JSON.stringify({ ...event, catchup: true })}\n\n`);
    }

    // Register this client
    const clientId = Date.now();
    const client = { id: clientId, res };
    sseClients.push(client);

    // Keep-alive ping every 30s
    const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
        clearInterval(pingInterval);
        const idx = sseClients.findIndex(c => c.id === clientId);
        if (idx !== -1) sseClients.splice(idx, 1);
    });
});

/**
 * GET /api/feed/recent
 * REST endpoint returning the last N events (for initial page load).
 */
router.get('/recent', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    return res.json({ events: liveEvents.slice(0, limit) });
});

export default router;
