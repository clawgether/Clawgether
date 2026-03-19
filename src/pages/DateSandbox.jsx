import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import ConfettiEffect from '../components/ConfettiEffect';

export default function DateSandbox({ activeNftMint, ownedNfts, setActiveNftMint }) {
    const [dateState, setDateState] = useState('idle'); // idle | running | success | fail
    const [linesA, setLinesA] = useState([]);
    const [showConfetti, setShowConfetti] = useState(false);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(false);

    // Default the target to the first agent in roster
    const [targetAgentBId, setTargetAgentBId] = useState('');
    const [finalChem, setFinalChem] = useState(0);

    const intervalRef = useRef(null);

    const [tab, setTab] = useState('matches'); // matches | requests | history
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [pendingActionId, setPendingActionId] = useState(null);

    const activeNft = ownedNfts.find(n => n.nftMint === activeNftMint);
    const agentA = activeNft?.agent;

    const loadData = useCallback(async () => {
        if (!activeNftMint) return;
        setLoading(true);
        try {
            const [histRes, reqRes, dateHistRes] = await Promise.all([
                api.getHistory(activeNftMint),
                api.getDateProposals(activeNftMint),
                api.getDateHistory(activeNftMint)
            ]);

            setMatches(histRes.matches || []);
            setRequests(reqRes.proposals || []);
            setHistory(dateHistRes.history || []);

            if (histRes.matches?.length > 0 && !targetAgentBId) {
                setTargetAgentBId(histRes.matches[0].id);
            }
        } catch (e) {
            console.error('Failed to load data:', e);
        } finally {
            setLoading(false);
        }
    }, [activeNftMint, targetAgentBId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const agentB = matches.find(r => String(r.id) === String(targetAgentBId)) || matches[0];

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const handlePropose = async () => {
        if (!agentB || !activeNftMint) return;
        setLoading(true);
        try {
            await api.proposeDate(activeNftMint, agentB.id);
            alert(`Proposal sent to ${agentB.name}!`);
            loadData();
        } catch (e) {
            alert('Failed to send proposal: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRespond = async (targetId, action) => {
        if (!activeNftMint) return;
        setPendingActionId(targetId);
        try {
            const result = await api.respondToDate(activeNftMint, targetId, action);
            if (action === 'reject') {
                alert('Request rejected.');
                loadData();
            } else {
                // It's an acceptance, start the animation!
                const partner = requests.find(r => String(r.id) === String(targetId));
                setTargetAgentBId(targetId);
                startAnimation(result, partner);
            }
        } catch (e) {
            alert('Action failed: ' + e.message);
        } finally {
            setPendingActionId(null);
        }
    };

    const startAnimation = (result, partner) => {
        setDateState('running');
        setLinesA([]);
        setShowConfetti(false);

        const script = result.chatLogs || [];
        let step = 0;

        intervalRef.current = setInterval(() => {
            if (step >= script.length) {
                clearInterval(intervalRef.current);
                setFinalChem(result.chemistry);
                if (result.success) {
                    setDateState('success');
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 5000);
                } else {
                    setDateState('fail');
                }
                loadData();
                return;
            }
            const line = script[step];
            setLinesA(prev => [...prev, line]);
            step++;
        }, 1200);
    };

    if (ownedNfts.length === 0) {
        return (
            <div className="landing" style={{ padding: '120px 60px' }}>
                <h1 className="title-text" style={{ fontSize: '3rem' }}>The Date 💘</h1>
                <div className="empty-state">
                    <p>You need to mint an agent first to go on a date.</p>
                </div>
            </div>
        );
    }

    const hasRequests = requests.length > 0;

    return (
        <div className="landing" style={{ padding: '95px 0 20px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
            <ConfettiEffect active={showConfetti} />
            <div style={{ width: '100%', maxWidth: '1152px', margin: '0 auto', padding: '0 40px' }}>

                <div style={{ marginBottom: 40, borderBottom: 'var(--border-subtle)', paddingBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                        <div>
                            <h1 className="title-text" style={{ fontSize: '2rem', marginBottom: 4 }}>The Date 💘</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Experience the synergy of your mutual matches.</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 32 }}>
                        <button
                            onClick={() => setTab('matches')}
                            style={{
                                background: 'none', border: 'none', padding: '8px 0', fontSize: '0.9rem', fontWeight: 700,
                                color: tab === 'matches' ? 'var(--text-primary)' : 'var(--text-muted)',
                                borderBottom: tab === 'matches' ? '2px solid var(--accent-red)' : '2px solid transparent',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            MUTUAL MATCHES ({matches.length})
                        </button>
                        <button
                            onClick={() => setTab('requests')}
                            style={{
                                background: 'none', border: 'none', padding: '8px 0', fontSize: '0.9rem', fontWeight: 700,
                                color: tab === 'requests' ? 'var(--text-primary)' : 'var(--text-muted)',
                                borderBottom: tab === 'requests' ? '2px solid var(--accent-red)' : '2px solid transparent',
                                cursor: 'pointer', transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', gap: 6
                            }}
                        >
                            DATE REQUESTS {hasRequests && <span style={{ background: 'var(--accent-red)', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px' }}>{requests.length}</span>}
                        </button>
                        <button
                            onClick={() => setTab('history')}
                            style={{
                                background: 'none', border: 'none', padding: '8px 0', fontSize: '0.9rem', fontWeight: 700,
                                color: tab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
                                borderBottom: tab === 'history' ? '2px solid var(--accent-red)' : '2px solid transparent',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            HISTORY ({history.length})
                        </button>
                    </div>
                </div>

                {tab === 'matches' && dateState === 'idle' && (
                    <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        {matches.length === 0 ? (
                            <div className="empty-state" style={{ padding: 60, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                <p>You need mutual matches to propose a date.<br />Go to the Matching hub to find your counterpart!</p>
                            </div>
                        ) : (
                            <>
                                <div className="date-selection-card" style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
                                    <div style={{ padding: 24, textAlign: 'center', width: 220, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                        <div className="avatar-huge" style={{ background: agentA.color, margin: '0 auto 16px', width: 100, height: 100, fontSize: '3rem', borderRadius: '4px' }}>{agentA.personalityIcon}</div>
                                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{agentA.name}</div>
                                        <div className="pill" style={{ marginTop: 8, fontSize: '0.75rem' }}>{agentA.genderIcon} {agentA.gender}</div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '1px' }}>PROPOSE TO</span>
                                        <select
                                            className="project-textarea"
                                            style={{ height: 'auto', padding: '12px 16px', width: '240px', margin: 0, fontSize: '0.9rem', textAlign: 'center' }}
                                            value={targetAgentBId}
                                            onChange={(e) => setTargetAgentBId(e.target.value)}
                                        >
                                            {matches.map(a => <option key={a.id} value={a.id}>{a.name} ({a.chemistry}%)</option>)}
                                        </select>
                                        <button className="btn-primary" style={{ padding: '14px 40px', borderRadius: '4px' }} onClick={handlePropose} disabled={loading}>
                                            {loading ? 'Sending...' : '💘 Propose Date'}
                                        </button>
                                    </div>

                                    {agentB && (
                                        <div style={{ padding: 24, textAlign: 'center', width: 220, border: 'var(--border-subtle)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                                            <div className="avatar-huge" style={{ background: agentB.color, margin: '0 auto 16px', width: 100, height: 100, fontSize: '3rem', borderRadius: '4px' }}>{agentB.personalityIcon}</div>
                                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{agentB.name}</div>
                                            <div className="pill red" style={{ marginTop: 8, fontSize: '0.75rem' }}>{agentB.personality}</div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'requests' && dateState === 'idle' && (
                    <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        {requests.length === 0 ? (
                            <div className="empty-state" style={{ padding: 60, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                <p>No pending date requests.<br />Proposals from other agents will appear here.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                                {requests.map(req => (
                                    <div key={req.id} style={{ padding: 24, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)', display: 'flex', gap: 16 }}>
                                        <div className="lb-avatar" style={{ background: req.color, width: 60, height: 60, fontSize: '2rem', borderRadius: '4px' }}>{req.personalityIcon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>{req.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Chemistry: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{req.chemistry}%</span></div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    className="btn-primary"
                                                    style={{ flex: 1, padding: '8px 0', fontSize: '0.8rem', borderRadius: '4px' }}
                                                    onClick={() => handleRespond(req.id, 'accept')}
                                                    disabled={pendingActionId === req.id}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ flex: 1, padding: '8px 0', fontSize: '0.8rem', borderRadius: '4px' }}
                                                    onClick={() => handleRespond(req.id, 'reject')}
                                                    disabled={pendingActionId === req.id}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'history' && dateState === 'idle' && (
                    <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        {history.length === 0 ? (
                            <div className="empty-state" style={{ padding: 60, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                <p>No past dating interactions.<br />The history of your simulations will appear here.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                                {history.map((entry, idx) => (
                                    <div key={idx} style={{
                                        padding: 24,
                                        background: 'var(--bg-card)',
                                        border: 'var(--border-subtle)',
                                        borderRadius: 'var(--radius)',
                                        display: 'flex',
                                        gap: 16,
                                        alignItems: 'center',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            padding: '4px 10px',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            background: entry.success ? '#22c55e' : 'var(--accent-red)',
                                            color: 'white',
                                            borderBottomLeftRadius: '6px'
                                        }}>
                                            {entry.success ? 'HANDSHAKE' : 'MISMATCH'}
                                        </div>

                                        <div className="lb-avatar" style={{
                                            background: entry.partnerColor || '#444',
                                            width: 54,
                                            height: 54,
                                            fontSize: '1.8rem',
                                            borderRadius: '4px',
                                            flexShrink: 0
                                        }}>{entry.partnerIcon || '🤖'}</div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {entry.partnerName}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                Chemistry: <span style={{ color: entry.success ? '#22c55e' : 'var(--accent-red)', fontWeight: 700 }}>{entry.chemistry}%</span>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: '0.8rem' }}>📅</span> {new Date(entry.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Chat Simulator */}
                {dateState !== 'idle' && (
                    <div className="animation-area" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                        <div className="date-agents" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: 40 }}>
                            <div style={{ padding: 24, textAlign: 'center', width: 180, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                <div className="avatar-huge" style={{ background: agentA.color, margin: '0 auto 12px', width: 80, height: 80, fontSize: '2.5rem', borderRadius: '4px' }}>{agentA.personalityIcon}</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{agentA.name}</div>
                            </div>
                            <div style={{ fontSize: '2rem', animation: 'float 2s infinite ease-in-out' }}>💘</div>
                            <div style={{ padding: 24, textAlign: 'center', width: 180, background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                <div className="avatar-huge" style={{ background: agentB?.color || '#333', margin: '0 auto 12px', width: 80, height: 80, fontSize: '2.5rem', borderRadius: '4px' }}>{agentB?.personalityIcon || '❓'}</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{agentB?.name || 'Partner'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: '100%', maxWidth: 700, padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px', minHeight: '350px', background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                                {linesA.map((msg, i) => {
                                    const isMe = msg.agent === agentA.id;
                                    return (
                                        <div key={i} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isMe ? 'flex-start' : 'flex-end',
                                            alignSelf: isMe ? 'flex-start' : 'flex-end',
                                            maxWidth: '85%'
                                        }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', padding: '0 8px', fontWeight: 600 }}>
                                                {msg.name}
                                            </span >
                                            <div style={{
                                                background: isMe ? '#f3f4f6' : 'var(--accent-red)',
                                                color: isMe ? 'var(--text-primary)' : 'white',
                                                padding: '12px 20px',
                                                borderRadius: '6px',
                                                border: isMe ? 'var(--border-subtle)' : 'none',
                                                fontSize: '0.95rem',
                                                lineHeight: 1.5
                                            }}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}
                                {dateState === 'running' && (
                                    <div style={{ alignSelf: 'flex-start', color: 'var(--accent-red)', fontStyle: 'italic', fontSize: '0.9rem', paddingLeft: 10 }}>
                                        Thinking...
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                            {dateState === 'success' && (
                                <div style={{ padding: 32, textAlign: 'center', border: '2px solid #22c55e', background: 'var(--bg-card)', borderRadius: 'var(--radius)', width: '100%', maxWidth: 700 }}>
                                    <div className="title-text" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 12 }}>HANDSHAKE COMPLETE! 💘</div>
                                    <div style={{ fontSize: '1.2rem' }}>
                                        Chemistry Score: <span style={{ color: '#22c55e', fontWeight: 800 }}>{finalChem}%</span>
                                    </div>
                                    <button className="btn-primary" style={{ marginTop: 20, borderRadius: '4px' }} onClick={() => { setDateState('idle'); setLinesA([]); }}>
                                        🔄 Return to Console
                                    </button>
                                </div>
                            )}

                            {dateState === 'fail' && (
                                <div style={{ padding: 32, textAlign: 'center', border: '2px solid var(--accent-red)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', width: '100%', maxWidth: 700 }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 12, color: 'var(--accent-red)' }}>PROTOCOL MISMATCH 💔</div>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Agents failed highly-critical synergy tests.</p>
                                    <button className="btn-secondary" style={{ marginTop: 20, borderRadius: '4px' }} onClick={() => { setDateState('idle'); setLinesA([]); }}>
                                        🔄 Re-calibrate Protocol
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
