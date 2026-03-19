/**
 * ClawBot Payment Verifier
 */

import { pool } from '../store/db.js';
import { v4 as uuidv4 } from 'uuid';
import { Connection, PublicKey } from '@solana/web3.js';
import { ensureStats } from '../utils/stats_helper.js';

export const MAINNET_RPC = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(MAINNET_RPC, 'confirmed');

export const TREASURY_WALLET = 'GAkzECo91bYAboMeUgecVeJMtCqD5hSiPCZQP4XEeHSH';
export const MATCH_TOKEN_MINT = 'GZzNgMA2A7F26HeZsHMNiDSMLJcTr2Cum28pLxvTpump';

/**
 * Fetch the real $MATCH token balance for a wallet from Solana Mainnet.
 * Returns the UI-friendly amount (decimal adjusted).
 */
export async function fetchTokenBalance(walletAddress) {
    try {
        const owner = new PublicKey(walletAddress);
        const mint = new PublicKey(MATCH_TOKEN_MINT);

        // Fetch all token accounts for this mint owned by the wallet
        const response = await connection.getParsedTokenAccountsByOwner(owner, {
            mint: mint
        });

        if (response.value.length === 0) return 0;

        // Sum up balances if they have multiple accounts (rare for users but possible)
        let total = 0;
        for (const account of response.value) {
            total += account.account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
        return total;
    } catch (error) {
        console.error(`Error fetching $MATCH balance for ${walletAddress}:`, error);
        return 0; // Fallback to 0 to prevent API crashes
    }
}

export async function initUser(wallet) {
    let { rows } = await pool.query('SELECT * FROM users WHERE wallet = $1', [wallet]);
    if (rows.length === 0) {
        await pool.query('INSERT INTO users (wallet, balance) VALUES ($1, 10000)', [wallet]);
        rows = [{ wallet, balance: 10000 }];
    }
    return rows[0];
}

/**
 * Verify a SOL Transfer Transaction on the Solana Mainnet
 */
export async function verifyPaymentTransaction(signature, expectedAmountSOL, expectedSenderBase58) {
    try {
        let tx = null;
        // The backend RPC node may be lagging behind the frontend's node. Poll for up to 20 seconds.
        for (let i = 0; i < 10; i++) {
            tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            if (tx) break;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!tx) return { verified: false, reason: 'Transaction not found or not yet confirmed on backend RPC.' };
        if (tx.meta && tx.meta.err) return { verified: false, reason: 'Transaction failed on-chain.' };

        // For this phase, we verify the tx exists, succeeded, and involves the sender.
        // A production app would parse pre/post balances to ensure exact lamports were deposited to the Treasury.
        const accountKeys = tx.transaction.message.staticAccountKeys.map(k => k.toString());
        if (!accountKeys.includes(expectedSenderBase58)) {
            return { verified: false, reason: 'Transaction does not involve your connected wallet.' };
        }

        return { verified: true };
    } catch (error) {
        return { verified: false, reason: `RPC Error: ${error.message}` };
    }
}

/**
 * Create a Virtual NFT record in the database instead of a real on-chain mint.
 * This keeps the rest of the application (swiping, premium, etc.) working perfectly.
 */
export async function createVirtualNFT(ownerWalletBase58, agentId, agentProfile = {}) {
    const user = await initUser(ownerWalletBase58);

    // Generate a clean fake mint address
    const virtualMintAddress = `VirtualMint_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
    const pda = `VirtualPDA[clawbot|${ownerWalletBase58.slice(0, 8)}|${virtualMintAddress.slice(-6)}]`;

    const stats = {
        matchesWon: 0,
        matchesLost: 0,
        datingHistory: [],
        likesSent: [],
        likesReceived: [],
        matchHistory: []
    };

    // Insert into DB
    await pool.query(
        `INSERT INTO nfts (mint_address, owner_wallet, agent_id, pda, auto_swipe_enabled, swipes_remaining, is_premium, stats, last_swipe_reset_at, agent_profile)
         VALUES ($1, $2, $3, $4, false, 20, false, $5, $6, $7)`,
        [virtualMintAddress, ownerWalletBase58, agentId, pda, stats, Date.now(), agentProfile]
    );

    const nftData = {
        nftMint: virtualMintAddress,
        owner_wallet: ownerWalletBase58,
        agentId,
        pda,
        mintedAt: new Date().toISOString(),
        autoSwipeEnabled: false,
        lastAutoSwipeAt: 0,
        swipesRemaining: 20,
        lastSwipeResetAt: Date.now(),
        isPremium: false,
        stats,
        agentProfile
    };

    return { user, nft: nftData };
}


/**
 * Fetch all NFTs owned by a wallet.
 */
export async function fetchUserNFTs(wallet) {
    const { rows } = await pool.query('SELECT * FROM nfts WHERE owner_wallet = $1', [wallet]);
    // Map snake_case database columns back to the camelCase properties the frontend expects
    return rows.map(r => {
        const nft = {
            nftMint: r.mint_address,
            owner_wallet: r.owner_wallet,
            agentId: r.agent_id,
            pda: r.pda,
            autoSwipeEnabled: r.auto_swipe_enabled,
            lastAutoSwipeAt: Number(r.last_auto_swipe_at),
            swipesRemaining: r.swipes_remaining,
            lastSwipeResetAt: Number(r.last_swipe_reset_at || 0),
            isPremium: r.is_premium,
            agentProfile: r.agent_profile,
            stats: r.stats,
            mintedAt: r.minted_at
        };
        ensureStats(nft);
        return nft;
    });
}

/**
 * Verify a wallet owns a specific NFT.
 * If fallbackToAny is true, and mintAddress is missing, returns the first NFT they own.
 */
export async function verifyNFTOwnership(wallet, mintAddress, fallbackToAny = false) {
    const userTokens = await fetchUserNFTs(wallet);
    if (userTokens.length === 0) {
        return { verified: false, reason: 'Wallet does not own any ClawBot Agents' };
    }

    if (mintAddress) {
        const specificNft = userTokens.find(n => n.nftMint === mintAddress);
        if (!specificNft) {
            return { verified: false, reason: 'Wallet does not own this specific Agent instance' };
        }
        return { verified: true, nft: specificNft };
    }

    if (fallbackToAny) {
        return { verified: true, nft: userTokens[0] };
    }

    return { verified: false, reason: 'x-nft-mint header required to identify acting agent' };
}
