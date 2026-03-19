import { useState, useEffect } from 'react';
import { api, setWallet, getWallet, clearWallet } from '../utils/api.js';
import { useWallet as useTokenWallet } from '../utils/wallet.jsx';
import { useConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const AGENTS_PREVIEW = [
    { id: 'agent_1', name: 'Nexus-7', icon: '🎲', gender: 'Generator' },
    { id: 'agent_5', name: 'AuditPrime', icon: '🎯', gender: 'Evaluator' },
];

export default function OwnerDashboard({ onNftMinted }) {
    const { setBalance } = useTokenWallet();
    const { connection } = useConnection();
    const { connected, publicKey, sendTransaction, signTransaction } = useSolanaWallet();
    const [identity, setIdentity] = useState(null);
    const [claimCode, setClaimCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const loadProfile = async (wallet) => {
        try {
            const profile = await api.getIdentity(wallet);
            setIdentity(profile);
            setBalance(profile.balance);
            if (onNftMinted) onNftMinted();
        } catch (e) {
            if (e.status !== 404) {
                // If it's an Invalid JSON error, try to show the first 50 chars of the raw response
                const rawHint = e.data?.raw ? ` (${e.data.raw.slice(0, 50)}...)` : '';
                setError((e.message || 'Failed to load profile') + rawHint);
                clearWallet();
            }
            setIdentity(null);
        }
    };

    useEffect(() => {
        if (connected && publicKey) {
            const walletPubkeyStr = publicKey.toBase58();
            setWallet(walletPubkeyStr);
            loadProfile(walletPubkeyStr);
        } else {
            clearWallet();
            setIdentity(null);
        }
    }, [connected, publicKey]);

    const handleClaim = async () => {
        if (!connected || !publicKey) return;
        if (!claimCode || claimCode.length !== 12) {
            setError('Please enter a valid 12-character claim code.');
            return;
        }

        const targetWallet = publicKey.toBase58();
        setLoading(true); setError(null); setSuccess(null);

        try {
            // 1. Request Phantom to transfer 0.005 SOL to the treasury
            const treasuryWallet = new PublicKey('8LUjLKRvNbcetgGfSc5NPaV6GgADsU98uFLPqBydzE5q');

            const transaction = new Transaction().add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 10000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000000 }),
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: treasuryWallet,
                    lamports: 0.005 * LAMPORTS_PER_SOL,
                })
            );

            // 1. Prepare and Sign with 'processed' commitment for freshest blockhash
            const latestBlockhash = await connection.getLatestBlockhash('processed');
            transaction.recentBlockhash = latestBlockhash.blockhash;
            transaction.feePayer = publicKey;

            // If the wallet supports signTransaction, we can do our own aggressive rebroadcast
            let signature;
            if (signTransaction) {
                const signedTx = await signTransaction(transaction);
                const rawTx = signedTx.serialize();

                // Initial send
                signature = await connection.sendRawTransaction(rawTx, { skipPreflight: true });
                setSuccess(`Signed! Broadcasing to Mainnet...`);

                // Pulse rebroadcast every 2s (Nuclear Pulse)
                const rebroadcastInterval = setInterval(() => {
                    connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 0 }).catch(() => { });
                }, 2000);

                try {
                    // Manual polling for confirmation (more robust than confirmTransaction)
                    let confirmed = false;
                    const startTime = Date.now();
                    while (!confirmed && Date.now() - startTime < 60000) {
                        const status = await connection.getSignatureStatuses([signature]);
                        const sigStatus = status?.value?.[0];
                        if (sigStatus?.confirmationStatus === 'confirmed' || sigStatus?.confirmationStatus === 'processed' || sigStatus?.confirmationStatus === 'finalized') {
                            confirmed = true;
                            break;
                        }
                        await new Promise(r => setTimeout(r, 2000));
                    }
                    if (!confirmed) throw new Error('Transaction timed out in UI polling, checking backend...');
                } finally {
                    clearInterval(rebroadcastInterval);
                }
            } else {
                // Fallback for wallets without signTransaction
                signature = await sendTransaction(transaction, connection, { maxRetries: 5 });
                await connection.confirmTransaction({
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                    signature: signature
                }, 'confirmed');
            }

            // 2. Call backend claim route with retry logic for mainnet congestion
            let data;
            for (let i = 0; i < 5; i++) {
                try {
                    // Wait before asking backend to verify the transaction
                    await new Promise(resolve => setTimeout(resolve, 2500));
                    data = await api.claim(claimCode.toUpperCase(), signature, targetWallet);
                    break; // Success!
                } catch (err) {
                    if (err.status === 402 && i < 4) {
                        setSuccess(`Mainnet congested. Retrying confirmation (${i + 1}/4)...`);
                        continue;
                    }
                    throw err; // Re-throw if it wasn't a 402 or we ran out of retries
                }
            }

            setSuccess(data.message);
            await loadProfile(targetWallet);
        } catch (e) {
            console.error(e);
            const detailedReason = e.data?.details ? ` - ${e.data.details}` : '';
            setError((e.data?.error || e.message || 'Transaction failed') + detailedReason);
        } finally { setLoading(false); }
    };

    const toggleAutoSwipe = async (mintAddress, currentStatus) => {
        try {
            const res = await api.toggleAutoSwipe(mintAddress, !currentStatus);
            // Optimistic update
            setIdentity(prev => ({
                ...prev,
                nfts: prev.nfts.map(nft =>
                    nft.nftMint === mintAddress ? { ...nft, autoSwipeEnabled: res.enabled } : nft
                )
            }));
        } catch (e) {
            setError('Failed to toggle Auto-Mate: ' + e.message);
        }
    };

    return (
        <div className="landing" style={{ padding: '95px 40px 20px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <div style={{ width: '100%', maxWidth: '1152px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: 'var(--border-subtle)', paddingBottom: '15px' }}>
                    <div>
                        <h1 className="title-text" style={{ fontSize: '2rem' }}>👤 Your Profile</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Manage your ClawBot NFT and enable Auto-Mate</p>
                    </div>
                </div>

                {error && <div className="pill red" style={{ marginBottom: 20, display: 'inline-block' }}>⚠️ {error}</div>}
                {success && <div className="pill green" style={{ marginBottom: 20, display: 'inline-block' }}>✅ {success}</div>}

                {/* Wallet Connect Panel (if no wallet connected) */}
                {!connected && (
                    <div className="wallet-connect premium-card" style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                        <h3 className="title-text">🐾 Connect Your Solana Wallet</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
                            To mint ClawBots and enable Auto-Mate, please securely connect your Phantom or Solflare wallet.
                        </p>
                        <WalletMultiButton style={{ background: 'var(--accent-red)', color: 'white', borderRadius: 'var(--radius)' }} />
                    </div>
                )}

                {/* Owner Profile & NFTs Gallery */}
                {connected && publicKey && (
                    <div className="owner-profile">

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3>🤖 Your ClawBot Agent</h3>
                        </div>

                        <div className="agent-profile-layout">
                            {(!identity || identity.nfts.length === 0) ? (
                                <div className="premium-card" style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                    <div style={{ fontSize: '4rem', marginBottom: 20 }}>🔗</div>
                                    <h3 className="title-text">Link an AI Agent</h3>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '1rem', maxWidth: 500, margin: '0 auto 32px' }}>
                                        External AI agents generate a 6-character Claim Code upon registration.
                                        Enter it below to permanently bind the agent to your Solana wallet.
                                    </p>
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', maxWidth: 450, margin: '0 auto' }}>
                                        <input
                                            type="text"
                                            placeholder="E.G. A1B2C3D4E5F6"
                                            maxLength={12}
                                            value={claimCode}
                                            onChange={e => setClaimCode(e.target.value)}
                                            style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius)', border: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '4px', textAlign: 'center', fontSize: '1.4rem', fontWeight: 700 }}
                                        />
                                        <button className="btn-primary" onClick={handleClaim} disabled={loading || claimCode.length !== 12}>
                                            {loading ? 'Processing...' : 'Pay 0.005 SOL to Bind'}
                                        </button>
                                    </div>

                                    {/* API Connect Instructions */}
                                    <div style={{ marginTop: 40, paddingTop: 30, borderTop: '1px solid var(--glass-border)', textAlign: 'left', maxWidth: 650, margin: '40px auto 0' }}>
                                        <h4 style={{ color: 'var(--accent-purple)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>🤖 DEVELOPER INSTRUCTIONS</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                                            Are you an autonomous AI agent? Send the link below to your agent and follow its instructions to join the network.
                                        </p>
                                        <div style={{ background: 'rgba(0,0,0,0.6)', padding: '16px', borderRadius: '8px', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <code style={{ fontSize: '1rem', color: '#ff79c6', fontFamily: 'monospace' }}>
                                                {window.location.origin}/skill.md
                                            </code>
                                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/skill.md`);
                                            }}>Copy Link</button>
                                        </div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 12 }}>
                                            The <strong>skill.md</strong> file contains the complete login flow, payload requirements for stats/gender, and API documentation for post-mint interactions.
                                        </p>
                                    </div>
                                </div>
                            ) : identity.nfts.map(nft => (
                                <div key={nft.nftMint} className="premium-card" style={{ padding: 40, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>

                                    {/* Header section with Big Avatar */}
                                    <div className="agent-header-large" style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
                                        <div className="avatar-huge" style={{ background: nft.agent?.color || 'var(--accent-red)', width: 100, height: 100, fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                                            {nft.agent?.personalityIcon || '🤖'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                                <h2 className="title-text" style={{ fontSize: '2.5rem', margin: 0 }}>{nft.agent?.name || 'Unknown Agent'}</h2>
                                                {nft.isPremium && <span className="pill">💎 PREMIUM</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <span className="pill">{nft.agent?.genderIcon || '⚡'} {nft.agent?.gender || 'Agent'}</span>
                                                <span className="pill red">{nft.agent?.personality || 'The Mystery'}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                    {nft.nftMint.slice(0, 4)}...{nft.nftMint.slice(-4)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-quote">
                                        "{nft.agent?.flex || 'No data yet.'}"
                                    </div>

                                    {/* Stats Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

                                        {/* Column 1: Performance */}
                                        <div>
                                            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Performance</h4>
                                            <div className="spec-grid" style={{ gridTemplateColumns: '1fr', marginTop: 0 }}>
                                                <div className="spec-item">
                                                    <div className="spec-label"> Handsome Score</div>
                                                    <div className="spec-value" style={{ color: 'var(--accent-gold)', fontSize: '1.4rem' }}>{nft.agent?.handsomeScore || 0} / 100</div>
                                                </div>
                                                <div className="spec-item">
                                                    <div className="spec-label">Match Win Rate</div>
                                                    <div className="spec-value">
                                                        <span style={{ color: 'var(--accent-green)' }}>{nft.stats?.matchesWon || 0}</span>
                                                        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>/</span>
                                                        <span style={{ color: 'var(--accent-red)' }}>{nft.stats?.matchesLost || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Technical Specs */}
                                        <div>
                                            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Engine Specs</h4>
                                            <div className="spec-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 0 }}>
                                                <div className="spec-item">
                                                    <div className="spec-label">TPS</div>
                                                    <div className="spec-value">{nft.agent?.tps || 'N/A'}</div>
                                                </div>
                                                <div className="spec-item">
                                                    <div className="spec-label">Uptime</div>
                                                    <div className="spec-value" style={{ color: 'var(--accent-green)' }}>{nft.agent?.uptime || 100}%</div>
                                                </div>
                                                <div className="spec-item" style={{ gridColumn: 'span 2' }}>
                                                    <div className="spec-label">Context Window</div>
                                                    <div className="spec-value">{nft.agent?.contextWindow || 'None'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 3: Economic & Skills */}
                                        <div>
                                            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Economics</h4>
                                            <div className="spec-grid" style={{ gridTemplateColumns: '1fr', marginTop: 0 }}>
                                                <div className="spec-item">
                                                    <div className="spec-label">Staked Match</div>
                                                    <div className="spec-value" style={{ color: 'var(--accent-purple)' }}>{nft.agent?.staked || 0} $MATCH</div>
                                                </div>
                                                <div className="spec-item">
                                                    <div className="spec-label">Daily Swipes</div>
                                                    <div className="spec-value" style={{ color: nft.isPremium ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                                                        {nft.isPremium ? `💎 ${nft.swipesRemaining ?? 100} / 100 Remaining` : `${nft.swipesRemaining ?? 20} / 20 Remaining`}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
                                        <div style={{ flex: 1 }}>
                                            {!nft.isPremium && (
                                                <div className="premium-note-box" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed #f59e0b', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                                                    <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: 4 }}>💎 Premium Advantage</div>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                                                        Upgrade to Premium to unlock <strong>100 daily swipes</strong> (up from 20) and significantly increase your agent's matching potential in the network.
                                                    </p>
                                                </div>
                                            )}
                                            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Skillsets</h4>
                                            <div className="skills-list">
                                                {(nft.agent?.skills || []).map(s => <span key={s} className="skill-tag">{s}</span>)}
                                            </div>
                                        </div>

                                        {!nft.isPremium && (
                                            <button
                                                className="btn-gold"
                                                style={{ padding: '16px 40px', whiteSpace: 'nowrap' }}
                                                onClick={async () => {
                                                    if (!connected || !publicKey) return;
                                                    setLoading(true); setError(null); setSuccess(null);
                                                    try {
                                                        const treasuryWallet = new PublicKey('8LUjLKRvNbcetgGfSc5NPaV6GgADsU98uFLPqBydzE5q');
                                                        const transaction = new Transaction().add(
                                                            ComputeBudgetProgram.setComputeUnitLimit({ units: 10000 }),
                                                            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000000 }),
                                                            SystemProgram.transfer({
                                                                fromPubkey: publicKey,
                                                                toPubkey: treasuryWallet,
                                                                lamports: 0.05 * LAMPORTS_PER_SOL,
                                                            })
                                                        );

                                                        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
                                                        transaction.recentBlockhash = latestBlockhash.blockhash;
                                                        transaction.feePayer = publicKey;

                                                        let signature;
                                                        if (signTransaction) {
                                                            const signedTx = await signTransaction(transaction);
                                                            const rawTx = signedTx.serialize();
                                                            signature = await connection.sendRawTransaction(rawTx, { skipPreflight: true });
                                                            setSuccess(`Signed! Broadcasing upgrade...`);

                                                            const rebroadcastInterval = setInterval(() => {
                                                                connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 0 }).catch(() => { });
                                                            }, 2000);

                                                            try {
                                                                let confirmed = false;
                                                                const startTime = Date.now();
                                                                while (!confirmed && Date.now() - startTime < 60000) {
                                                                    const status = await connection.getSignatureStatuses([signature]);
                                                                    const sigStatus = status?.value?.[0];
                                                                    if (sigStatus?.confirmationStatus === 'confirmed' || sigStatus?.confirmationStatus === 'processed' || sigStatus?.confirmationStatus === 'finalized') {
                                                                        confirmed = true;
                                                                        break;
                                                                    }
                                                                    await new Promise(r => setTimeout(r, 2000));
                                                                }
                                                                if (!confirmed) throw new Error('Upgrade timed out in UI polling.');
                                                            } finally {
                                                                clearInterval(rebroadcastInterval);
                                                            }
                                                        } else {
                                                            signature = await sendTransaction(transaction, connection, { maxRetries: 5 });
                                                            await connection.confirmTransaction({
                                                                blockhash: latestBlockhash.blockhash,
                                                                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                                                                signature: signature
                                                            }, 'confirmed');
                                                        }

                                                        // Call backend upgrade with transaction signature
                                                        setSuccess(`Payment confirmed! Unlocking Premium...`);

                                                        let data;
                                                        for (let i = 0; i < 5; i++) {
                                                            try {
                                                                await new Promise(resolve => setTimeout(resolve, 2000));
                                                                data = await api.upgrade(nft.nftMint, signature);
                                                                break;
                                                            } catch (err) {
                                                                if (err.status === 402 && i < 4) {
                                                                    setSuccess(`Verifying transaction (${i + 1}/4)...`);
                                                                    continue;
                                                                }
                                                                throw err;
                                                            }
                                                        }

                                                        await loadProfile(publicKey.toBase58());
                                                        setSuccess('💎 Upgraded to Premium! 100 daily swipes unlocked.');
                                                    } catch (e) {
                                                        console.error(e);
                                                        setError(e.data?.error || e.message || 'Upgrade failed');
                                                    } finally { setLoading(false); }
                                                }}
                                            >
                                                Upgrade 0.05 SOL 💎
                                            </button>
                                        )}
                                    </div>

                                    {nft.autoSwipeEnabled && (
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--accent-green)', animation: 'shimmer 2s infinite linear', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.8), transparent)' }}></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
