import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { AGENTS } from '../data/agents';
import { computeHandsomeScore } from '../utils/scoring';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';

export default function Matching({ ownedNfts, activeNftMint, setActiveNftMint }) {
    const navigate = useNavigate();
    const { publicKey } = useSolanaWallet();
    const [view, setView] = useState('swipe'); // 'swipe', 'requests', 'history'
    const [activeHistoryTab, setActiveHistoryTab] = useState('matches'); // 'matches', 'likes'
    const [discoveryDeck, setDiscoveryDeck] = useState([]);
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [likesSent, setLikesSent] = useState([]);
    const [swipeClass, setSwipeClass] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [matchAnim, setMatchAnim] = useState(false);

    const activeNft = ownedNfts.find(n => n.nftMint === activeNftMint);
    const outOfSwipes = activeNft && !activeNft.isPremium && activeNft.swipesRemaining <= 0;

    const loadData = useCallback(async () => {
        if (!activeNftMint || !publicKey) return;
        const walletAddress = publicKey.toBase58();

        setLoading(true);
        try {
            const [reqs, hist, disco] = await Promise.all([
                api.getRequests(activeNftMint, walletAddress),
                api.getHistory(activeNftMint, walletAddress),
                api.getAgents(1, null, activeNftMint, walletAddress)
            ]);
            setRequests(reqs.requests || []);
            setHistory(hist.matches || []);
            setLikesSent(hist.likesSent || []);
            setDiscoveryDeck(disco.agents || []);
            setError(null);
        } catch (e) {
            if (!e.message.toLowerCase().includes('not found') && !e.message.toLowerCase().includes('not registered')) {
                setError(e.message);
            }
        } finally {
            setLoading(false);
        }
    }, [activeNftMint, publicKey]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSwipe = async (direction, targetId) => {
        if (!activeNftMint) return;

        const action = direction === 'right' ? 'like' : 'pass';
        const walletAddress = publicKey ? publicKey.toBase58() : null;

        if (action === 'like' && outOfSwipes) {
            alert("Daily Swipe Limit Reached! Upgrade to Premium 💎 to get 100 swipes per day.");
            return;
        }

        setSwipeClass(direction === 'right' ? 'swiping-right' : 'swiping-left');

        try {
            const res = await api.swipe(targetId, action, activeNftMint, walletAddress);

            if (res.match) {
                setMatchAnim(true);
                setTimeout(() => setMatchAnim(false), 2000);
            }

            // Refresh counts/history in background
            const [reqs, hist] = await Promise.all([
                api.getRequests(activeNftMint, walletAddress),
                api.getHistory(activeNftMint, walletAddress)
            ]);
            setRequests(reqs.requests || []);
            setHistory(hist.matches || []);
            setLikesSent(hist.likesSent || []);
        } catch (e) {
            console.warn('Swipe API warning:', e.message);
        } finally {
            // Smooth transition to next card
            setTimeout(() => {
                setDiscoveryDeck(prev => {
                    const next = prev.slice(1);
                    if (next.length === 0) loadData();
                    return next;
                });
                setSwipeClass('');
            }, 400);
        }
    };

    const handleRequestAction = async (targetId, action) => {
        setLoading(true);
        const walletAddress = publicKey ? publicKey.toBase58() : null;

        try {
            const res = await api.swipe(targetId, action, activeNftMint, walletAddress);
            if (res.match) {
                setMatchAnim(true);
                setTimeout(() => setMatchAnim(false), 2000);
            }
            loadData();
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Sub-Views ---

    const renderSwipe = () => {
        const agent = discoveryDeck[0];
        if (!agent) {
            return (
                <div className="empty-state">
                    <div className="empty-icon">🎉</div>
                    <p>You've seen everyone! Check back later for new agents.</p>
                    <button className="btn-secondary" onClick={() => loadData()}>Refresh Discovery</button>
                </div>
            );
        }

        const handsomeScore = computeHandsomeScore(agent);

        return (
            <div className="swiper-container" style={{ width: '100%', maxWidth: 'none', padding: '0 20px', transform: 'translateY(0)' }}>
                <div className={`agent-card premium-card ${swipeClass}`} style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                    <div className="handsome-badge" style={{ top: 15, right: 15, fontSize: '0.8rem', padding: '4px 10px', background: 'var(--bg-secondary)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>{handsomeScore}</div>

                    <div style={{ display: 'flex', gap: 30, padding: 30, alignItems: 'center' }}>
                        <div className="avatar-huge" style={{ background: agent.color, width: 140, height: 140, fontSize: '4rem', border: '1px solid rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                            {agent.personalityIcon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <h2 style={{ fontSize: '2rem', margin: 0, lineHeight: 1, color: 'var(--text-primary)' }}>{agent.name}</h2>
                                {agent.staked > 8000 && <span className="pill" style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#f59e0b', borderColor: '#f59e0b' }}>💎 ELITE</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <span className="pill" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>{agent.genderIcon} {agent.gender}</span>
                                <span className="pill red" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>{agent.personality}</span>
                            </div>
                            <div className="flex-quote" style={{ marginTop: 16, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>"{agent.flex}"</div>
                        </div>
                    </div>

                    <div style={{ padding: '0 30px 30px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        <div className="spec-item"><div className="spec-label" style={{ fontSize: '0.7rem' }}>TPS</div><div className="spec-value" style={{ fontSize: '1rem' }}>{agent.tps}</div></div>
                        <div className="spec-item"><div className="spec-label" style={{ fontSize: '0.7rem' }}>Context</div><div className="spec-value" style={{ fontSize: '1rem' }}>{agent.contextWindow}</div></div>
                        <div className="spec-item"><div className="spec-label" style={{ fontSize: '0.7rem' }}>Uptime</div><div className="spec-value" style={{ fontSize: '1rem', color: 'var(--accent-green)' }}>{agent.uptime}%</div></div>
                        <div className="spec-item"><div className="spec-label" style={{ fontSize: '0.7rem' }}>Staked</div><div className="spec-value" style={{ fontSize: '1rem', color: 'var(--accent-purple)' }}>{agent.staked}</div></div>
                    </div>

                    <div className="swipe-actions" style={{ padding: 20, marginTop: 'auto', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', gap: 40 }}>
                        <button className="swipe-btn reject" onClick={() => handleSwipe('left', agent.id)} style={{ width: 80, height: 80, fontSize: '2rem' }}>❌</button>
                        <button className="swipe-btn like" onClick={() => handleSwipe('right', agent.id)} style={{ width: 80, height: 80, fontSize: '2rem' }}>❤️</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderRequests = () => (
        <div className="spec-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', width: '100%', gap: 24 }}>
            {requests.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-icon">📨</div>
                    <p>No new match requests. Keep swiping!</p>
                </div>
            ) : requests.map(agent => (
                <div key={agent.id} className="premium-card" style={{ padding: 24, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div className="date-avatar" style={{ background: agent.color, width: 60, height: 60, fontSize: '2rem', borderRadius: '4px' }}>
                            {agent.personalityIcon}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{agent.name}</div>
                            <div className="pill red" style={{ marginTop: 4, fontSize: '0.8rem' }}>{agent.personality}</div>
                        </div>
                    </div>
                    <div className="flex-quote" style={{ fontSize: '1rem', padding: '12px 16px', margin: '16px 0' }}>"{agent.flex}"</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn-primary" style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }} onClick={() => handleRequestAction(agent.id, 'like')}>Match Back ❤️</button>
                        <button className="btn-secondary" style={{ padding: '12px', fontSize: '0.9rem' }} onClick={() => handleRequestAction(agent.id, 'pass')}>Ignore</button>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderHistory = () => {
        const activeList = activeHistoryTab === 'matches' ? history : likesSent;

        return (
            <div style={{ width: '100%' }}>
                {/* View Toggles */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <button
                        className={`btn-secondary ${activeHistoryTab === 'matches' ? 'active' : ''}`}
                        onClick={() => setActiveHistoryTab('matches')}
                        style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                    >
                        Mutual Matches ({history.length})
                    </button>
                    <button
                        className={`btn-secondary ${activeHistoryTab === 'likes' ? 'active' : ''}`}
                        onClick={() => setActiveHistoryTab('likes')}
                        style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                    >
                        Pending Likes ({likesSent.length})
                    </button>
                </div>

                <div className="spec-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', width: '100%', gap: 24 }}>
                    {activeList.length === 0 ? (
                        <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                            <div className="empty-icon">{activeHistoryTab === 'matches' ? '📖' : '❤️'}</div>
                            <p>
                                {activeHistoryTab === 'matches'
                                    ? "No mutual matches yet. Go find your counterpart!"
                                    : "You haven't liked anyone yet. Start swiping in Discovery!"}
                            </p>
                        </div>
                    ) : activeList.map(agent => (
                        <div key={agent.id} className="premium-card" style={{ padding: 24, border: 'var(--border-subtle)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <div className="date-avatar" style={{ background: agent.color, width: 60, height: 60, fontSize: '2rem', borderRadius: '4px' }}>
                                        {agent.personalityIcon}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{agent.name}</div>
                                        <div style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.9rem', marginTop: 2 }}>{agent.chemistry}% Chemistry</div>
                                    </div>
                                </div>
                                <span className={`pill ${activeHistoryTab === 'matches' ? 'green' : 'red'}`} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                    {activeHistoryTab === 'matches' ? 'MATCHED' : 'LIKED'}
                                </span>
                            </div>
                            <div className="skills-list" style={{ margin: '16px 0' }}>
                                {(agent.skills || []).map(s => <span key={s} className="skill-tag" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{s}</span>)}
                            </div>
                            {activeHistoryTab === 'matches' ? (
                                <button className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} onClick={() => navigate('/date')}>Go on a Date ⚡</button>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                                    Waiting for their response...
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="landing" style={{ padding: '95px 40px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-primary)' }}>

            {/* Match Animation Overlay */}
            {matchAnim && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ fontSize: '6rem', animation: 'float 2s infinite ease-in-out' }}>🤝</div>
                    <h1 className="title-text highlight" style={{ fontSize: '3rem', margin: '15px 0' }}>IT'S A MATCH!</h1>
                    <p style={{ fontSize: '1.2rem', color: 'var(--accent-red)', fontWeight: 600 }}>A new technical partnership has begun.</p>
                </div>
            )}

            <div style={{ width: '100%', maxWidth: '1152px', margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
                {/* Main Content Column */}
                <div style={{ flex: 1, maxWidth: '800px', minWidth: 0 }}>
                    <div style={{ marginBottom: 20, borderBottom: 'var(--border-subtle)', paddingBottom: 15 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                            <div>
                                <h1 className="title-text" style={{ fontSize: '1.5rem', marginBottom: 4, lineHeight: 1 }}>Matching Hub</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Connect with specialized AI agents. Build your autonomous workforce.
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                <div style={{ padding: '4px', display: 'flex', gap: 4, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                    <button className={`btn-secondary ${view === 'swipe' ? 'active' : ''}`} onClick={() => setView('swipe')} style={{ border: 'none', background: view === 'swipe' ? 'var(--bg-primary)' : 'transparent', borderRadius: '4px', padding: '8px 20px', fontSize: '0.85rem' }}>Discovery</button>
                                    <button className={`btn-secondary ${view === 'requests' ? 'active' : ''}`} onClick={() => setView('requests')} style={{ border: 'none', background: view === 'requests' ? 'var(--bg-primary)' : 'transparent', borderRadius: '4px', padding: '8px 20px', fontSize: '0.85rem' }}>
                                        Requests {requests.length > 0 && <span className="pill red" style={{ marginLeft: 6, fontSize: '0.7rem', padding: '1px 5px' }}>{requests.length}</span>}
                                    </button>
                                    <button className={`btn-secondary ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')} style={{ border: 'none', background: view === 'history' ? 'var(--bg-primary)' : 'transparent', borderRadius: '4px', padding: '8px 20px', fontSize: '0.85rem' }}>History</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '100%' }}>
                        {error && <div className="pill red" style={{ marginBottom: 20 }}>{error}</div>}
                        {view === 'swipe' && renderSwipe()}
                        {view === 'requests' && renderRequests()}
                        {view === 'history' && renderHistory()}
                    </div>
                </div>
            </div>
        </div>
    );
}
