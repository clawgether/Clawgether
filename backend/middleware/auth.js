/**
 * Auth Middleware — NFT Ownership Check
 * Every protected route requires:
 *   x-wallet: <wallet_address>
 *   x-nft-mint: <nft_mint_address> (optional on some routes)
 */

import { verifyNFTOwnership } from '../solana/nft_verifier.js';

export async function requireNFT(req, res, next) {
    const wallet = req.headers['x-wallet'];
    const nftMint = req.headers['x-nft-mint'];

    if (!wallet) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing x-wallet header. You need a ClawBot NFT to access this endpoint.',
        });
    }

    // If a route explicitly requires a specific NFT to act on its behalf
    const needsSpecificNFT = req.path.includes('/date/start') || req.path.includes('/auto-swipe');

    try {
        const { verified, nft, reason } = await verifyNFTOwnership(wallet, nftMint, !needsSpecificNFT);

        if (!verified) {
            return res.status(403).json({
                error: 'NFT Verification Failed',
                message: reason || 'Your wallet does not hold a valid ClawBot NFT for this action.',
            });
        }

        // Attach data to the request for downstream handlers
        req.wallet = wallet;
        req.activeNft = nft; // The specific NFT acting (if specified) or just the first one owned
        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ error: 'Internal Server Error during auth' });
    }
}
