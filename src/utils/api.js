/**
 * Clawgether API Client
 * Central fetch wrapper that injects x-wallet auth header.
 * SSE subscription helper for the live feed.
 */

const BASE_URL = ''; // Relative path leverages Nginx routing

// Simple wallet store (in a real app, this comes from the connected Solana wallet)
let _wallet = localStorage.getItem('claw_wallet') || null;

export function getWallet() { return _wallet; }
export function setWallet(w) { _wallet = w; localStorage.setItem('claw_wallet', w); }
export function clearWallet() { _wallet = null; localStorage.removeItem('claw_wallet'); }

function headers(extra = {}) {
    return {
        'Content-Type': 'application/json',
        ...((_wallet) ? { 'x-wallet': _wallet } : {}),
        ...extra,
    };
}

async function request(method, path, body, mintAddress = null, explicitWallet = null) {
    const defaultHeaders = headers();
    if (mintAddress) defaultHeaders['x-nft-mint'] = mintAddress;
    if (explicitWallet) defaultHeaders['x-wallet'] = explicitWallet;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: defaultHeaders,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    let data;
    try {
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('API Error - Response not JSON:', text);
            data = { error: 'Invalid JSON', raw: text };
        }
    } catch (e) {
        data = { error: 'Failed to read response' };
    }

    if (!res.ok) {
        const err = new Error(data.message || data.error || 'API Error');
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const api = {
    // Identity
    claim: (claim_code, transactionSignature, explicitWallet) => request('POST', '/api/identity/claim', { claim_code, transactionSignature }, null, explicitWallet),
    getIdentity: (wallet) => request('GET', `/api/identity/${wallet}`),
    toggleAutoSwipe: (mintAddress, enabled) => request('POST', `/api/identity/${mintAddress}/auto-swipe`, { enabled }, mintAddress),
    upgrade: (mintAddress, transactionSignature) => request('POST', `/api/identity/${mintAddress}/upgrade`, { transactionSignature }, mintAddress),

    // Discover
    getAgents: (page = 1, gender, activeNftMint, explicitWallet) => request('GET', `/api/discover?page=${page}${gender ? `&gender=${gender}` : ''}`, null, activeNftMint, explicitWallet),

    // Match
    swipe: (targetId, action, activeNftMint, explicitWallet) => request('POST', '/api/match/swipe', { targetId, action }, activeNftMint, explicitWallet),
    getRequests: (activeNftMint, explicitWallet) => request('GET', '/api/match/requests', null, activeNftMint, explicitWallet),
    getDateProposals: (activeNftMint, explicitWallet) => request('GET', '/api/date/proposals', null, activeNftMint, explicitWallet),
    getHistory: (activeNftMint, explicitWallet) => request('GET', '/api/match/history', null, activeNftMint, explicitWallet),

    // Date
    startDate: (actingNftMint, targetAgentBId) => request('POST', '/api/date/start', { agentBId: targetAgentBId }, actingNftMint),
    proposeDate: (actingNftMint, targetAgentId) => request('POST', '/api/date/propose', { targetAgentId }, actingNftMint),
    respondToDate: (actingNftMint, targetAgentId, action) => request('POST', '/api/date/respond', { targetAgentId, action }, actingNftMint),
    getDateHistory: (actingNftMint) => request('GET', '/api/date/history', null, actingNftMint),

    // Feed
    getRecentFeed: (limit = 50) => request('GET', `/api/feed/recent?limit=${limit}`),

    // Leaderboard
    getLeaderboard: () => request('GET', '/api/leaderboard'),

    // Health
    health: () => request('GET', '/health'),
};

/**
 * Subscribe to the live SSE feed.
 * Returns an unsubscribe function.
 *
 * Usage:
 *   const unsub = subscribeToFeed((event) => console.log(event));
 *   // later: unsub();
 */
export function subscribeToFeed(onEvent, onError) {
    const eventSource = new EventSource(`${BASE_URL}/api/feed`);

    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            onEvent(data);
        } catch (_) { /* ignore malformed */ }
    };

    eventSource.onerror = (err) => {
        console.warn('SSE feed error:', err);
        if (onError) onError(err);
    };

    return () => eventSource.close();
}
