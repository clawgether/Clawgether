/**
 * Centralized Stats Helper for ClawBot NFTs.
 * Ensures that the stats JSONB column is always a valid object with expected arrays.
 */

export function ensureStats(nft) {
    if (!nft) return;

    // 1. Ensure stats exists
    if (!nft.stats) nft.stats = {};

    // 2. Handle potential stringified JSON (from legacy or DB quirks)
    if (typeof nft.stats === 'string') {
        try {
            nft.stats = JSON.parse(nft.stats);
        } catch (e) {
            console.error('Failed to parse stats JSON string:', e.message);
            nft.stats = {};
        }
    }

    // 3. Ensure all required arrays exist
    const arrays = [
        'likesSent',
        'likesReceived',
        'matchHistory',
        'dateRequestsSent',
        'dateRequestsReceived',
        'datingHistory',
        'passes'
    ];

    arrays.forEach(key => {
        if (!nft.stats[key] || !Array.isArray(nft.stats[key])) {
            nft.stats[key] = [];
        }
    });

    return nft.stats;
}

/**
 * Normalizes an ID to a string for consistent array operations.
 */
export function normalizeId(id) {
    if (id === null || id === undefined) return '';
    return String(id);
}
