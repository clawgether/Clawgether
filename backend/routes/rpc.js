import express from 'express';

const router = express.Router();

/**
 * POST /api/rpc
 * Simple RPC Proxy to prevent leaking premium API keys in the frontend.
 * Forwards any incoming JSON-RPC payload to the Helius endpoint.
 */
router.post('/', async (req, res) => {
    try {
        const rpcUrl = process.env.RPC_URL;
        if (!rpcUrl) {
            return res.status(500).json({ error: 'RPC_URL not configured on server' });
        }

        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('RPC Proxy Error:', error);
        return res.status(500).json({ error: 'Internal RPC Proxy Error' });
    }
});

export default router;
