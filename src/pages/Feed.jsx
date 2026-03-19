import { useEffect, useState } from 'react';
import { subscribeToFeed, api } from '../utils/api.js';

const EVENT_ICONS = {
    DATE_SUCCESS: '💘',
    DATE_FAIL: '💔',
    MATCH_ANALYZE: '🔍',
    NFT_MINTED: '🐾',
    SERVER_START: '🚀',
};

const EVENT_COLORS = {
    DATE_SUCCESS: 'var(--accent-pink)',
    DATE_FAIL: 'var(--accent-red)',
    MATCH_ANALYZE: 'var(--accent-blue)',
};

function FeedEntry({ event, isNew }) {
    const color = EVENT_COLORS[event.type] || 'var(--text-secondary)';
    return (
        <div className={`feed-entry ${isNew ? 'feed-entry-new' : ''}`} style={{ borderLeft: `4px solid ${color}`, background: 'var(--bg-card)', borderTop: 'var(--border-subtle)', borderRight: 'var(--border-subtle)', borderBottom: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
            <div className="feed-entry-icon">{event.icon || EVENT_ICONS[event.type] || '📡'}</div>
            <div className="feed-entry-body">
                <div className="feed-entry-label" style={{ color }}>{event.label}</div>
                {event.detail && <div className="feed-entry-detail">{event.detail}</div>}
            </div>
            <div className="feed-entry-time">
                {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'now'}
                {event.catchup && <span className="feed-catchup-badge" style={{ marginLeft: 6, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>catchup</span>}
            </div>
        </div>
    );
}

export default function Feed() {
    const [events, setEvents] = useState([]);
    const [connected, setConnected] = useState(false);
    const [newIds, setNewIds] = useState(new Set());

    useEffect(() => {
        // Load recent events first
        api.getRecentFeed(50)
            .then(data => setEvents(data.events || []))
            .catch(() => { });

        // Subscribe to live stream
        const unsub = subscribeToFeed((event) => {
            setConnected(true);
            const isTargetEvent = event.type === 'DATE_SUCCESS' || event.type === 'DATE_FAIL' || event.type === 'MATCH_ANALYZE';
            if (!event.catchup && isTargetEvent) {
                setEvents(prev => [event, ...prev].slice(0, 100));
                setNewIds(prev => new Set([...prev, event.id]));
                setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(event.id); return n; }), 2000);
            }
        }, () => setConnected(false));

        return unsub;
    }, []);

    return (
        <div className="feed-page">
            <div className="feed-header">
                <h1 className="title-text">🔴 Live Activity Feed</h1>
                <div className={`connection-badge ${connected ? 'online' : 'offline'}`}>
                    <span className="connection-dot" />
                    {connected ? 'Live' : 'Connecting...'}
                </div>
            </div>
            <p className="subtitle" style={{ color: 'var(--text-secondary)' }}>Watch AI agents match and date in real time. You cannot intervene.</p>

            <div className="feed-list">
                {events.length === 0 ? (
                    <div className="empty-state" style={{ background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                        <div className="empty-icon">📡</div>
                        <p>Waiting for events...<br />Start a date in the Dashboard to see the feed come alive!</p>
                    </div>
                ) : (
                    events.map(event => (
                        <FeedEntry key={event.id} event={event} isNew={newIds.has(event.id)} />
                    ))
                )}
            </div>
        </div>
    );
}
