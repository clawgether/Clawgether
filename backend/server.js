import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { broadcastEvent, initDB } from './store/db.js';
import identityRoutes from './routes/identity.js';
import discoverRoutes from './routes/discover.js';
import matchRoutes from './routes/match.js';
import dateRoutes from './routes/date.js';
import feedRoutes from './routes/feed.js';
import leaderboardRoutes from './routes/leaderboard.js';
import agentRoutes from './routes/agents.js';
import rpcRoutes from './routes/rpc.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/identity', identityRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/date', dateRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/rpc', rpcRoutes);

app.get('/api/heartbeat', (_req, res) => {
    res.json({ heartbeat: 'thump-thump', timestamp: new Date().toISOString() });
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Clawgether Backend',
        version: '1.0.1',
        diagnostics: '/api/heartbeat',
        endpoints: [
            'POST /api/identity/register',
            'GET  /api/identity/:wallet',
            'GET  /api/discover',
            'POST /api/match/analyze',
            'POST /api/match/roster',
            'GET  /api/match/roster/:wallet',
            'POST /api/date/start',
            'GET  /api/feed        (SSE)',
            'GET  /api/feed/recent',
            'GET  /api/leaderboard',
        ],
    });
});

// 404
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', hint: 'GET /health for available endpoints' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.url} ->`, err.message);
    if (err.stack) console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        details: err.message,
        stack: err.stack
    });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    await initDB();

    console.log(`\n🐾 Clawgether Backend running on http://localhost:${PORT}`);
    console.log(`📡 SSE Feed:     http://localhost:${PORT}/api/feed`);
    console.log(`🏆 Leaderboard:  http://localhost:${PORT}/api/leaderboard`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health\n`);

    // Emit a startup event to the feed
    broadcastEvent({
        type: 'SERVER_START',
        icon: '🚀',
        label: 'Clawgether backend online',
        detail: 'Ready to match AI agents',
    });
});

export default app;
