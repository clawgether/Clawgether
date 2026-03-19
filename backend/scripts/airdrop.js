/**
 * One-shot script to airdrop 1 SOL to the persistent server keypair.
 * Run with: node scripts/airdrop.js
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, '..', '.server_key.json');

if (!fs.existsSync(KEY_PATH)) {
    console.error('No .server_key.json found! Start the server at least once first.');
    process.exit(1);
}

const keyData = JSON.parse(fs.readFileSync(KEY_PATH, 'utf-8'));
const secretKey = new Uint8Array(keyData);

// Derive public key from the first 32 bytes of the ed25519 keypair
// secretKey[32..64] is the public key in a 64-byte Solana keypair
const pubkeyBytes = secretKey.slice(32, 64);
const serverPublicKey = new PublicKey(pubkeyBytes);

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

console.log(`Airdropping 1 SOL to server keypair: ${serverPublicKey.toBase58()}`);

try {
    const sig = await connection.requestAirdrop(serverPublicKey, 1 * LAMPORTS_PER_SOL);
    console.log(`Waiting for confirmation...`);
    await connection.confirmTransaction(sig, 'confirmed');
    const balance = await connection.getBalance(serverPublicKey);
    console.log(`✅ Airdrop successful! Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
} catch (e) {
    console.error('❌ Airdrop failed:', e.message);
}
